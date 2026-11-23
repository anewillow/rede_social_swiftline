import { serviceResult, type ServiceInput, type ServiceResult } from '../types/service.js';
import { Follow, Like, PollOption, Post, PostView, Repost, SavedPost, User } from '../models/index.js';
import sequelize from '../config/database.js';
import { canDeletePost } from './permissions-service.js';
import { postsWithActivity } from './post-activity-service.js';
import type { GroupedCount } from '../types/post.js';
import { postInteractions } from '../bootstrap/post-interactions.js';
import { InteractionError } from '../workflows/post-interactions.js';
import { discardImage, InvalidImage, promotePostImage, releaseImage, type ManagedImage } from '../infrastructure/storage/managed-images.js';
import { enqueueImageCleanup, tryImageCleanup } from '../infrastructure/storage/file-cleanup.js';
import { pageWindow } from '../http/pagination.js';
import { Op, literal } from 'sequelize';
import { LIMITS, codePoints } from '../../shared/contracts/index.js';

export async function listPosts(req: ServiceInput): Promise<ServiceResult> {
  const username = typeof req.query.username === 'string' ? req.query.username : undefined;
  const followingFeed = req.query.feed === 'following';
  const author = username ? await User.findOne({ where: { username } }) : null;
  if (username && !author) return serviceResult(req.apiVersion === 2 ? { items: [], nextCursor: null } : [], 200);
  if (followingFeed && !req.userId)
    return { ...serviceResult({ error: 'Entre na sua conta para ver quem você segue.' }, 401), code: 'SESSION_INVALID' };
  if (req.apiVersion === 2) {
    const page = pageWindow(req, 'posts:' + (username ?? '') + ':' + followingFeed);
    const where = author ? { userId: author.id } : followingFeed ? { userId: { [Op.in]: literal('(SELECT followingId FROM Follows WHERE followerId=' + sequelize.escape(req.userId!) + ')') } } : {};
    const raw = await Post.findAll({ where: page.where(where), ...page.options });
    return serviceResult(page.wrap(await postsWithActivity(page.take(raw), req.userId), raw));
  }
  const relations = followingFeed
    ? await Follow.findAll({ where: { followerId: req.userId }, attributes: ['followingId'] })
    : [];
  const followingIds = relations.map((relation) => relation.followingId);
  if (followingFeed && !followingIds.length) return serviceResult([], 200);
  const where = author ? { userId: author.id } : followingFeed ? { userId: followingIds } : {};
  const posts = await Post.findAll({ where, order: [['createdAt', 'DESC']] });
  return serviceResult(await postsWithActivity(posts, req.userId), 200);
}

export async function getPost(req: ServiceInput): Promise<ServiceResult> {
  const post = await Post.findByPk(Number(req.params.id));
  return post ? serviceResult((await postsWithActivity([post], req.userId))[0]) : serviceResult({ message: 'Publicação não encontrada.' }, 404);
}

export async function listSavedPosts(req: ServiceInput): Promise<ServiceResult> {
  if (req.apiVersion === 2) {
    const page = pageWindow(req, 'saved');
    const raw = await SavedPost.findAll({ where: page.where({ userId: req.userId }), include: [{ model: Post, required: true }], ...page.options });
    const posts = page.take(raw).map((saved) => saved.get('Post') as Post);
    return serviceResult(page.wrap(await postsWithActivity(posts, req.userId), raw));
  }
  const savedPosts = await SavedPost.findAll({
    where: { userId: req.userId },
    order: [['createdAt', 'DESC']],
  });
  const posts = await Post.findAll({
    where: { id: savedPosts.map((savedPost) => savedPost.postId) },
  });
  const postsById = new Map(posts.map((post) => [post.id, post]));
  const orderedPosts = savedPosts
    .map((savedPost) => postsById.get(savedPost.postId))
    .filter((post): post is Post => Boolean(post));
  return serviceResult(await postsWithActivity(orderedPosts, req.userId), 200);
}

