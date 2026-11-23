import { useEffect, useState } from 'react';
import { Avatar } from '../components/common/Avatar';
import { Empty } from '../components/common/Empty';
import { notificationsApi } from '../services/notifications-api';
import { usePagedList } from '../shared/use-paged-list';
import { AsyncStatus, MoreItems } from '../shared/AsyncStatus';
import { messageOf } from '../shared/api';

export function Notifications() {
  const list = usePagedList('notifications', (signal, cursor) => notificationsApi.list(signal, cursor));
  const [readError, setReadError] = useState('');
  async function markRead() { try { await notificationsApi.markAsRead(); setReadError(''); } catch (error) { setReadError(messageOf(error)); } }
  useEffect(() => { if (!list.loading && !list.error) void markRead(); }, [list.loading, list.error]);
  return <section className="page-section"><p className="eyebrow">NOTIFICAÇÕES</p><h1>O que aconteceu.</h1>
    <AsyncStatus loading={list.loading} error={list.error} retry={list.retry}/>
    <AsyncStatus loading={false} error={readError} retry={markRead}/>
    {!!list.items.length && <div className="notification-list">{list.items.map((item) => <article className="notification" key={item.id}>
      <Avatar person={item.actor}/><p><strong>{item.actor?.username}</strong>{' '}{item.message.replace(`${item.actor?.username ?? ''} `, '')}<small>{new Date(item.createdAt).toLocaleString('pt-BR')}</small></p>
    </article>)}</div>}
    <MoreItems cursor={list.nextCursor} loading={list.loading} load={list.loadMore}/>
    {!list.loading && !list.error && !list.items.length && <Empty title="Tudo tranquilo por aqui." description="Curtidas, seguidores e respostas aparecerão aqui."/>}
  </section>;
}
