import type { Transaction } from 'sequelize';
import { Notification } from '../../../models/index.js';
import type { NotificationRecorder } from '../public.js';

export function createNotificationRecorder(transaction: Transaction): NotificationRecorder {
  return { async record(input) { await Notification.create(input, { transaction }); } };
}
