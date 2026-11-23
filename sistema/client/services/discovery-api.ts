import { request } from './api';
import { decodeShape, decodePage, decodeUser, decodePost, decodeObject } from '../../shared/contracts/index';
import type { NewsItem } from '../types/index';

export const discoveryApi = {
  search: (query: string, signal: AbortSignal, cursors: { usersCursor?: string; postsCursor?: string } = {}) => request('/api/v2/search?' + new URLSearchParams({ q: query, ...cursors }), decodeShape({ users: decodePage(decodeUser), posts: decodePage(decodePost) }), { signal }),
  getNews: (signal?: AbortSignal) => request('/api/v2/news?live=' + Date.now(), (value) => {
    const result = decodeObject(value);
    if (!Array.isArray(result.news) || result.news.some((item) => !item || typeof item !== 'object' || ['id', 'title', 'url', 'description', 'publishedAt', 'source'].some((key) => typeof item[key] !== 'string') || !/^https?:\/\//.test(item.url) || !Number.isFinite(Date.parse(item.publishedAt)) || item.image !== null && typeof item.image !== 'string')) throw new Error('Notícias inválidas');
    return { news: result.news as NewsItem[], updatedAt: typeof result.updatedAt === 'string' ? result.updatedAt : undefined, source: typeof result.source === 'string' ? result.source : undefined };
  }, { cache: 'no-store', signal }, false),
};
