import * as service from '../services/notifications-service.js';
import { handle } from './handle.js';

export const listNotifications = handle(service.listNotifications);
export const markAsRead = handle(service.markAsRead);
