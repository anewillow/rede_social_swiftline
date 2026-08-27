import express, { type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { Op } from 'sequelize';
import { Comment, CommentLike, Follow, Like, Message, Notification, Post, PostView, Repost, SavedPost, User } from './models/index.js';
import { optionalAuth, requireAuth, secret } from './middleware/auth.js';

const app = express();
const uploadsPath = path.join(process.cwd(), 'public/uploads');
mkdirSync(uploadsPath, { recursive: true });
const upload = multer({ storage: multer.diskStorage({ destination: uploadsPath, filename: (_request, file, callback) => callback(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-')}`) }) });
const clientEntry = path.join(process.cwd(), 'client-dist/index.html');

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use('/uploads', express.static(uploadsPath));
app.use(express.static(path.join(process.cwd(), 'client-dist')));

const publicUser = (user: User) => ({ id: user.id, username: user.username, bio: user.bio, avatar: user.avatar, createdAt: user.createdAt });
const privateUser = (user: User) => ({ ...publicUser(user), email: user.email });

type GroupedCount = { postId: number | string; count: number | string };

async function postsWithActivity(posts: Post[], userId?: number): Promise<Record<string, unknown>[]> {
  const postIds = posts.map((post) => post.id);
  if (!postIds.length) return [];
  const [likes, reposts, savedPosts, commentCounts, repostCounts, viewCounts] = await Promise.all([
    userId ? Like.findAll({ where: { userId, postId: postIds } }) : Promise.resolve([]),
    userId ? Repost.findAll({ where: { userId, postId: postIds } }) : Promise.resolve([]),
    userId ? SavedPost.findAll({ where: { userId, postId: postIds } }) : Promise.resolve([]),
    Comment.count({ where: { postId: postIds }, group: 'postId' }),
    Repost.count({ where: { postId: postIds }, group: 'postId' }),
    PostView.count({ where: { postId: postIds }, group: 'postId' })
  ]);
  const likedIds = new Set(likes.map((like) => like.postId));
  const repostedIds = new Set(reposts.map((repost) => repost.postId));
  const savedIds = new Set(savedPosts.map((savedPost) => savedPost.postId));
  const toCountMap = (rows: unknown) => new Map((rows as GroupedCount[]).map((row) => [Number(row.postId), Number(row.count)]));
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
    views: viewsByPostId.get(post.id) ?? 0
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
  { tag: 'cardigan', article: 'Cardigan_(song)', kind: 'Música' }
];

let taylorTrendCache: { expiresAt: number; trends: TaylorTrend[] } | null = null;

const pageviewDate = (date: Date) => `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;

async function globalTaylorTrends(): Promise<TaylorTrend[]> {
  if (taylorTrendCache && taylorTrendCache.expiresAt > Date.now()) return taylorTrendCache.trends;
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  const startDate = pageviewDate(start);
  const endDate = pageviewDate(end);
  const results = await Promise.allSettled(taylorTopics.map(async (topic) => {
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/${encodeURIComponent(topic.article)}/daily/${startDate}/${endDate}`;
    const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Swiftline/1.0 Taylor trends' }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Wikimedia respondeu ${response.status}`);
    const data = await response.json() as { items?: Array<{ views?: number }> };
    return { tag: topic.tag, kind: topic.kind, count: (data.items ?? []).reduce((total, item) => total + Number(item.views ?? 0), 0) } satisfies TaylorTrend;
  }));
  const trends = results.flatMap((result) => result.status === 'fulfilled' && result.value.count > 0 ? [result.value] : []).sort((first, second) => second.count - first.count).slice(0, 5);
  if (!trends.length) throw new Error('Dados globais indisponíveis');
  taylorTrendCache = { expiresAt: Date.now() + 30 * 60 * 1000, trends };
  return trends;
}

type TaylorNews = { id: string; title: string; url: string; description: string; publishedAt: string; source: string; image: string | null };

let taylorNewsCache: { expiresAt: number; updatedAt: string; news: TaylorNews[] } | null = null;

const decodeXml = (value: string) => value
  .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
  .replace(/&quot;/g, '"')
  .replace(/&apos;|&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

const rssValue = (item: string, tag: string) => {
  const match = item.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1].trim()) : '';
};

async function latestTaylorNews(): Promise<TaylorNews[]> {
  if (taylorNewsCache && taylorNewsCache.expiresAt > Date.now()) return taylorNewsCache.news;
  const feedUrl = new URL('https://www.bing.com/news/search');
  feedUrl.searchParams.set('q', '"Taylor Swift" loc:BR');
  feedUrl.searchParams.set('qft', 'sortbydate="1"');
  feedUrl.searchParams.set('format', 'rss');
  feedUrl.searchParams.set('mkt', 'pt-BR');
  feedUrl.searchParams.set('cc', 'BR');
  feedUrl.searchParams.set('setlang', 'pt-BR');
  const response = await fetch(feedUrl, { headers: { Accept: 'application/rss+xml, application/xml;q=0.9', 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.6', 'User-Agent': 'Swiftline/1.0 Taylor news reader' }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Feed de notícias respondeu ${response.status}`);
  const xml = await response.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  const news = items.map((match, index) => {
    const item = match[1];
    const bingUrl = rssValue(item, 'link');
    let directUrl = bingUrl;
    try { directUrl = new URL(bingUrl).searchParams.get('url') || bingUrl; } catch {}
    const rawImage = rssValue(item, 'News:Image');
    const rawDate = rssValue(item, 'pubDate');
    const parsedDate = new Date(rawDate);
    return {
      id: `${parsedDate.getTime() || Date.now()}-${index}`,
      title: rssValue(item, 'title'),
      url: directUrl,
      description: rssValue(item, 'description').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      publishedAt: Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString(),
      source: rssValue(item, 'News:Source') || 'Notícias',
      image: rawImage ? rawImage.replace(/^http:/, 'https:') : null
    } satisfies TaylorNews;
  }).filter((item) => item.title && item.url).sort((first, second) => new Date(second.publishedAt).getTime() - new Date(first.publishedAt).getTime());
  const withImages = news.filter((item) => item.image);
  const selected = [...withImages, ...news.filter((item) => !item.image)].slice(0, 6);
  if (!selected.length) throw new Error('Nenhuma notícia encontrada');
  taylorNewsCache = { expiresAt: Date.now() + 30 * 1000, updatedAt: new Date().toISOString(), news: selected };
  return selected;
}

app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { username, email, password } = req.body as Record<string, string>;
  if (!username?.trim()) return res.status(400).json({ message: 'Nome é obrigatório.' });
  if (!email?.match(/^[\w.-]+@[\w-]+\.[a-zA-Z]{2,}$/)) return res.status(400).json({ message: 'Email inválido. Informe um email válido.' });
  if (!password || password.length < 6 || !/[!@#$%^&*(),.?":{}|<>]/.test(password)) return res.status(400).json({ message: 'Senha fraca. Mínimo 6 caracteres e pelo menos um caractere especial.' });
  const exists = await User.findOne({ where: { [Op.or]: [{ email }, { username: username.trim() }] } });
  if (exists) return res.status(400).json({ message: exists.email === email ? 'Email já cadastrado.' : 'Nome de usuário já cadastrado.' });
  const user = await User.create({ username: username.trim(), email, password: await bcrypt.hash(password, 10) });
  return res.status(201).json(privateUser(user));
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as Record<string, string>;
  const user = await User.findOne({ where: { email } });
  if (!user) return res.status(400).json({ message: 'Usuário não encontrado.' });
  if (!(await bcrypt.compare(password ?? '', user.password))) return res.status(400).json({ message: 'Senha inválida.' });
  return res.json({ token: jwt.sign({ id: user.id }, secret(), { expiresIn: '1d' }), user: privateUser(user) });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const user = await User.findByPk(req.userId);
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
  return res.json(privateUser(user));
});

app.put('/api/auth/profile', requireAuth, async (req, res) => {
  const user = await User.findByPk(req.userId);
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
  const { username, bio, avatar } = req.body as Record<string, string>;
  if (username !== undefined && !username.trim()) return res.status(400).json({ message: 'Nome de usuário obrigatório.' });
  if (avatar && !/^https?:\/\/.+\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(avatar)) return res.status(400).json({ message: 'Avatar inválido.' });
  const previousUsername = user.username;
  if (username) user.username = username.trim(); if (typeof bio === 'string') user.bio = bio; if (typeof avatar === 'string') user.avatar = avatar;
  await user.save();
  if (user.username !== previousUsername) await Post.update({ author: user.username, avatar: user.avatar }, { where: { userId: user.id } });
  return res.json({ message: 'Perfil atualizado!', user: privateUser(user) });
});

app.delete('/api/auth/delete', requireAuth, async (req, res) => { const user = await User.findByPk(req.userId); if (!user) return res.status(404).json({ message: 'Usuário não encontrado' }); await user.destroy(); return res.json({ message: 'Conta excluída com sucesso.' }); });

app.get('/api/posts', optionalAuth, async (req, res) => {
  const username = typeof req.query.username === 'string' ? req.query.username : undefined;
  const followingFeed = req.query.feed === 'following';
  const author = username ? await User.findOne({ where: { username } }) : null;
  if (username && !author) return res.json([]);
  if (followingFeed && !req.userId) return res.status(401).json({ error: 'Entre na sua conta para ver quem você segue.' });
  const relations = followingFeed ? await Follow.findAll({ where: { followerId: req.userId }, attributes: ['followingId'] }) : [];
  const followingIds = relations.map((relation) => relation.followingId);
  if (followingFeed && !followingIds.length) return res.json([]);
  const where = author ? { userId: author.id } : followingFeed ? { userId: followingIds } : {};
  const posts = await Post.findAll({ where, order: [['createdAt', 'DESC']] });
  return res.json(await postsWithActivity(posts, req.userId));
});

app.get('/api/posts/saved', requireAuth, async (req, res) => {
  const savedPosts = await SavedPost.findAll({ where: { userId: req.userId }, order: [['createdAt', 'DESC']] });
  const posts = await Post.findAll({ where: { id: savedPosts.map((savedPost) => savedPost.postId) } });
  const postsById = new Map(posts.map((post) => [post.id, post]));
  const orderedPosts = savedPosts.map((savedPost) => postsById.get(savedPost.postId)).filter((post): post is Post => Boolean(post));
  return res.json(await postsWithActivity(orderedPosts, req.userId));
});

app.get('/api/search', optionalAuth, async (req, res) => {
  const query = String(req.query.q ?? '').trim();
  if (query.length < 2) return res.json({ users: [], posts: [] });
  const [users, posts] = await Promise.all([
    User.findAll({ where: { username: { [Op.like]: `%${query}%` } }, order: [['username', 'ASC']], limit: 5 }),
    Post.findAll({ where: { [Op.or]: [{ content: { [Op.like]: `%${query}%` } }, { author: { [Op.like]: `%${query}%` } }] }, order: [['createdAt', 'DESC']], limit: 8 })
  ]);
  return res.json({ users: users.map(publicUser), posts: await postsWithActivity(posts, req.userId) });
});

app.get('/api/trends', async (_req, res) => {
  try {
    return res.json({ trends: await globalTaylorTrends(), updatedAt: new Date().toISOString(), period: 'Últimos 7 dias', source: 'Wikimedia Pageviews' });
  } catch {
    return res.status(503).json({ trends: [], error: 'Os dados globais estão temporariamente indisponíveis.' });
  }
});

app.get('/api/news', async (_req, res) => {
  try {
    const news = await latestTaylorNews();
    return res.json({ news, updatedAt: taylorNewsCache?.updatedAt ?? new Date().toISOString(), refreshAfterSeconds: 30, source: 'Bing Notícias' });
  } catch {
    return res.status(503).json({ news: [], error: 'As notícias estão temporariamente indisponíveis.' });
  }
});

app.post('/api/posts', requireAuth, upload.single('image'), async (req, res) => {
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  if (!content && !req.file) return res.status(400).json({ error: 'Preencha texto ou selecione uma imagem.' });
  const user = await User.findByPk(req.userId); if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
  const post = await Post.create({ userId: user.id, author: user.username, content, image: req.file ? `/uploads/${req.file.filename}` : null, avatar: user.avatar, isStory: req.body.isStory === 'true' });
  return res.status(201).json(post);
});

app.delete('/api/posts/:id', requireAuth, async (req, res) => { const post = await Post.findByPk(Number(req.params.id)); if (!post) return res.status(404).json({ error: 'Post não encontrado' }); if (post.userId !== req.userId) return res.status(403).json({ error: 'Você não tem permissão para excluir este post' }); await post.destroy(); return res.json({ message: 'Post excluído com sucesso' }); });
app.post('/api/posts/:id/like', requireAuth, async (req, res) => { const post = await Post.findByPk(Number(req.params.id)); if (!post) return res.status(404).json({ error: 'Post não encontrado' }); const existing = await Like.findOne({ where: { userId: req.userId, postId: post.id } }); const liked = !existing; if (existing) await existing.destroy(); else { await Like.create({ userId: req.userId!, postId: post.id }); if (post.userId !== req.userId) { const actor = await User.findByPk(req.userId); await Notification.create({ userId: post.userId, actorId: req.userId!, type: 'like', message: `${actor?.username ?? 'Alguém'} curtiu sua publicação.` }); } } post.likes = await Like.count({ where: { postId: post.id } }); await post.save(); return res.json({ likes: post.likes, liked }); });
app.post('/api/posts/:id/repost', requireAuth, async (req, res) => { const post = await Post.findByPk(Number(req.params.id)); if (!post) return res.status(404).json({ error: 'Post não encontrado' }); const existing = await Repost.findOne({ where: { userId: req.userId, postId: post.id } }); const reposted = !existing; if (existing) await existing.destroy(); else await Repost.create({ userId: req.userId!, postId: post.id }); return res.json({ reposted, reposts: await Repost.count({ where: { postId: post.id } }) }); });
app.post('/api/posts/:id/save', requireAuth, async (req, res) => { const post = await Post.findByPk(Number(req.params.id)); if (!post) return res.status(404).json({ error: 'Post não encontrado' }); const existing = await SavedPost.findOne({ where: { userId: req.userId, postId: post.id } }); const saved = !existing; if (existing) await existing.destroy(); else await SavedPost.create({ userId: req.userId!, postId: post.id }); return res.json({ saved }); });
app.post('/api/posts/views', requireAuth, async (req, res) => { const postIds = [...new Set((Array.isArray(req.body.postIds) ? req.body.postIds : []).map(Number).filter((id: number) => Number.isInteger(id) && id > 0))] as number[]; const posts = postIds.length ? await Post.findAll({ where: { id: postIds }, attributes: ['id'] }) : []; if (posts.length) await PostView.bulkCreate(posts.map((post) => ({ userId: req.userId!, postId: post.id })), { ignoreDuplicates: true }); const counts = posts.length ? await PostView.count({ where: { postId: posts.map((post) => post.id) }, group: 'postId' }) : []; return res.json({ views: Object.fromEntries((counts as GroupedCount[]).map((row) => [Number(row.postId), Number(row.count)])) }); });
app.post('/api/posts/:id/share', requireAuth, async (req, res) => { const post = await Post.findByPk(Number(req.params.id)); if (!post) return res.status(404).json({ error: 'Post não encontrado' }); post.shares = Number(post.shares || 0) + 1; await post.save(); return res.json({ shares: post.shares }); });

app.get('/api/posts/:id/comments', optionalAuth, async (req, res) => { const comments = await Comment.findAll({ where: { postId: req.params.id }, include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }], order: [['createdAt', 'ASC']] }); return res.json(comments); });
app.post('/api/posts/:id/comments', requireAuth, async (req, res) => { const content = String(req.body.content ?? '').trim(); if (!content) return res.status(400).json({ error: 'Comentário obrigatório' }); const post = await Post.findByPk(Number(req.params.id)); if (!post) return res.status(404).json({ error: 'Post não encontrado' }); const comment = await Comment.create({ postId: post.id, userId: req.userId!, content }); if (post.userId !== req.userId) { const actor = await User.findByPk(req.userId); await Notification.create({ userId: post.userId, actorId: req.userId!, type: 'comment', message: `${actor?.username ?? 'Alguém'} respondeu à sua publicação.` }); } await comment.reload({ include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }] }); return res.status(201).json(comment); });
app.put('/api/posts/comments/:commentId', requireAuth, async (req, res) => { const comment = await Comment.findByPk(Number(req.params.commentId)); const content = String(req.body.content ?? '').trim(); if (!comment) return res.status(404).json({ error: 'Comentário não encontrado' }); if (comment.userId !== req.userId) return res.status(403).json({ error: 'Você não tem permissão para editar este comentário' }); if (!content) return res.status(400).json({ error: 'O comentário não pode ficar vazio' }); comment.content = content; await comment.save(); return res.json(comment); });
app.delete('/api/posts/comments/:commentId', requireAuth, async (req, res) => { const comment = await Comment.findByPk(Number(req.params.commentId)); if (!comment) return res.status(404).json({ error: 'Comentário não encontrado' }); if (comment.userId !== req.userId) return res.status(403).json({ error: 'Você não tem permissão para excluir este comentário' }); await comment.destroy(); return res.json({ message: 'Comentário excluído com sucesso' }); });
app.post('/api/posts/comments/:commentId/like', requireAuth, async (req, res) => { const commentId = Number(req.params.commentId); const existing = await CommentLike.findOne({ where: { userId: req.userId, commentId } }); const liked = !existing; if (existing) await existing.destroy(); else await CommentLike.create({ userId: req.userId!, commentId }); return res.json({ likes: await CommentLike.count({ where: { commentId } }), liked }); });

