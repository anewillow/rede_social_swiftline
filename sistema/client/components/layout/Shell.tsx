import { Bell, Bookmark, CircleHelp, Home, LogOut, MessageSquare, Search, Settings, Users } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { RightRail } from './RightRail';
import type { User, Page } from '../../types/index';

export function Shell({
  user,
  page,
  go,
  logout,
  children,
}: {
  user: User;
  page: Page;
  go: (page: Page) => void;
  logout: () => void;
  children: React.ReactNode;
}) {
  const nav = [
    { id: 'feed', label: 'Início', icon: Home },
    { id: 'network', label: 'Explorar', icon: Search },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'messages', label: 'Mensagens', icon: MessageSquare },
    { id: 'saved', label: 'Salvos', icon: Bookmark },
    { id: 'profile', label: 'Perfil', icon: Users },
    { id: 'help', label: 'Ajuda', icon: CircleHelp },
  ] as const;
  const openPublicProfile = () => {
    history.pushState({}, '', `/profile.html?user=${encodeURIComponent(user.username)}`);
    dispatchEvent(new PopStateEvent('popstate'));
  };
  const openProfile = (username: string) => {
    history.pushState({}, '', `/profile.html?user=${encodeURIComponent(username)}`);
    dispatchEvent(new PopStateEvent('popstate'));
  };
  const openComposer = () => {
    go('feed');
    requestAnimationFrame(() => document.getElementById('post-text')?.focus());
  };
  return (
    <div
      className={`app-shell${page === 'messages' ? ' messages-shell' : ''}${page === 'help' ? ' help-shell' : ''}`}
    >
      <aside className="sidebar">
        <div>
          <button className="brand brand-button" onClick={() => go('feed')}>
            swiftline
          </button>
          <nav>
            {nav.map(({ id, label, icon: Icon }) => (
              <button key={id} className={page === id ? 'active' : ''} onClick={() => go(id)}>
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <button className="sidebar-post" onClick={openComposer}>
            Postar
          </button>
        </div>
        <div className="account-area">
          <button className="account-link" onClick={openPublicProfile}>
            <Avatar person={user} />
            <span>
              {user.username}
              <small>@{user.username.replace(/\s/g, '').toLowerCase()}</small>
            </span>
          </button>
          <button
            className={`settings-link ${page === 'settings' ? 'active' : ''}`}
            aria-label="Configurações"
            onClick={() => go('settings')}
          >
            <Settings size={18} />
          </button>
          <button className="logout-link" aria-label="Sair" onClick={logout}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <button className="mobile-brand brand-button brand" onClick={() => go('feed')}>
            swiftline
          </button>
          <button className="icon-button" aria-label="Sair" onClick={logout}>
            <LogOut size={19} />
          </button>
        </header>
        {children}
      </main>
      {page !== 'messages' && page !== 'help' && <RightRail openProfile={openProfile} />}
    </div>
  );
}
