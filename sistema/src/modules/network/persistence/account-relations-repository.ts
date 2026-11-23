import { Op, type Transaction } from 'sequelize';
import { Follow } from '../../../models/index.js';
import type { NetworkAccountRemoval } from '../public.js';

export function createNetworkAccountRemoval(transaction: Transaction): NetworkAccountRemoval {
  return {
    async removeAccountData(userId) {
      await Follow.destroy({
        where: { [Op.or]: [{ followerId: userId }, { followingId: userId }] },
        transaction,
      });
    },
  };
}
