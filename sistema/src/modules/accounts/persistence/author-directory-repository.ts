import { Op } from 'sequelize';
import { User } from '../../../models/index.js';
import type { AuthorDirectory } from '../public.js';

export const authorDirectoryRepository: AuthorDirectory = {
  async findByIds(userIds) {
    const ids = [...new Set(userIds)];
    if (!ids.length) return [];
    const users = await User.findAll({
      where: { id: ids }, attributes: ['id', 'username', 'avatar'],
    });
    return users.map((user) => ({ id: user.id, username: user.username, avatar: user.avatar ?? null }));
  },
  async findIdsByName(query) {
    const users = await User.findAll({
      where: { username: { [Op.like]: `%${query}%` } }, attributes: ['id'],
    });
    return users.map((user) => user.id);
  },
};
