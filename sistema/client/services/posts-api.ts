import type { ContentInput, PollInput } from '../../shared/contracts/index';
import { request, jsonRequest, pageUrl } from './api';
import { decodePage, decodePost, decodeShape, decodeString, decodeNumber, decodeBoolean, decodeObject, decodePoll } from '../../shared/contracts/index';
const postResult = decodeShape({ post: decodePost });
const messageResult = decodeShape({ message: decodeString });

export const postsApi = {
  get: (id: number, signal?: AbortSignal) => request('/api/v2/posts/' + id, decodePost, { signal }),
  list: (following = false, signal?: AbortSignal, cursor?: string | null) => request(pageUrl(following ? '/api/v2/posts?feed=following' : '/api/v2/posts', cursor), decodePage(decodePost), { signal }),
  forUser: (username: string, signal?: AbortSignal, cursor?: string | null) => request(pageUrl('/api/v2/posts?username=' + encodeURIComponent(username), cursor), decodePage(decodePost), { signal }),
  saved: (signal?: AbortSignal, cursor?: string | null) => request(pageUrl('/api/v2/posts/saved', cursor), decodePage(decodePost), { signal }),
  create: (body: FormData) => request('/api/v2/posts', decodePost, { method: 'POST', body }),
  update: (id: number, data: ContentInput) => jsonRequest('/api/v2/posts/' + id, 'PUT', data, postResult),
  remove: (id: number) => request('/api/v2/posts/' + id, messageResult, { method: 'DELETE' }),
  recordViews: (data: { postIds: number[] }) => jsonRequest('/api/v2/posts/views', 'POST', data, decodeShape({ views: (value) => Object.fromEntries(Object.entries(decodeObject(value)).map(([key, count]) => [key, decodeNumber(count)])) })),
  like: (id: number, liked: boolean) => jsonRequest('/api/v2/posts/' + id + '/like', 'POST', { liked }, decodeShape({ likes: decodeNumber, liked: decodeBoolean })),
  repost: (id: number, reposted: boolean) => jsonRequest('/api/v2/posts/' + id + '/repost', 'POST', { reposted }, decodeShape({ reposts: decodeNumber, reposted: decodeBoolean })),
  save: (id: number, saved: boolean) => jsonRequest('/api/v2/posts/' + id + '/save', 'POST', { saved }, decodeShape({ saved: decodeBoolean })),
  share: (id: number) => request('/api/v2/posts/' + id + '/share', decodeShape({ shares: decodeNumber }), { method: 'POST' }),
  vote: (id: number, data: { optionId: number }) => jsonRequest('/api/v2/posts/' + id + '/poll-vote', 'POST', data, decodeShape({ poll: decodePoll })),
  updatePoll: (id: number, data: PollInput) => jsonRequest('/api/v2/posts/' + id + '/poll', 'PUT', data, postResult),
  deletePoll: (id: number) => request('/api/v2/posts/' + id + '/poll', messageResult, { method: 'DELETE' }),
};
