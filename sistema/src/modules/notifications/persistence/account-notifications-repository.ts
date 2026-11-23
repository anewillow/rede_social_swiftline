import { Op, type Transaction } from 'sequelize';
import { Notification } from '../../../models/index.js';
import type { NotificationsAccountRemoval } from '../public.js';

export function createNotificationsAccountRemoval(transaction: Transaction): NotificationsAccountRemoval {
  return {
    async removeAccountData(userId) {
      await Notification.destroy({
        where: { [Op.or]: [{ userId }, { actorId: userId }] },
        transaction,
      });
    },
  };
}
