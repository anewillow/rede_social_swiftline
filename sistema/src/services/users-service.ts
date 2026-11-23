import { serviceResult, type ServiceInput, type ServiceResult } from '../types/service.js';
import { Follow, User } from '../models/index.js';
import { Op, literal } from 'sequelize';
import database from '../config/database.js';
import { publicUser, profileWithCounts, usersWithFollowing } from './user-presentation.js';
import { pageWindow } from '../http/pagination.js';

export async function searchUsers(req: ServiceInput): Promise<ServiceResult> {
  const query = String(req.query.q ?? '');
  const page = pageWindow(req, 'users:' + query);
  const users = await User.findAll({
    where: page.where({
      ...(query ? { username: { [Op.like]: `%${query}%` } } : {}),
      ...(req.userId ? { id: { [Op.ne]: req.userId } } : {}),
    }),
    attributes: ['id', 'username', 'avatar', 'bio', 'createdAt'],
    ...page.options,
  });
  if (req.apiVersion === 2) return serviceResult(page.wrap(await usersWithFollowing(page.take(users), req.userId), users), 200);
  return serviceResult(users, 200);
}

export async function findByUsername(req: ServiceInput): Promise<ServiceResult> {
  const user = await User.findOne({ where: { username: req.params.username } });
  if (!user) return serviceResult({ error: 'Usuário não encontrado' }, 404);
  return serviceResult(req.apiVersion === 2 ? await profileWithCounts(user, req.userId) : publicUser(user), 200);
}

export async function findById(req: ServiceInput): Promise<ServiceResult> {
  const user = await User.findByPk(Number(req.params.id));
  if (!user) return serviceResult({ error: 'Usuário não encontrado' }, 404);
  return serviceResult(req.apiVersion === 2 ? await profileWithCounts(user, req.userId) : publicUser(user), 200);
}

export async function listFollowers(req: ServiceInput): Promise<ServiceResult> {
  const user = await User.findOne({ where: { username: req.params.username } });
  if (!user) return serviceResult({ error: 'Usuário não encontrado' }, 404);
  if (req.apiVersion === 2) {
    const page = pageWindow(req, 'followers:' + user.id);
    const raw = await User.findAll({ where: page.where({ [Op.and]: [literal('EXISTS (SELECT 1 FROM Follows f WHERE f.followerId=User.id AND f.followingId=' + database.escape(user.id) + ')')] }), ...page.options });
    return serviceResult(page.wrap(await usersWithFollowing(page.take(raw), req.userId), raw));
  }
  const relations = await Follow.findAll({ where: { followingId: user.id } });
  const users = await User.findAll({
    where: { id: relations.map((relation) => relation.followerId) },
    attributes: ['id', 'username', 'avatar', 'bio'],
  });
  return serviceResult(users, 200);
}

export async function listFollowing(req: ServiceInput): Promise<ServiceResult> {
  const user = await User.findOne({ where: { username: req.params.username } });
  if (!user) return serviceResult({ error: 'Usuário não encontrado' }, 404);
  if (req.apiVersion === 2) {
    const page = pageWindow(req, 'following:' + user.id);
    const raw = await User.findAll({ where: page.where({ [Op.and]: [literal('EXISTS (SELECT 1 FROM Follows f WHERE f.followingId=User.id AND f.followerId=' + database.escape(user.id) + ')')] }), ...page.options });
    return serviceResult(page.wrap(await usersWithFollowing(page.take(raw), req.userId), raw));
  }
  const relations = await Follow.findAll({ where: { followerId: user.id } });
  const users = await User.findAll({
    where: { id: relations.map((relation) => relation.followingId) },
    attributes: ['id', 'username', 'avatar', 'bio'],
  });
  return serviceResult(users, 200);
}
