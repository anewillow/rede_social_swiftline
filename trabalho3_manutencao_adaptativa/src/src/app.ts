import express, { type NextFunction, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { Op } from 'sequelize';
import {
  Comment,
  CommentLike,
  Follow,
  Like,
  Message,
  Notification,
  Post,
  PostView,
  Repost,
  SavedPost,
  User,
} from './models/index.js';
import { optionalAuth, requireAuth, secret } from './middleware/auth.js';
import {
  canDeleteComment,
  canDeletePost,
  canEditComment,
  getCommentPermissions,
} from './permissions.js';
import sequelize from './models/db.js';
import {
  prepareAvatar,
  prepareCover,
  removeStoredProfileImage,
  savePreparedProfileImage,
} from './avatar.js';
import { apiRateLimitOptions } from './rate-limit.js';

const app = express();
app.use('/api', rateLimit(apiRateLimitOptions));
const uploadsPath = path.join(process.cwd(), 'public/uploads');
mkdirSync(uploadsPath, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsPath,
    filename: (_request, file, callback) =>
      callback(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-')}`),
  }),
});
const clientEntry = path.join(process.cwd(), 'client-dist/index.html');

app.use('/api/auth/profile', express.json({ limit: '9mb' }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  if ((error as { type?: string }).type === 'entity.too.large') {
    const message = req.originalUrl.startsWith('/api/auth/profile')
      ? 'As imagens selecionadas ultrapassam o limite permitido.'
      : 'A solicitação ultrapassa o limite permitido.';
    return res.status(413).json({ message });
  }
  return next(error);
});
app.use('/uploads', express.static(uploadsPath));
app.use(express.static(path.join(process.cwd(), 'client-dist')));

const publicUser = (user: User) => ({
  id: user.id,
  username: user.username,
  bio: user.bio,
  avatar: user.avatar,
  cover: user.cover,
  createdAt: user.createdAt,
});
const privateUser = (user: User) => ({ ...publicUser(user), email: user.email });

type GroupedCount = { postId: number | string; count: number | string };

async function postsWithActivity(
  posts: Post[],
  userId?: number,
): Promise<Record<string, unknown>[]> {
  const postIds = posts.map((post) => post.id);
  if (!postIds.length) return [];
  const [likes, reposts, savedPosts, commentCounts, repostCounts, viewCounts] = await Promise.all([
    userId ? Like.findAll({ where: { userId, postId: postIds } }) : Promise.resolve([]),
    userId ? Repost.findAll({ where: { userId, postId: postIds } }) : Promise.resolve([]),
    userId ? SavedPost.findAll({ where: { userId, postId: postIds } }) : Promise.resolve([]),
    Comment.count({ where: { postId: postIds }, group: 'postId' }),
    Repost.count({ where: { postId: postIds }, group: 'postId' }),
    PostView.count({ where: { postId: postIds }, group: 'postId' }),
  ]);
  const likedIds = new Set(likes.map((like) => like.postId));
  const repostedIds = new Set(reposts.map((repost) => repost.postId));
  const savedIds = new Set(savedPosts.map((savedPost) => savedPost.postId));
  const toCountMap = (rows: unknown) =>
    new Map((rows as GroupedCount[]).map((row) => [Number(row.postId), Number(row.count)]));
  const commentsByPostId = toCountMap(commentCounts);
  const repostsByPostId = toCountMap(repostCounts);
  const viewsByPostId = toCountMap(viewCounts);
  return posts.map((post) => ({
    ...post.toJSON(),
    liked: likedIds.has(post.id),
    reposted: repostedIds.has(post.id),
    saved: savedIds.has(post.id),
    commentCount: commentsByPostId.get(post.id) ?? 0,
    reposts: repostsByPostId.get(post.id) ?? 0,
    views: viewsByPostId.get(post.id) ?? 0,
  }));
}

type TaylorTrend = { tag: string; count: number; kind: 'Álbum' | 'Música' };
type TaylorTopic = { tag: string; article: string; kind: TaylorTrend['kind'] };

