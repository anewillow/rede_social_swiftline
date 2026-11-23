import { Op, type Transaction } from 'sequelize';
import { Message } from '../../../models/index.js';
import type { MessagesAccountRemoval } from '../public.js';

export function createMessagesAccountRemoval(transaction: Transaction): MessagesAccountRemoval {
  return {
    async removeAccountData(userId) {
      await Message.destroy({
        where: { [Op.or]: [{ senderId: userId }, { receiverId: userId }] },
        transaction,
      });
    },
  };
}
