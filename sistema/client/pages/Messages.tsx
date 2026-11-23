import { FormEvent, useEffect, useRef, useState } from 'react';
import { MessageSquare, Search, Send, X } from 'lucide-react';
import { Avatar } from '../components/common/Avatar';
import type { User } from '../types/index';
import type { MessageView } from '../../shared/contracts/index';
import { LIMITS, codePoints } from '../../shared/contracts/index';
import { messagesApi } from '../services/messages-api';
import { usePagedList } from '../shared/use-paged-list';
import { AsyncStatus, MoreItems } from '../shared/AsyncStatus';
import { isAbort, messageOf } from '../shared/api';

const merge = (items: MessageView[]) => [...new Map(items.map((item) => [item.id, item])).values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id);
export function Messages() {
  const [peopleQuery, setPeopleQuery] = useState('');
  const people = usePagedList('message-people:' + peopleQuery.trim(), (signal, cursor) => messagesApi.searchPeople(peopleQuery.trim(), signal, cursor));
  const [selected, setSelected] = useState<User | null>(null);
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const [items, setItems] = useState<MessageView[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [content, setContent] = useState('');
  const [sendingTo, setSendingTo] = useState<Set<number>>(() => new Set());
  const sending = Boolean(selected && sendingTo.has(selected.id));
  const active = useRef<AbortController | null>(null), failedCursor = useRef<string | null>(null);
  async function load(id: number, cursor: string | null = null) {
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setLoading(true); setError(''); failedCursor.current = cursor;
    try {
      const result = await messagesApi.list(id, controller.signal, cursor);
      if (controller.signal.aborted || selectedRef.current?.id !== id) return;
      setItems((current) => merge([...result.items, ...current])); setNextCursor(result.nextCursor);
    } catch (failure) { if (!controller.signal.aborted && selectedRef.current?.id === id && !isAbort(failure)) setError(messageOf(failure)); }
    finally { if (!controller.signal.aborted && selectedRef.current?.id === id) setLoading(false); }
  }
  useEffect(() => {
    if (selected) void load(selected.id);
    return () => active.current?.abort();
  }, [selected?.id]);
  function open(person: User) { if (selected?.id === person.id) return; selectedRef.current = person; setSelected(person); setItems([]); setNextCursor(null); setContent(''); setError(''); }
  const send = async (event: FormEvent) => {
    event.preventDefault(); if (!selected || !content.trim() || sending) return;
    const id = selected.id, value = content; setSendingTo((current) => new Set([...current, id])); setError('');
    try {
      const message = await messagesApi.send(id, { content: value });
      if (selectedRef.current?.id === id) { setItems((current) => merge([...current, message])); setContent(''); }
    } catch (failure) { if (selectedRef.current?.id === id) setError(messageOf(failure)); }
    finally { setSendingTo((current) => { const next = new Set(current); next.delete(id); return next; }); }
  };
  return <section className="page-section messages-page">
    <header className="messages-page-title"><span aria-hidden="true"><MessageSquare size={18}/></span><div><small>MENSAGENS</small><h1>Conversas privadas</h1></div></header>
    <div className="messages-layout"><aside className="conversation-sidebar">
      <header className="conversation-sidebar-header"><div className="conversation-sidebar-title"><strong>Conversas</strong><small>{people.loading ? 'Aguarde...' : `${people.items.length} contatos`}</small></div>
        <label className="conversation-search"><Search size={15}/><input type="search" value={peopleQuery} onChange={(event) => setPeopleQuery(event.target.value)} placeholder="Pesquisar conversas" aria-label="Buscar pessoa nas mensagens" autoComplete="off"/>
          {peopleQuery && <button type="button" className="conversation-search-clear" onClick={() => setPeopleQuery('')} aria-label="Limpar busca"><X size={14}/></button>}
        </label>
      </header>
      <AsyncStatus loading={people.loading} error={people.error} retry={people.retry}/>
      <div className="conversation-list">{people.items.map((person) => <button className={selected?.id === person.id ? 'selected' : ''} onClick={() => open(person)} key={person.id}>
        <Avatar person={person}/><span className="conversation-person"><strong>{person.username}</strong><small>{person.bio || 'Enviar uma mensagem'}</small></span>
      </button>)}
        {!people.loading && !people.error && !people.items.length && <div className="conversation-list-message"><Search size={18}/><strong>{peopleQuery.trim() ? 'Ninguém encontrado' : 'Nenhum contato disponível'}</strong><small>Tente buscar outro nome.</small></div>}
      </div><MoreItems cursor={people.nextCursor} loading={people.loading} load={people.loadMore}/>
    </aside><div className="chat-panel">{selected ? <>
      <header><Avatar person={selected}/><span className="chat-person"><strong>{selected.username}</strong><small>Conversa privada</small></span></header>
      <AsyncStatus loading={loading} error={error} retry={() => load(selected.id, failedCursor.current)}/>
      <div className="message-list"><MoreItems cursor={nextCursor} loading={loading} load={() => load(selected.id, nextCursor)} label="Mensagens anteriores"/>
        {items.map((item) => <p className={item.senderId === selected.id ? 'from-them' : 'from-me'} key={item.id}>{item.content}</p>)}
        {!loading && !error && !items.length && <div className="message-list-empty"><MessageSquare size={20}/><strong>Comece a conversa</strong><small>Envie a primeira mensagem para {selected.username}.</small></div>}
      </div><form onSubmit={send}><input value={content} maxLength={LIMITS.message * 2} onChange={(event) => setContent(event.target.value)} placeholder="Escreva uma mensagem" disabled={sending}/>
        <button type="submit" className={sending ? 'sending' : ''} disabled={sending || !content.trim() || codePoints(content.trim()) > LIMITS.message} aria-label={sending ? 'Enviando mensagem' : 'Enviar mensagem'}><Send size={16}/>{sending && <span>Aguarde...</span>}</button>
      </form>
    </> : <div className="message-welcome"><MessageSquare size={28}/><h2>Escolha uma pessoa</h2><p>Use a lista ao lado para abrir uma conversa ou buscar alguém pelo nome.</p></div>}</div></div>
  </section>;
}