const taylorTopics: TaylorTopic[] = [
  { tag: 'The Life of a Showgirl', article: 'The_Life_of_a_Showgirl', kind: 'Álbum' },
  { tag: 'The Tortured Poets Department', article: 'The_Tortured_Poets_Department', kind: 'Álbum' },
  { tag: 'Midnights', article: 'Midnights', kind: 'Álbum' },
  { tag: 'evermore', article: 'Evermore_(Taylor_Swift_album)', kind: 'Álbum' },
  { tag: 'folklore', article: 'Folklore_(Taylor_Swift_album)', kind: 'Álbum' },
  { tag: 'Lover', article: 'Lover_(album)', kind: 'Álbum' },
  { tag: 'reputation', article: 'Reputation_(album)', kind: 'Álbum' },
  { tag: '1989', article: '1989_(Taylor_Swift_album)', kind: 'Álbum' },
  { tag: 'Red', article: 'Red_(Taylor_Swift_album)', kind: 'Álbum' },
  { tag: 'Speak Now', article: 'Speak_Now', kind: 'Álbum' },
  { tag: 'Fearless', article: 'Fearless_(Taylor_Swift_album)', kind: 'Álbum' },
  { tag: 'Taylor Swift', article: 'Taylor_Swift_(album)', kind: 'Álbum' },
  { tag: 'The Fate of Ophelia', article: 'The_Fate_of_Ophelia', kind: 'Música' },
  { tag: 'Opalite', article: 'Opalite_(song)', kind: 'Música' },
  { tag: 'Fortnight', article: 'Fortnight_(song)', kind: 'Música' },
  { tag: 'Cruel Summer', article: 'Cruel_Summer_(Taylor_Swift_song)', kind: 'Música' },
  { tag: 'Anti-Hero', article: 'Anti-Hero_(song)', kind: 'Música' },
  { tag: 'All Too Well', article: 'All_Too_Well', kind: 'Música' },
  { tag: 'Blank Space', article: 'Blank_Space', kind: 'Música' },
  { tag: 'Shake It Off', article: 'Shake_It_Off', kind: 'Música' },
  { tag: 'Love Story', article: 'Love_Story_(Taylor_Swift_song)', kind: 'Música' },
  { tag: 'cardigan', article: 'Cardigan_(song)', kind: 'Música' },
];

let taylorTrendCache: { expiresAt: number; trends: TaylorTrend[] } | null = null;

const pageviewDate = (date: Date) =>
  `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;

async function globalTaylorTrends(): Promise<TaylorTrend[]> {
  if (taylorTrendCache && taylorTrendCache.expiresAt > Date.now()) return taylorTrendCache.trends;
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  const startDate = pageviewDate(start);
  const endDate = pageviewDate(end);
  const results = await Promise.allSettled(
    taylorTopics.map(async (topic) => {
      const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/${encodeURIComponent(topic.article)}/daily/${startDate}/${endDate}`;
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'Swiftline/1.0 Taylor trends' },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`Wikimedia respondeu ${response.status}`);
      const data = (await response.json()) as { items?: Array<{ views?: number }> };
      return {
        tag: topic.tag,
        kind: topic.kind,
        count: (data.items ?? []).reduce((total, item) => total + Number(item.views ?? 0), 0),
      } satisfies TaylorTrend;
    }),
  );
  const trends = results
    .flatMap((result) =>
      result.status === 'fulfilled' && result.value.count > 0 ? [result.value] : [],
    )
    .sort((first, second) => second.count - first.count)
    .slice(0, 5);
  if (!trends.length) throw new Error('Dados globais indisponíveis');
  taylorTrendCache = { expiresAt: Date.now() + 30 * 60 * 1000, trends };
  return trends;
}

type TaylorNews = {
  id: string;
  title: string;
  url: string;
  description: string;
  publishedAt: string;
  source: string;
  image: string | null;
};

