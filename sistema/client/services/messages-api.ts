import type { ContentInput } from '../../shared/contracts/index';
import { request, jsonRequest, pageUrl } from './api';
import { decodePage, decodeUser, decodeMessage } from '../../shared/contracts/index';

export const messagesApi = {
  searchPeople: (query: string, signal?: AbortSignal, cursor?: string | null) => request(pageUrl('/api/v2/messages/people' + (query ? '?q=' + encodeURIComponent(query) : ''), cursor), decodePage(decodeUser), { signal }),
  list: (id: number, signal?: AbortSignal, cursor?: string | null) => request(pageUrl('/api/v2/messages/' + id, cursor), decodePage(decodeMessage), { signal }),
  send: (id: number, data: ContentInput) => jsonRequest('/api/v2/messages/' + id, 'POST', data, decodeMessage),
};