app.get('/api/users/search', optionalAuth, async (req, res) => { const query = String(req.query.q ?? ''); const users = await User.findAll({ where: { ...(query ? { username: { [Op.like]: `%${query}%` } } : {}), ...(req.userId ? { id: { [Op.ne]: req.userId } } : {}) }, attributes: ['id', 'username', 'avatar', 'bio', 'createdAt'] }); return res.json(users); });
app.get('/api/users/username/:username', async (req, res) => { const user = await User.findOne({ where: { username: req.params.username } }); if (!user) return res.status(404).json({ error: 'Usuário não encontrado' }); return res.json(publicUser(user)); });
app.get('/api/users/id/:id', async (req, res) => { const user = await User.findByPk(Number(req.params.id)); if (!user) return res.status(404).json({ error: 'Usuário não encontrado' }); return res.json(publicUser(user)); });
app.get('/api/users/:username/followers', async (req, res) => { const user = await User.findOne({ where: { username: req.params.username } }); if (!user) return res.status(404).json({ error: 'Usuário não encontrado' }); const relations = await Follow.findAll({ where: { followingId: user.id } }); const users = await User.findAll({ where: { id: relations.map((relation) => relation.followerId) }, attributes: ['id', 'username', 'avatar', 'bio'] }); return res.json(users); });
app.get('/api/users/:username/following', async (req, res) => { const user = await User.findOne({ where: { username: req.params.username } }); if (!user) return res.status(404).json({ error: 'Usuário não encontrado' }); const relations = await Follow.findAll({ where: { followerId: user.id } }); const users = await User.findAll({ where: { id: relations.map((relation) => relation.followingId) }, attributes: ['id', 'username', 'avatar', 'bio'] }); return res.json(users); });

