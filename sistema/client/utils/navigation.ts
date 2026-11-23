import type { Page } from '../types/index';
export const PAGE_URLS: Record<Exclude<Page, 'userProfile'>, string> = {
  feed: '/feed.html', network: '/find-people.html', messages: '/messages.html', notifications: '/notifications.html',
  saved: '/saved.html', profile: '/edit-profile.html', help: '/help.html', settings: '/settings.html',
};
export function routePage(path: string, search = location.search): Page {
  const pathname = path.split('?')[0];
  const params = new URLSearchParams(search);
  if (pathname === '/profile.html' && (params.has('id') || params.has('user'))) return 'userProfile';
  if (pathname === '/profile.html') return 'profile';
  return (Object.entries(PAGE_URLS).find(([, url]) => url === pathname)?.[0] as Page | undefined) ?? 'feed';
}
