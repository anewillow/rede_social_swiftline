import { useEffect, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { Avatar } from '../components/common/Avatar';
import { Empty } from '../components/common/Empty';
import type { User } from '../types/index';
import { usersApi, FOLLOWING_CHANGED_EVENT } from '../services/users-api';
import { usePagedList } from '../shared/use-paged-list';
import { AsyncStatus, MoreItems } from '../shared/AsyncStatus';
import { messageOf } from '../shared/api';

export function Network({ openProfile }: { openProfile: (username: string) => void }) {
  const [query, setQuery] = useState(sessionStorage.getItem('networkQuery') || '');
  const [term, setTerm] = useState(query);
  const list = usePagedList('network:' + term, (signal, cursor) => usersApi.search(term, signal, cursor));
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const changed = (event: Event) => { const result = (event as CustomEvent<{ userId: number; following: boolean }>).detail; list.setItems((items) => items.map((person) => person.id === result.userId ? { ...person, following: result.following } : person)); };
    addEventListener(FOLLOWING_CHANGED_EVENT, changed); return () => removeEventListener(FOLLOWING_CHANGED_EVENT, changed);
  }, []);
  async function toggle(person: User) {
    if (busy !== null) return; setBusy(person.id); setError('');
    try { await usersApi.setFollowing(person.username, !person.following, person.id); }
    catch (failure) { setError(messageOf(failure)); } finally { setBusy(null); }
  }
  return <section className="page-section">
    <p className="eyebrow">ENCONTRAR PESSOAS</p><h1>Quem você quer acompanhar?</h1>
    <form className="directory-search" onSubmit={(event) => { event.preventDefault(); sessionStorage.setItem('networkQuery', query); if (term === query.trim()) void list.reload(); else setTerm(query.trim()); }}>
      <Search size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busque pelo nome"/><button>Buscar</button>
    </form>
    <AsyncStatus loading={list.loading} error={list.error} retry={list.retry}/>
    {error && <p role="alert" className="api-status">{error}</p>}
    <div className="people-grid">{list.items.map((person) => <article className="person-card" key={person.id}>
      <button className="person-link" onClick={() => openProfile(person.username)}><Avatar person={person} size="large"/></button>
      <button className="person-link author-link" onClick={() => openProfile(person.username)}>{person.username}</button>
      <p>{person.bio || 'Compartilhando momentos na Swiftline.'}</p>
      <button className={person.following ? 'soft-button following' : 'soft-button'} disabled={busy !== null} onClick={() => void toggle(person)}><UserPlus size={16}/>{person.following ? 'Seguindo' : 'Seguir'}</button>
    </article>)}</div>
    <MoreItems cursor={list.nextCursor} loading={list.loading} load={list.loadMore}/>
    {!list.loading && !list.error && !list.items.length && <Empty title="Encontre alguém para seguir." description="Busque por um nome e comece a montar a sua timeline."/>}
  </section>;
}