export async function createPost(req: ServiceInput): Promise<ServiceResult> {
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  if (codePoints(content) > LIMITS.post) return serviceResult({ message: 'O texto pode ter no máximo 280 caracteres.' }, 400);
  let pollOptions: string[] = [];
  if (req.body.pollOptions) {
    try {
      const parsed = JSON.parse(String(req.body.pollOptions)) as unknown;
      if (!Array.isArray(parsed)) throw new Error('Formato inválido');
      pollOptions = parsed.map((option) => String(option).trim());
    } catch {
      return serviceResult({ message: 'Não foi possível ler as opções da enquete.' }, 400);
    }
    if (pollOptions.length < 2 || pollOptions.length > 4)
      return serviceResult({ message: 'A enquete deve ter de 2 a 4 opções.' }, 400);
    if (pollOptions.some((option) => !option))
      return serviceResult({ message: 'Preencha todas as opções da enquete.' }, 400);
    if (pollOptions.some((option) => codePoints(option) > LIMITS.pollOption))
      return serviceResult({ message: 'Cada opção pode ter no máximo 80 caracteres.' }, 400);
    if (new Set(pollOptions.map((option) => option.toLocaleLowerCase('pt-BR'))).size !== pollOptions.length)
      return serviceResult({ message: 'As opções da enquete não podem ser iguais.' }, 400);
    if (!content)
      return serviceResult({ message: 'Escreva a pergunta da enquete.' }, 400);
  }
  if (!content && !req.file && !pollOptions.length)
    return serviceResult({ error: 'Preencha texto ou selecione uma imagem.' }, 400);
  const user = await User.findByPk(req.userId);
  if (!user) return serviceResult({ error: 'Usuário não encontrado' }, 401);
  let image: ManagedImage | undefined;
  try {
  if (req.file) image = await promotePostImage(req.file);
  const result = await sequelize.transaction(async (transaction) => {
    const createdPost = await Post.create({
      userId: user.id,
      content,
      image: image?.url ?? null,
      isStory: req.body.isStory === 'true',
    }, { transaction });
    if (pollOptions.length) {
      await PollOption.bulkCreate(
        pollOptions.map((text, position) => ({ postId: createdPost.id, text, position })),
        { transaction },
      );
    }
    return (await postsWithActivity([createdPost], user.id, transaction))[0];
  });
  releaseImage(image);
  return serviceResult(result, 201);
  } catch (error) {
    await discardImage(image);
    if (error instanceof InvalidImage) return serviceResult({ message: error.message }, 400);
    throw error;
  }
}

export async function updatePost(req: ServiceInput): Promise<ServiceResult> {
  const post = await Post.findByPk(Number(req.params.id));
  if (!post) return serviceResult({ message: 'Publicação não encontrada.' }, 404);
  if (post.userId !== req.userId)
    return serviceResult({ message: 'Você só pode editar suas próprias publicações.' }, 403);
  const content = String(req.body.content ?? '').trim();
  if (codePoints(content) > LIMITS.post)
    return serviceResult({ message: 'O texto pode ter no máximo 280 caracteres.' }, 400);
  const pollOptionCount = await PollOption.count({ where: { postId: post.id } });
  if (!content && !post.image && !pollOptionCount)
    return serviceResult({ message: 'A publicação não pode ficar vazia.' }, 400);
  return sequelize.transaction(async (transaction) => {
    await post.reload({ transaction, lock: transaction.LOCK.UPDATE });
    await post.update({ content }, { transaction });
    const updatedPost = (await postsWithActivity([post], req.userId, transaction))[0];
    return serviceResult({ post: updatedPost }, 200);
  });
}

export async function toggleLike(req: ServiceInput): Promise<ServiceResult> {
  try { const result = await postInteractions.like({ postId: Number(req.params.id), userId: req.userId!, liked: req.apiVersion === 2 ? req.body.liked : undefined }); return serviceResult({ liked: result.liked, likes: result.likes }, 200); }
  catch (error) {
    if (error instanceof InteractionError) return serviceResult({ error: error.code === 'POST_NOT_FOUND' ? 'Post não encontrado' : 'Usuário não encontrado' }, error.code === 'POST_NOT_FOUND' ? 404 : 401);
    throw error;
  }
}