let taylorNewsCache: { expiresAt: number; updatedAt: string; news: TaylorNews[] } | null = null;

type GdeltArticle = {
  url?: string;
  title?: string;
  seendate?: string;
  socialimage?: string;
  domain?: string;
  sentence?: string;
  context?: string;
};

const gdeltPublishedAt = (value?: string) => {
  if (!value) return new Date().toISOString();
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/);
  if (compact) {
    const [, year, month, day, hour, minute, second] = compact;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

async function latestTaylorNews(): Promise<TaylorNews[]> {
  if (taylorNewsCache && taylorNewsCache.expiresAt > Date.now()) return taylorNewsCache.news;

  const apiUrl = new URL('https://api.gdeltproject.org/api/v2/context/context');
  apiUrl.searchParams.set('query', '"Taylor Swift"');
  apiUrl.searchParams.set('mode', 'artlist');
  apiUrl.searchParams.set('maxrecords', '75');
  apiUrl.searchParams.set('timespan', '72H');
  apiUrl.searchParams.set('format', 'json');

  const response = await fetch(apiUrl, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Swiftline/1.0 Taylor news reader',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`GDELT respondeu ${response.status}`);

  const data = (await response.json()) as { articles?: GdeltArticle[] };
  const news = (data.articles ?? [])
    .filter(
      (article) =>
        article.title &&
        article.url &&
        /taylor\s+swift/i.test(article.title),
    )
    .map((article, index) => {
      const source = article.domain?.replace(/^www\./, '') || 'GDELT';
      const publishedAt = gdeltPublishedAt(article.seendate);
      const description = (article.context || article.sentence || '')
        .replace(/\s+/g, ' ')
        .trim();
      return {
        id: `${publishedAt}-${index}`,
        title: article.title!.trim(),
        url: article.url!,
        description: description || `Notícia sobre Taylor Swift publicada por ${source}.`,
        publishedAt,
        source,
        image: article.socialimage ? article.socialimage.replace(/^http:/, 'https:') : null,
      } satisfies TaylorNews;
    })
    .filter(
      (item, index, items) => items.findIndex((candidate) => candidate.title.toLowerCase() === item.title.toLowerCase()) === index,
    )
    .sort(
      (first, second) =>
        new Date(second.publishedAt).getTime() - new Date(first.publishedAt).getTime(),
    )
    .slice(0, 6);

  if (!news.length) throw new Error('Nenhuma notícia sobre Taylor Swift encontrada na GDELT');
  taylorNewsCache = {
    expiresAt: Date.now() + 5 * 60 * 1000,
    updatedAt: new Date().toISOString(),
    news,
  };
  return news;
}

app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { username, email, password } = req.body as Record<string, string>;
  const acceptedTerms = (req.body as { acceptedTerms?: boolean | string }).acceptedTerms;
  if (!username?.trim()) return res.status(400).json({ message: 'Nome é obrigatório.' });
  if (acceptedTerms !== true && acceptedTerms !== 'true')
    return res.status(400).json({
      message: 'Você precisa aceitar os Termos de Uso e a Política de Privacidade.',
    });
  if (!email?.match(/^[\w.-]+@[\w-]+\.[a-zA-Z]{2,}$/))
    return res.status(400).json({ message: 'Email inválido. Informe um email válido.' });
  if (!password || password.length < 6 || !/[!@#$%^&*(),.?":{}|<>]/.test(password))
    return res
      .status(400)
      .json({ message: 'Senha fraca. Mínimo 6 caracteres e pelo menos um caractere especial.' });
  const exists = await User.findOne({
    where: { [Op.or]: [{ email }, { username: username.trim() }] },
  });
  if (exists)
    return res.status(400).json({
      message: exists.email === email ? 'Email já cadastrado.' : 'Nome de usuário já cadastrado.',
    });
  const user = await User.create({
    username: username.trim(),
    email,
    password: await bcrypt.hash(password, 10),
  });
  return res.status(201).json(privateUser(user));
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as Record<string, string>;
  const user = await User.findOne({ where: { email } });
  if (!user) return res.status(400).json({ message: 'Usuário não encontrado.' });
  if (!(await bcrypt.compare(password ?? '', user.password)))
    return res.status(400).json({ message: 'Senha inválida.' });
  return res.json({
    token: jwt.sign({ id: user.id }, secret(), { expiresIn: '1d' }),
    user: privateUser(user),
  });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const user = await User.findByPk(req.userId);
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
  return res.json(privateUser(user));
});

app.put('/api/auth/profile', requireAuth, async (req, res) => {
  const user = await User.findByPk(req.userId);
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
  const { username, bio, avatar, cover } = req.body as Record<string, string>;
  if (username !== undefined && !username.trim())
    return res.status(400).json({ message: 'Nome de usuário obrigatório.' });

  const previousUsername = user.username;
  const previousAvatar = user.avatar;
  const previousCover = user.cover;
  let nextAvatar = previousAvatar;
  let nextCover = previousCover;
  const preparedAvatar =
    typeof avatar === 'string' && avatar ? prepareAvatar(avatar, user.id) : null;
  const preparedCover = typeof cover === 'string' && cover ? prepareCover(cover, user.id) : null;

  if (typeof avatar === 'string' && avatar && !preparedAvatar) {
    return res.status(400).json({ message: 'Avatar inválido ou maior que 3 MB.' });
  }
  if (typeof cover === 'string' && cover && !preparedCover) {
    return res.status(400).json({ message: 'Imagem de capa inválida ou maior que 3 MB.' });
  }

  try {
    if (typeof avatar === 'string')
      nextAvatar = preparedAvatar
        ? await savePreparedProfileImage(preparedAvatar, uploadsPath)
        : '';
    if (typeof cover === 'string')
      nextCover = preparedCover ? await savePreparedProfileImage(preparedCover, uploadsPath) : '';

    await sequelize.transaction(async (transaction) => {
      if (username) user.username = username.trim();
      if (typeof bio === 'string') user.bio = bio;
      user.avatar = nextAvatar;
      user.cover = nextCover;
      await user.save({ transaction });
      if (user.username !== previousUsername || user.avatar !== previousAvatar) {
        await Post.update(
          { author: user.username, avatar: user.avatar },
          { where: { userId: user.id }, transaction },
        );
      }
    });
  } catch {
    await Promise.allSettled([
      preparedAvatar?.bytes
        ? removeStoredProfileImage(preparedAvatar.url, uploadsPath, user.id, 'avatar')
        : Promise.resolve(),
      preparedCover?.bytes
        ? removeStoredProfileImage(preparedCover.url, uploadsPath, user.id, 'cover')
        : Promise.resolve(),
    ]);
    return res.status(500).json({ message: 'Não foi possível atualizar o perfil.' });
  }

  await Promise.allSettled([
    nextAvatar !== previousAvatar
      ? removeStoredProfileImage(previousAvatar, uploadsPath, user.id, 'avatar')
      : Promise.resolve(),
    nextCover !== previousCover
      ? removeStoredProfileImage(previousCover, uploadsPath, user.id, 'cover')
      : Promise.resolve(),
  ]);
  return res.json({ message: 'Perfil atualizado!', user: privateUser(user) });
});

app.delete('/api/auth/delete', requireAuth, async (req, res) => {
  const user = await User.findByPk(req.userId);
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });

  const { password } = req.body as { password?: string };
  if (!password)
    return res.status(400).json({ message: 'Digite sua senha para confirmar a exclusão.' });
  if (!(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ message: 'Senha incorreta.' });

  const { avatar, cover } = user;
  await sequelize.transaction(async (transaction) => {
    const posts = await Post.findAll({
      where: { userId: user.id },
      attributes: ['id'],
      transaction,
    });
    const postIds = posts.map((post) => post.id);
    const comments = await Comment.findAll({
      where: {
        [Op.or]: [
          { userId: user.id },
          ...(postIds.length ? [{ postId: { [Op.in]: postIds } }] : []),
        ],
      },
      attributes: ['id'],
      transaction,
    });
    const commentIds = comments.map((comment) => comment.id);

    await CommentLike.destroy({
      where: {
        [Op.or]: [
          { userId: user.id },
          ...(commentIds.length ? [{ commentId: { [Op.in]: commentIds } }] : []),
        ],
      },
      transaction,
    });

    for (const model of [Like, Repost, SavedPost, PostView]) {
      await model.destroy({
        where: {
          [Op.or]: [
            { userId: user.id },
            ...(postIds.length ? [{ postId: { [Op.in]: postIds } }] : []),
          ],
        },
        transaction,
      });
    }

    await Notification.destroy({
      where: { [Op.or]: [{ userId: user.id }, { actorId: user.id }] },
      transaction,
    });
    await Message.destroy({
      where: { [Op.or]: [{ senderId: user.id }, { receiverId: user.id }] },
      transaction,
    });
    await Follow.destroy({
      where: { [Op.or]: [{ followerId: user.id }, { followingId: user.id }] },
      transaction,
    });
    await Comment.destroy({
      where: {
        [Op.or]: [
          { userId: user.id },
          ...(postIds.length ? [{ postId: { [Op.in]: postIds } }] : []),
        ],
      },
      transaction,
    });
    await Post.destroy({ where: { userId: user.id }, transaction });
    await user.destroy({ transaction });
  });

  await Promise.allSettled([
    removeStoredProfileImage(avatar, uploadsPath, user.id, 'avatar'),
    removeStoredProfileImage(cover, uploadsPath, user.id, 'cover'),
  ]);
  return res.json({ message: 'Conta excluída com sucesso.' });
});

