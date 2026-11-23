import { request, pageUrl } from './api';
import { decodePage, decodeNotification, decodeShape, decodeBoolean } from '../../shared/contracts/index';

export const notificationsApi = {
  list: (signal?: AbortSignal, cursor?: string | null) => request(pageUrl('/api/v2/notifications', cursor), decodePage(decodeNotification), { signal }),
  markAsRead: () => request('/api/v2/notifications/read', decodeShape({ success: decodeBoolean }), { method: 'PUT' }),
};
