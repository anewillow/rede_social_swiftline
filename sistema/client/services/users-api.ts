import { request, jsonRequest, pageUrl } from './api';
import { decodePage, decodeUser, decodeShape, decodeBoolean, decodeNumber } from '../../shared/contracts/index';
export const FOLLOWING_CHANGED_EVENT = 'swiftline:following-changed';

export const usersApi = {
  search: (query?: string, signal?: AbortSignal, cursor?: string | null, limit?: number) => request(pageUrl('/api/v2/users/search' + (query === undefined ? '' : '?q=' + encodeURIComponent(query)), cursor, limit), decodePage(decodeUser), { signal }),
  getProfile: (id: string | null, username: string, signal?: AbortSignal) => request(id ? '/api/v2/users/id/' + id : '/api/v2/users/username/' + encodeURIComponent(username), decodeUser, { signal }),
  getFollowers: (username: string, signal?: AbortSignal, cursor?: string | null) => request(pageUrl('/api/v2/users/' + encodeURIComponent(username) + '/followers', cursor), decodePage(decodeUser), { signal }),
  getFollowing: (username: string, signal?: AbortSignal, cursor?: string | null) => request(pageUrl('/api/v2/users/' + encodeURIComponent(username) + '/following', cursor), decodePage(decodeUser), { signal }),
  isFollowing: (username: string) => request('/api/v2/follow/is-following/' + encodeURIComponent(username), decodeShape({ following: decodeBoolean })),
  async setFollowing(username: string, following: boolean, userId?: number) {
    const result = await jsonRequest('/api/v2/follow/follow/' + encodeURIComponent(username), 'POST', { following }, decodeShape({ success: decodeBoolean, following: decodeBoolean, followersCount: decodeNumber }));
    dispatchEvent(new CustomEvent(FOLLOWING_CHANGED_EVENT, { detail: { ...result, userId, username } })); return result;
  },
};