app.get('/api/posts', optionalAuth, async (req, res) => {
  const username = typeof req.query.username === 'string' ? req.query.username : undefined;
  const followingFeed = req.query.feed === 'following';
  const author = username ? await User.findOne({ where: { username } }) : null;
  if (username && !author) return res.json([]);
  if (followingFeed && !req.userId)
    return res.status(401).json({ error: 'Entre na sua conta para ver quem você segue.' });
  const relations = followingFeed
    ? await Follow.findAll({ where: { followerId: req.userId }, attributes: ['followingId'] })
    : [];
  const followingIds = relations.map((relation) => relation.followingId);
  if (followingFeed && !followingIds.length) return res.json([]);
  const where = author ? { userId: author.id } : followingFeed ? { userId: followingIds } : {};
  const posts = await Post.findAll({ where, order: [['createdAt', 'DESC']] });
  return res.json(await postsWithActivity(posts, req.userId));
});

app.get('/api/posts/saved', requireAuth, async (req, res) => {
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
  return res.json(await postsWithActivity(orderedPosts, req.userId));
});

app.get('/api/search', optionalAuth, async (req, res) => {
  const query = String(req.query.q ?? '').trim();
  if (query.length < 2) return res.json({ users: [], posts: [] });
  const [users, posts] = await Promise.all([
    User.findAll({
      where: { username: { [Op.like]: `%${query}%` } },
      order: [['username', 'ASC']],
      limit: 5,
    }),
    Post.findAll({
      where: {
        [Op.or]: [
          { content: { [Op.like]: `%${query}%` } },
          { author: { [Op.like]: `%${query}%` } },
        ],
      },
      order: [['createdAt', 'DESC']],
      limit: 8,
    }),
  ]);
  return res.json({
    users: users.map(publicUser),
    posts: await postsWithActivity(posts, req.userId),
  });
});

