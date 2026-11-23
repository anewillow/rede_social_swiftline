import type { Transaction } from 'sequelize';
import { Follow } from '../../../models/index.js';
import type { NetworkInteractions } from '../public.js';

export function createNetworkInteractions(transaction: Transaction): NetworkInteractions {
  return {
    async follow(userId, targetId, desired = true) {
      const where = { followerId: userId, followingId: targetId };
      const existing = await Follow.findOne({ where, transaction, lock: transaction.LOCK.UPDATE });
      if (!desired) { if (existing) await existing.destroy({ transaction }); return false; }
      if (existing) return false;
      await Follow.create(where, { transaction });
      return true;
    },
    async countFollowers(targetId) { return Follow.count({ where: { followingId: targetId }, transaction }); },
  };
}