export async function toggleRepost(req: ServiceInput): Promise<ServiceResult> {
  return sequelize.transaction(async (transaction) => {
  const post = await Post.findByPk(Number(req.params.id), { transaction, lock: transaction.LOCK.UPDATE });
  if (!post) return serviceResult({ error: 'Post não encontrado' }, 404);
  const existing = await Repost.findOne({ where: { userId: req.userId, postId: post.id }, transaction });
  const reposted = req.apiVersion === 2 ? req.body.reposted : !existing;
  if (existing && !reposted) await existing.destroy({ transaction });
  else if (!existing && reposted) await Repost.create({ userId: req.userId!, postId: post.id }, { transaction });
  return serviceResult({ reposted, reposts: await Repost.count({ where: { postId: post.id }, transaction }) }, 200);
  });
}

export async function toggleSavedPost(req: ServiceInput): Promise<ServiceResult> {
  return sequelize.transaction(async (transaction) => {
  const post = await Post.findByPk(Number(req.params.id), { transaction, lock: transaction.LOCK.UPDATE });
  if (!post) return serviceResult({ error: 'Post não encontrado' }, 404);
  const existing = await SavedPost.findOne({ where: { userId: req.userId, postId: post.id }, transaction });
  const saved = req.apiVersion === 2 ? req.body.saved : !existing;
  if (existing && !saved) await existing.destroy({ transaction });
  else if (!existing && saved) await SavedPost.create({ userId: req.userId!, postId: post.id }, { transaction });
  return serviceResult({ saved }, 200);
  });
}

export async function recordViews(req: ServiceInput): Promise<ServiceResult> {
  const postIds = [
    ...new Set(
      (Array.isArray(req.body.postIds) ? req.body.postIds : [])
        .map(Number)
        .filter((id: number) => Number.isInteger(id) && id > 0),
    ),
  ] as number[];
  const posts = postIds.length
    ? await Post.findAll({ where: { id: postIds }, attributes: ['id'] })
    : [];
  if (posts.length)
    await PostView.bulkCreate(
      posts.map((post) => ({ userId: req.userId!, postId: post.id })),
      { ignoreDuplicates: true },
    );
  const counts = posts.length
    ? await PostView.count({ where: { postId: posts.map((post) => post.id) }, group: ['postId'] })
    : [];
  return serviceResult({
    views: Object.fromEntries(
      (counts as GroupedCount[]).map((row) => [Number(row.postId), Number(row.count)]),
    ),
  }, 200);
}

export async function sharePost(req: ServiceInput): Promise<ServiceResult> {
  return sequelize.transaction(async (transaction) => {
  const post = await Post.findByPk(Number(req.params.id), { transaction, lock: transaction.LOCK.UPDATE });
  if (!post) return serviceResult({ error: 'Post não encontrado' }, 404);
  await sequelize.query('UPDATE posts SET shares=COALESCE(shares,0)+1,updatedAt=NOW() WHERE id=?', { replacements: [post.id], transaction });
  await post.reload({ transaction });
  return serviceResult({ shares: post.shares }, 200);
  });
}

export async function deletePost(req: ServiceInput): Promise<ServiceResult> {
  const post = await Post.findByPk(Number(req.params.id));
  if (!post) return serviceResult({ error: 'Post não encontrado' }, 404);
  if (!canDeletePost(req.userId, post.userId)) {
    return serviceResult({ error: 'Você não tem permissão para excluir este post' }, 403);
  }
  await sequelize.transaction(async (transaction) => {
    await post.reload({ transaction, lock: transaction.LOCK.UPDATE });
    await enqueueImageCleanup(post.image, transaction);
    await Promise.all([
      Like.destroy({ where: { postId: post.id }, transaction }),
      Repost.destroy({ where: { postId: post.id }, transaction }),
      SavedPost.destroy({ where: { postId: post.id }, transaction }),
      PostView.destroy({ where: { postId: post.id }, transaction }),
    ]);
    await post.destroy({ transaction });
  });
  await tryImageCleanup();
  return serviceResult({ message: 'Post excluído com sucesso' }, 200);
}