app.get('/api/trends', async (_req, res) => {
  try {
    return res.json({
      trends: await globalTaylorTrends(),
      updatedAt: new Date().toISOString(),
      period: 'Últimos 7 dias',
      source: 'Wikimedia Pageviews',
    });
  } catch {
    return res
      .status(503)
      .json({ trends: [], error: 'Os dados globais estão temporariamente indisponíveis.' });
  }
});

app.get('/api/news', async (_req, res) => {
  try {
    const news = await latestTaylorNews();
    return res.json({
      news,
      updatedAt: taylorNewsCache?.updatedAt ?? new Date().toISOString(),
      refreshAfterSeconds: 300,
      source: 'GDELT Context 2.0',
    });
  } catch {
    return res
      .status(503)
      .json({ news: [], error: 'As notícias estão temporariamente indisponíveis.' });
  }
});

app.post('/api/posts', requireAuth, upload.single('image'), async (req, res) => {
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  if (!content && !req.file)
    return res.status(400).json({ error: 'Preencha texto ou selecione uma imagem.' });
  const user = await User.findByPk(req.userId);
  if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
  const post = await Post.create({
    userId: user.id,
    author: user.username,
    content,
    image: req.file ? `/uploads/${req.file.filename}` : null,
    avatar: user.avatar,
    isStory: req.body.isStory === 'true',
  });
  return res.status(201).json(post);
});

