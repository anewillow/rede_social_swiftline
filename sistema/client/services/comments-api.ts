import type { ContentInput } from '../../shared/contracts/index';
import { request, jsonRequest, pageUrl } from './api';
import { decodePage, decodeComment, decodeShape, decodeString } from '../../shared/contracts/index';

export const commentsApi = {
  list: (postId: number, signal?: AbortSignal, cursor?: string | null) => request(pageUrl('/api/v2/posts/' + postId + '/comments', cursor), decodePage(decodeComment), { signal }),
  create: (postId: number, data: ContentInput) => jsonRequest('/api/v2/posts/' + postId + '/comments', 'POST', data, decodeComment),
  update: (id: number, data: ContentInput) => jsonRequest('/api/v2/posts/comments/' + id, 'PUT', data, decodeComment),
  remove: (id: number) => request('/api/v2/posts/comments/' + id, decodeShape({ message: decodeString }), { method: 'DELETE' }),
};
