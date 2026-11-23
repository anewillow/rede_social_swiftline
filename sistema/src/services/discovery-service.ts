import { serviceResult, type ServiceInput, type ServiceResult } from '../types/service.js';
import { Post, User } from '../models/index.js';
import { Op, literal } from 'sequelize';
import database from '../config/database.js';
import { publicUser, usersWithFollowing } from './user-presentation.js';
import { pageWindow } from '../http/pagination.js';
import { postsWithActivity } from './post-activity-service.js';
import { globalTaylorTrends } from './trends-service.js';
import { TaylorNewsService } from './news-service.js';
import { authorDirectory } from '../bootstrap/author-directory.js';

const taylorNewsService = new TaylorNewsService();

export async function search(req: ServiceInput): Promise<ServiceResult> {
  const query = String(req.query.q ?? '').trim();
  if (req.apiVersion === 2) {
    const usersPage = pageWindow(req, 'search-users:' + query, 'DESC', 'usersCursor');
    const postsPage = pageWindow(req, 'search-posts:' + query, 'DESC', 'postsCursor');
    if (query.length < 2) return serviceResult({ users: { items: [], nextCursor: null }, posts: { items: [], nextCursor: null } });
    const [users, posts] = await Promise.all([
      User.findAll({ where: usersPage.where({ username: { [Op.like]: `%${query}%` } }), ...usersPage.options }),
      Post.findAll({ where: postsPage.where({ [Op.or]: [{ content: { [Op.like]: `%${query}%` } }, { [Op.and]: [literal('EXISTS (SELECT 1 FROM Users a WHERE a.id=Post.userId AND a.username LIKE ' + database.escape('%' + query + '%') + ')')] }] }), ...postsPage.options }),
    ]);
    return serviceResult({ users: usersPage.wrap(await usersWithFollowing(usersPage.take(users), req.userId), users), posts: postsPage.wrap(await postsWithActivity(postsPage.take(posts), req.userId), posts) });
  }
  if (query.length < 2) return serviceResult({ users: [], posts: [] }, 200);
  const matchingAuthorIds = await authorDirectory.findIdsByName(query);
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
          { userId: { [Op.in]: matchingAuthorIds } },
        ],
      },
      order: [['createdAt', 'DESC']],
      limit: 8,
    }),
  ]);
  return serviceResult({
    users: users.map(publicUser),
    posts: await postsWithActivity(posts, req.userId),
  }, 200);
}

export async function getTrends(req: ServiceInput): Promise<ServiceResult> {
  try {
    return serviceResult({
      trends: await globalTaylorTrends(),
      updatedAt: new Date().toISOString(),
      period: 'Últimos 7 dias',
      source: 'Wikimedia Pageviews',
    }, 200);
  } catch {
    return serviceResult({ trends: [], error: 'Os dados globais estão temporariamente indisponíveis.' }, 503);
  }
}

export async function getNews(req: ServiceInput): Promise<ServiceResult> {
  try {
    const news = await taylorNewsService.getLatestNews();
    return serviceResult({
      news,
      updatedAt: taylorNewsService.updatedAt ?? new Date().toISOString(),
      refreshAfterSeconds: 300,
      source: 'GDELT Context 2.0',
    }, 200);
  } catch {
    return serviceResult({ news: [], error: 'As notícias estão temporariamente indisponíveis.' }, 503);
  }
}