app.post('/api/posts/:id/like', requireAuth, async (req, res) => {
  const post = await Post.findByPk(Number(req.params.id));
  if (!post) return res.status(404).json({ error: 'Post não encontrado' });
  const existing = await Like.findOne({ where: { userId: req.userId, postId: post.id } });
  const liked = !existing;
  if (existing) await existing.destroy();
  else {
    await Like.create({ userId: req.userId!, postId: post.id });
    if (post.userId !== req.userId) {
      const actor = await User.findByPk(req.userId);
      await Notification.create({
        userId: post.userId,
        actorId: req.userId!,
        type: 'like',
        message: `${actor?.username ?? 'Alguém'} curtiu sua publicação.`,
      });
    }
  }
  post.likes = await Like.count({ where: { postId: post.id } });
  await post.save();
  return res.json({ likes: post.likes, liked });
});

app.post('/api/posts/:id/repost', requireAuth, async (req, res) => {
  const post = await Post.findByPk(Number(req.params.id));
  if (!post) return res.status(404).json({ error: 'Post não encontrado' });
  const existing = await Repost.findOne({ where: { userId: req.userId, postId: post.id } });
  const reposted = !existing;
  if (existing) await existing.destroy();
  else await Repost.create({ userId: req.userId!, postId: post.id });
  return res.json({ reposted, reposts: await Repost.count({ where: { postId: post.id } }) });
});

app.post('/api/posts/:id/save', requireAuth, async (req, res) => {
  const post = await Post.findByPk(Number(req.params.id));
  if (!post) return res.status(404).json({ error: 'Post não encontrado' });
  const existing = await SavedPost.findOne({ where: { userId: req.userId, postId: post.id } });
  const saved = !existing;
  if (existing) await existing.destroy();
  else await SavedPost.create({ userId: req.userId!, postId: post.id });
  return res.json({ saved });
});

app.post('/api/posts/views', requireAuth, async (req, res) => {
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
    ? await PostView.count({ where: { postId: posts.map((post) => post.id) }, group: 'postId' })
    : [];
  return res.json({
    views: Object.fromEntries(
      (counts as GroupedCount[]).map((row) => [Number(row.postId), Number(row.count)]),
    ),
  });
});

app.post('/api/posts/:id/share', requireAuth, async (req, res) => {
  const post = await Post.findByPk(Number(req.params.id));
  if (!post) return res.status(404).json({ error: 'Post não encontrado' });
  post.shares = Number(post.shares || 0) + 1;
  await post.save();
  return res.json({ shares: post.shares });
});

app.post('/api/posts/:id/comments', requireAuth, async (req, res) => {
  const content = String(req.body.content ?? '').trim();
  if (!content) return res.status(400).json({ error: 'Comentário obrigatório' });
  const post = await Post.findByPk(Number(req.params.id));
  if (!post) return res.status(404).json({ error: 'Post não encontrado' });
  const comment = await Comment.create({ postId: post.id, userId: req.userId!, content });
  if (post.userId !== req.userId) {
    const actor = await User.findByPk(req.userId);
    await Notification.create({
      userId: post.userId,
      actorId: req.userId!,
      type: 'comment',
      message: `${actor?.username ?? 'Alguém'} respondeu à sua publicação.`,
    });
  }
  await comment.reload({
    include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }],
  });
  return res.status(201).json(comment);
});