app.post('/api/follow/follow/:username', requireAuth, async (req, res) => { const target = await User.findOne({ where: { username: req.params.username } }); if (!target || target.id === req.userId) return res.status(400).json({ error: 'Usuário inválido' }); const [, created] = await Follow.findOrCreate({ where: { followerId: req.userId!, followingId: target.id } }); if (created) { const actor = await User.findByPk(req.userId); await Notification.create({ userId: target.id, actorId: req.userId!, type: 'follow', message: `${actor?.username ?? 'Alguém'} começou a seguir você.` }); } return res.json({ success: true, followersCount: await Follow.count({ where: { followingId: target.id } }) }); });
app.post('/api/follow/unfollow/:username', requireAuth, async (req, res) => { const target = await User.findOne({ where: { username: req.params.username } }); if (!target) return res.status(404).json({ error: 'Usuário não encontrado' }); await Follow.destroy({ where: { followerId: req.userId!, followingId: target.id } }); return res.json({ success: true, followersCount: await Follow.count({ where: { followingId: target.id } }) }); });
app.get('/api/follow/is-following/:username', requireAuth, async (req, res) => { const target = await User.findOne({ where: { username: req.params.username } }); return res.json({ following: !!target && !!await Follow.findOne({ where: { followerId: req.userId!, followingId: target.id } }) }); });

