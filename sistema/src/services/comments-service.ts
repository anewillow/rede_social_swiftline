import { serviceResult, type ServiceInput, type ServiceResult } from '../types/service.js';
import { Comment, CommentLike, User } from '../models/index.js';
import { postInteractions } from '../bootstrap/post-interactions.js';
import { InteractionError } from '../workflows/post-interactions.js';
import database from '../config/database.js';
import { pageWindow } from '../http/pagination.js';
import { canDeleteComment, canEditComment, getCommentPermissions } from './permissions-service.js';

export async function createComment(req: ServiceInput): Promise<ServiceResult> {
  const content = String(req.body.content ?? '').trim();
  if (!content) return serviceResult({ error: 'Comentário obrigatório' }, 400);
  try {
    const comment = await postInteractions.comment({ postId: Number(req.params.id), userId: req.userId!, content });
    return serviceResult(req.apiVersion === 2 ? { ...comment, permissions: getCommentPermissions(req.userId, req.userId!) } : comment, 201);
  } catch (error) {
    if (error instanceof InteractionError) return serviceResult({ error: error.code === 'POST_NOT_FOUND' ? 'Post não encontrado' : 'Usuário não encontrado' }, error.code === 'POST_NOT_FOUND' ? 404 : 401);
    throw error;
  }
}

export async function updateComment(req: ServiceInput): Promise<ServiceResult> {
  const comment = await Comment.findByPk(Number(req.params.commentId));
  const content = String(req.body.content ?? '').trim();
  if (!comment) return serviceResult({ error: 'Comentário não encontrado' }, 404);
  if (!canEditComment(req.userId, comment.userId)) {
    return serviceResult({ error: 'Você não tem permissão para editar este comentário' }, 403);
  }
  if (!content) return serviceResult({ error: 'O comentário não pode ficar vazio' }, 400);
  comment.content = content;
  await comment.save();
  return serviceResult(req.apiVersion === 2 ? { ...(comment.toJSON() as Record<string, unknown>), permissions: getCommentPermissions(req.userId, comment.userId) } : comment, 200);
}

export async function deleteComment(req: ServiceInput): Promise<ServiceResult> {
  const comment = await Comment.findByPk(Number(req.params.commentId));
  if (!comment) return serviceResult({ error: 'Comentário não encontrado' }, 404);
  if (!canDeleteComment(req.userId, comment.userId)) {
    return serviceResult({ error: 'Você não tem permissão para excluir este comentário' }, 403);
  }
  await comment.destroy();
  return serviceResult({ message: 'Comentário excluído com sucesso' }, 200);
}

export async function listComments(req: ServiceInput): Promise<ServiceResult> {
  const page = pageWindow(req, 'comments:' + req.params.id, 'ASC');
  const comments = await Comment.findAll({
    where: page.where({ postId: req.params.id }),
    include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }],
    order: [['createdAt', 'ASC']],
    ...page.options,
  });
  const commentsWithPermissions = page.take(comments).map((comment) => ({
    ...comment.toJSON(),
    permissions: getCommentPermissions(req.userId, comment.userId),
  }));
  return serviceResult(page.wrap(commentsWithPermissions, comments), 200);
}

export async function toggleLike(req: ServiceInput): Promise<ServiceResult> {
  const commentId = Number(req.params.commentId);
  return database.transaction(async (transaction) => {
  if (!await Comment.findByPk(commentId, { transaction, lock: transaction.LOCK.UPDATE })) return serviceResult({ error: 'Comentário não encontrado' }, 404);
  const existing = await CommentLike.findOne({ where: { userId: req.userId, commentId }, transaction, lock: transaction.LOCK.UPDATE });
  const liked = req.apiVersion === 2 ? req.body.liked : !existing;
  if (existing && !liked) await existing.destroy({ transaction });
  else if (!existing && liked) await CommentLike.create({ userId: req.userId!, commentId }, { transaction });
  return serviceResult({ likes: await CommentLike.count({ where: { commentId }, transaction }), liked }, 200);
  });
}