// Trecho 1 - Exclusão de posts
app.delete('/api/posts/:id', requireAuth, async (req, res) => {
  const post = await Post.findByPk(Number(req.params.id));
  if (!post) return res.status(404).json({ error: 'Post não encontrado' });
  if (!canDeletePost(req.userId, post.userId)) {
    return res.status(403).json({ error: 'Você não tem permissão para excluir este post' });
  }
  await post.destroy();
  return res.json({ message: 'Post excluído com sucesso' });
});

// Trecho 2 - Edição de comentários
app.put('/api/posts/comments/:commentId', requireAuth, async (req, res) => {
  const comment = await Comment.findByPk(Number(req.params.commentId));
  const content = String(req.body.content ?? '').trim();
  if (!comment) return res.status(404).json({ error: 'Comentário não encontrado' });
  if (!canEditComment(req.userId, comment.userId)) {
    return res.status(403).json({ error: 'Você não tem permissão para editar este comentário' });
  }
  if (!content) return res.status(400).json({ error: 'O comentário não pode ficar vazio' });
  comment.content = content;
  await comment.save();
  return res.json(comment);
});

// Trecho 3 - Exclusão de comentários
app.delete('/api/posts/comments/:commentId', requireAuth, async (req, res) => {
  const comment = await Comment.findByPk(Number(req.params.commentId));
  if (!comment) return res.status(404).json({ error: 'Comentário não encontrado' });
  if (!canDeleteComment(req.userId, comment.userId)) {
    return res.status(403).json({ error: 'Você não tem permissão para excluir este comentário' });
  }
  await comment.destroy();
  return res.json({ message: 'Comentário excluído com sucesso' });
});

// Trecho 4 - Listagem de comentários
app.get('/api/posts/:id/comments', optionalAuth, async (req, res) => {
  const comments = await Comment.findAll({
    where: { postId: req.params.id },
    include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }],
    order: [['createdAt', 'ASC']],
  });
  const commentsWithPermissions = comments.map((comment) => ({
    ...comment.toJSON(),
    permissions: getCommentPermissions(req.userId, comment.userId),
  }));
  return res.json(commentsWithPermissions);
});

app.post('/api/posts/comments/:commentId/like', requireAuth, async (req, res) => {
  const commentId = Number(req.params.commentId);
  const existing = await CommentLike.findOne({ where: { userId: req.userId, commentId } });
  const liked = !existing;
  if (existing) await existing.destroy();
  else await CommentLike.create({ userId: req.userId!, commentId });
  return res.json({ likes: await CommentLike.count({ where: { commentId } }), liked });
});

app.get('/api/users/search', optionalAuth, async (req, res) => {
  const query = String(req.query.q ?? '');
  const users = await User.findAll({
    where: {
      ...(query ? { username: { [Op.like]: `%${query}%` } } : {}),
      ...(req.userId ? { id: { [Op.ne]: req.userId } } : {}),
    },
    attributes: ['id', 'username', 'avatar', 'bio', 'createdAt'],
  });
  return res.json(users);
});