app.get('/api/notifications', requireAuth, async (req, res) => { const notifications = await Notification.findAll({ where: { userId: req.userId }, include: [{ model: User, as: 'actor', attributes: ['username', 'avatar'] }], order: [['createdAt', 'DESC']] }); return res.json(notifications); });
app.put('/api/notifications/read', requireAuth, async (req, res) => { await Notification.update({ isRead: true }, { where: { userId: req.userId } }); return res.json({ success: true }); });

app.get('/api/messages/people', requireAuth, async (req, res) => { const people = await User.findAll({ where: { id: { [Op.ne]: req.userId } }, attributes: ['id', 'username', 'avatar', 'bio'], limit: 30 }); return res.json(people); });
app.get('/api/messages/:userId', requireAuth, async (req, res) => { const otherId = Number(req.params.userId); const messages = await Message.findAll({ where: { [Op.or]: [{ senderId: req.userId, receiverId: otherId }, { senderId: otherId, receiverId: req.userId }] }, order: [['createdAt', 'ASC']], include: [{ model: User, as: 'sender', attributes: ['username', 'avatar'] }] }); return res.json(messages); });
app.post('/api/messages/:userId', requireAuth, async (req, res) => { const content = String(req.body.content ?? '').trim(); const receiverId = Number(req.params.userId); if (!content) return res.status(400).json({ error: 'Mensagem obrigatória' }); if (receiverId === req.userId || !await User.findByPk(receiverId)) return res.status(400).json({ error: 'Destinatário inválido' }); const message = await Message.create({ senderId: req.userId!, receiverId, content }); await message.reload({ include: [{ model: User, as: 'sender', attributes: ['username', 'avatar'] }] }); return res.status(201).json(message); });

app.get('*', (_req, res) => res.sendFile(clientEntry));

export default app;
