import type { Transaction } from 'sequelize';
import { User } from '../../../models/index.js';
import type { AccountDeletionReader } from '../application/account-deletion-access.js';
import type { AccountsRemoval } from '../public.js';
import { enqueueImageCleanup } from '../../../infrastructure/storage/file-cleanup.js';

export const accountDeletionReader: AccountDeletionReader = {
  async findById(userId) {
    const user = await User.findByPk(userId, { attributes: ['id', 'password', 'avatar', 'cover'] });
    return user ? {
      id: user.id,
      passwordHash: user.password,
      avatar: user.avatar ?? null,
      cover: user.cover ?? null,
    } : null;
  },
};

export function createAccountsRemoval(transaction: Transaction): AccountsRemoval {
  return {
    async removeAccount(userId) {
      const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
      if (user) {
        await enqueueImageCleanup(user.avatar, transaction, { id: user.id, kind: 'avatar' });
        await enqueueImageCleanup(user.cover, transaction, { id: user.id, kind: 'cover' });
      }
      await User.destroy({ where: { id: userId }, transaction });
    },
  };
}