app.get('/api/users/username/:username', async (req, res) => {
  const user = await User.findOne({ where: { username: req.params.username } });
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  return res.json(publicUser(user));
});
app.get('/api/users/id/:id', async (req, res) => {
  const user = await User.findByPk(Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  return res.json(publicUser(user));
});

app.get('/api/users/:username/followers', async (req, res) => {
  const user = await User.findOne({ where: { username: req.params.username } });
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  const relations = await Follow.findAll({ where: { followingId: user.id } });
  const users = await User.findAll({
    where: { id: relations.map((relation) => relation.followerId) },
    attributes: ['id', 'username', 'avatar', 'bio'],
  });
  return res.json(users);
});

app.get('/api/users/:username/following', async (req, res) => {
  const user = await User.findOne({ where: { username: req.params.username } });
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  const relations = await Follow.findAll({ where: { followerId: user.id } });
  const users = await User.findAll({
    where: { id: relations.map((relation) => relation.followingId) },
    attributes: ['id', 'username', 'avatar', 'bio'],
  });
  return res.json(users);
});

app.post('/api/follow/follow/:username', requireAuth, async (req, res) => {
  const target = await User.findOne({ where: { username: req.params.username } });
  if (!target || target.id === req.userId)
    return res.status(400).json({ error: 'Usuário inválido' });
  const [, created] = await Follow.findOrCreate({
    where: { followerId: req.userId!, followingId: target.id },
  });
  if (created) {
    const actor = await User.findByPk(req.userId);
    await Notification.create({
      userId: target.id,
      actorId: req.userId!,
      type: 'follow',
      message: `${actor?.username ?? 'Alguém'} começou a seguir você.`,
    });
  }
  return res.json({
    success: true,
    followersCount: await Follow.count({ where: { followingId: target.id } }),
  });
});

app.post('/api/follow/unfollow/:username', requireAuth, async (req, res) => {
  const target = await User.findOne({ where: { username: req.params.username } });
  if (!target) return res.status(404).json({ error: 'Usuário não encontrado' });
  await Follow.destroy({ where: { followerId: req.userId!, followingId: target.id } });
  return res.json({
    success: true,
    followersCount: await Follow.count({ where: { followingId: target.id } }),
  });
});
app.get('/api/follow/is-following/:username', requireAuth, async (req, res) => {
  const target = await User.findOne({ where: { username: req.params.username } });
  return res.json({
    following:
      !!target &&
      !!(await Follow.findOne({ where: { followerId: req.userId!, followingId: target.id } })),
  });
});

app.get('/api/notifications', requireAuth, async (req, res) => {
  const notifications = await Notification.findAll({
    where: { userId: req.userId },
    include: [{ model: User, as: 'actor', attributes: ['username', 'avatar'] }],
    order: [['createdAt', 'DESC']],
  });
  return res.json(notifications);
});
app.put('/api/notifications/read', requireAuth, async (req, res) => {
  await Notification.update({ isRead: true }, { where: { userId: req.userId } });
  return res.json({ success: true });
});

app.get('/api/messages/people', requireAuth, async (req, res) => {
  const people = await User.findAll({
    where: { id: { [Op.ne]: req.userId } },
    attributes: ['id', 'username', 'avatar', 'bio'],
    limit: 30,
  });
  return res.json(people);
});

app.get('/api/messages/:userId', requireAuth, async (req, res) => {
  const otherId = Number(req.params.userId);
  const messages = await Message.findAll({
    where: {
      [Op.or]: [
        { senderId: req.userId, receiverId: otherId },
        { senderId: otherId, receiverId: req.userId },
      ],
    },
    order: [['createdAt', 'ASC']],
    include: [{ model: User, as: 'sender', attributes: ['username', 'avatar'] }],
  });
  return res.json(messages);
});

app.post('/api/messages/:userId', requireAuth, async (req, res) => {
  const content = String(req.body.content ?? '').trim();
  const receiverId = Number(req.params.userId);
  if (!content) return res.status(400).json({ error: 'Mensagem obrigatória' });
  if (receiverId === req.userId || !(await User.findByPk(receiverId)))
    return res.status(400).json({ error: 'Destinatário inválido' });
  const message = await Message.create({ senderId: req.userId!, receiverId, content });
  await message.reload({
    include: [{ model: User, as: 'sender', attributes: ['username', 'avatar'] }],
  });
  return res.status(201).json(message);
});

app.get('/{*splat}', (_req, res) => res.sendFile(clientEntry));

export default app;
