import { serviceResult, type ServiceInput, type ServiceResult } from '../types/service.js';
import { Notification, User } from '../models/index.js';
import { pageWindow } from '../http/pagination.js';

export async function listNotifications(req: ServiceInput): Promise<ServiceResult> {
  const page = pageWindow(req, 'notifications');
  const notifications = await Notification.findAll({
    where: page.where({ userId: req.userId }),
    include: [{ model: User, as: 'actor', attributes: ['username', 'avatar'] }],
    order: [['createdAt', 'DESC']],
    ...page.options,
  });
  return serviceResult(page.wrap(page.take(notifications), notifications), 200);
}

export async function markAsRead(req: ServiceInput): Promise<ServiceResult> {
  await Notification.update({ isRead: true }, { where: { userId: req.userId } });
  return serviceResult({ success: true }, 200);
}
