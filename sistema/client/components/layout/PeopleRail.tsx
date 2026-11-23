import { useEffect, useState } from 'react';
import { Avatar } from '../common/Avatar';
import type { User } from '../../types/index';
import { usersApi, FOLLOWING_CHANGED_EVENT } from '../../services/users-api';
import { usePagedList } from '../../shared/use-paged-list';
import { AsyncStatus } from '../../shared/AsyncStatus';
import { messageOf } from '../../shared/api';

export function PeopleRail({ openProfile }: { openProfile: (username: string) => void }) {
  const list = usePagedList('suggested-people', (signal) => usersApi.search(undefined, signal, undefined, 4));
  const [busy, setBusy] = useState<number | null>(null), [error, setError] = useState('');
  useEffect(() => {
    const changed = (event: Event) => { const result = (event as CustomEvent<{ userId: number; following: boolean }>).detail; list.setItems((items) => items.map((person) => person.id === result.userId ? { ...person, following: result.following } : person)); };
    addEventListener(FOLLOWING_CHANGED_EVENT, changed); return () => removeEventListener(FOLLOWING_CHANGED_EVENT, changed);
  }, []);
  const follow = async (person: User) => {
    if (busy !== null) return; setBusy(person.id); setError('');
    try { await usersApi.setFollowing(person.username, !person.following, person.id); } catch (failure) { setError(messageOf(failure)); } finally { setBusy(null); }
  };
  return <aside className="people-rail"><section><h2>Quem seguir</h2>
    <AsyncStatus loading={list.loading} error={list.error} retry={list.retry}/>
    {error && <p className="api-status" role="alert">{error}</p>}
    {list.items.map((person) => <article key={person.id}>
      <button onClick={() => openProfile(person.username)}><Avatar person={person}/><span><strong>{person.username}</strong><small>@{person.username.replace(/\s/g, '').toLowerCase()}</small></span></button>
      <button className={person.following ? 'follow-mini following' : 'follow-mini'} disabled={busy !== null} onClick={() => void follow(person)}>{person.following ? 'Seguindo' : 'Seguir'}</button>
    </article>)}
    {!list.loading && !list.error && !list.items.length && <p className="rail-empty">Ainda não há outras pessoas para mostrar.</p>}
  </section></aside>;
}
