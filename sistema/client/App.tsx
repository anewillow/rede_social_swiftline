import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Auth } from './pages/Auth';
import { Feed } from './pages/Feed';
import { SavedPosts } from './pages/SavedPosts';
import { Network } from './pages/Network';
import { Messages } from './pages/Messages';
import { Notifications } from './pages/Notifications';
import { AccountSettings } from './pages/AccountSettings';
import { Profile } from './pages/Profile';
import { Help } from './pages/Help';
import { SwiftProfile } from './pages/SwiftProfile';
import { Shell } from './components/layout/Shell';
import { routePage, PAGE_URLS } from './utils/navigation';
import type { User, Page } from './types/index';
import { HIGH_CONTRAST_KEY } from './config/constants';
import { authApi } from './services/auth-api';
import { PostsProvider } from './features/posts';
import { decodeUser } from '../shared/contracts/index';
import { isAbort, messageOf, SESSION_INVALID_EVENT } from './shared/api';
import { AsyncStatus } from './shared/AsyncStatus';

export function App() {
  const [highContrast, setHighContrast] = useState(
    () => localStorage.getItem(HIGH_CONTRAST_KEY) === 'true',
  );
  const [user, setUser] = useState<User | null>(() => {
    if (!localStorage.getItem('token')) return null;
    try { return decodeUser(JSON.parse(localStorage.getItem('user') || 'null')); } catch { return null; }
  });
  const intendedRoute = useRef(/\/(login|register)\.html$/.test(location.pathname) ? '/feed.html' : location.pathname + location.search + location.hash);
  const [sessionError, setSessionError] = useState('');
  const [page, setPage] = useState<Page>(() => routePage(location.pathname));
  const [profileRoute, setProfileRoute] = useState(() => location.search);
  useLayoutEffect(() => {
    document.documentElement.dataset.contrast = highContrast ? 'high' : 'standard';
    localStorage.setItem(HIGH_CONTRAST_KEY, String(highContrast));
  }, [highContrast]);
  const go = (next: Page) => {
    if (next !== 'userProfile') {
      history.pushState({}, '', PAGE_URLS[next]);
      setPage(next);
    }
  };
  const openProfile = (username: string, userId?: number) => {
    history.pushState(
      {},
      '',
      userId ? `/profile.html?id=${userId}` : `/profile.html?user=${encodeURIComponent(username)}`,
    );
    setProfileRoute(location.search);
    setPage('userProfile');
  };
  useEffect(() => {
    const listener = () => {
      setProfileRoute(location.search);
      setPage(routePage(location.pathname));
    };
    addEventListener('popstate', listener);
    return () => removeEventListener('popstate', listener);
  }, []);
  const checkSession = useCallback(async (signal?: AbortSignal) => {
    const token = localStorage.getItem('token'); if (!token) return;
    setSessionError('');
    try {
      const currentUser = await authApi.getCurrentUser(signal);
      if (!signal?.aborted && token === localStorage.getItem('token')) {
          localStorage.setItem('user', JSON.stringify(currentUser));
          setUser(currentUser);
      }
    } catch (error) { if (!signal?.aborted && !isAbort(error)) setSessionError(messageOf(error)); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void checkSession(controller.signal); return () => controller.abort(); }, [checkSession]);
  useEffect(() => {
    const expired = () => { intendedRoute.current = location.pathname + location.search + location.hash; setUser(null); setSessionError('Sua sessão expirou. Entre novamente.'); history.replaceState({}, '', '/login.html'); };
    addEventListener(SESSION_INVALID_EVENT, expired); return () => removeEventListener(SESSION_INVALID_EVENT, expired);
  }, []);
  if (!user)
    return (
      <Auth
        notice={sessionError}
        retrySession={localStorage.getItem('token') ? () => void checkSession() : undefined}
        onLogin={(nextUser) => {
          localStorage.setItem('user', JSON.stringify(nextUser));
          setUser(nextUser);
          setSessionError('');
          history.replaceState({}, '', intendedRoute.current);
          setProfileRoute(location.search); setPage(routePage(location.pathname));
        }}
      />
    );
  const logout = () => {
    intendedRoute.current = '/feed.html'; setSessionError('');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    history.pushState({}, '', '/login.html');
  };
  return (
    <PostsProvider key={user.id}>
    <Shell user={user} page={page} go={go} logout={logout}>
      <AsyncStatus loading={false} error={sessionError} retry={() => void checkSession()} />
      {page === 'feed' && <Feed user={user} openProfile={openProfile} />}{' '}
      {page === 'network' && <Network openProfile={openProfile} />}{' '}
      {page === 'messages' && <Messages />} {page === 'notifications' && <Notifications />}{' '}
      {page === 'saved' && <SavedPosts user={user} openProfile={openProfile} />}{' '}
      {page === 'profile' && (
        <Profile
          user={user}
          save={(next) => {
            localStorage.setItem('user', JSON.stringify(next));
            setUser(next);
          }}
        />
      )}
      {page === 'settings' && (
        <AccountSettings
          user={user}
          go={go}
          onDeleted={logout}
          highContrast={highContrast}
          onHighContrastChange={setHighContrast}
        />
      )}
      {page === 'help' && <Help go={go} />}
      {page === 'userProfile' && <SwiftProfile key={profileRoute} viewer={user} go={go} openProfile={openProfile} />}
    </Shell>
    </PostsProvider>
  );
}
