import { Op, type Transaction } from 'sequelize';
import { User } from '../../../models/index.js';
import type { InteractionAccounts, PublicAuthor } from '../public.js';

export function createInteractionAccounts(transaction: Transaction): InteractionAccounts {
  const publicData = (user: User | null): PublicAuthor | null => user ? { id: user.id, username: user.username, avatar: user.avatar } : null;
  return {
    async findById(id) { return publicData(await User.findByPk(id, { transaction })); },
    async findByUsername(username) { return publicData(await User.findOne({ where: { username }, transaction })); },
    async lockAccounts(ids) {
      await User.findAll({ where: { id: { [Op.in]: [...new Set(ids)] } }, order: [['id', 'ASC']], attributes: ['id'], transaction, lock: transaction.LOCK.UPDATE });
    },
  };
}
