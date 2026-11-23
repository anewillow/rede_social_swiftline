import { FormEvent, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Avatar } from '../../../components/common/Avatar';
import type { Comment } from '../../../types/index';
import { commentsApi } from '../../../services/comments-api';
import { usePagedList } from '../../../shared/use-paged-list';
import { AsyncStatus, MoreItems } from '../../../shared/AsyncStatus';
import { messageOf } from '../../../shared/api';
import { LIMITS, codePoints } from '../../../../shared/contracts/index';

export function Comments({ postId, commentCount, onCountChange }: {
  postId: number; currentUserId: number; commentCount: number; onCountChange: (count: number) => void;
}) {
  const list = usePagedList('comments:' + postId, (signal, cursor) => commentsApi.list(postId, signal, cursor));
  const count = useRef(commentCount); count.current = commentCount;
  const [content, setContent] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function perform(operation: () => Promise<void>) {
    if (busy) return; setBusy(true); setError('');
    try { await operation(); } catch (failure) { setError(messageOf(failure)); }
    finally { setBusy(false); }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!content.trim()) return;
    await perform(async () => {
      const comment = await commentsApi.create(postId, { content });
      list.setItems((items) => [...items.filter((item) => item.id !== comment.id), comment]);
      setContent(''); onCountChange(count.current + 1);
    });
  };
  const save = (item: Comment) => perform(async () => {
    const updated = await commentsApi.update(item.id, { content: editContent });
    list.setItems((items) => items.map((row) => row.id === item.id ? { ...row, ...updated } : row)); setEditing(null);
  });
  const remove = (item: Comment) => {
    if (!confirm('Excluir este comentário?')) return;
    void perform(async () => { await commentsApi.remove(item.id); list.setItems((items) => items.filter((row) => row.id !== item.id)); onCountChange(Math.max(0, count.current - 1)); });
  };
  const items = [...list.items].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id);
  return <section className="comments">
    <AsyncStatus loading={list.loading} error={list.error} retry={list.retry} />
    {error && <p role="alert">{error}</p>}
    <div className="comment-list">{items.map((item) => <div className="comment" key={item.id}>
      <Avatar person={item.user} /><div className="comment-body">
        {editing === item.id ? <div className="comment-edit">
          <input aria-label="Editar comentário" maxLength={LIMITS.comment * 2} value={editContent} onChange={(event) => setEditContent(event.target.value)} />
          <button disabled={busy || !editContent.trim() || codePoints(editContent.trim()) > LIMITS.comment} onClick={() => void save(item)}>Salvar</button>
          <button onClick={() => setEditing(null)}>Cancelar</button>
        </div> : <p><strong>{item.user?.username}</strong>{item.content}</p>}
        {editing !== item.id && (item.permissions.canEdit || item.permissions.canDelete) && <div className="comment-actions">
          {item.permissions.canEdit && <button onClick={() => { setEditing(item.id); setEditContent(item.content); }}>Editar</button>}
          {item.permissions.canDelete && <button disabled={busy} className="delete-comment-btn" onClick={() => remove(item)}>Excluir</button>}
        </div>}
      </div>
    </div>)}</div>
    <MoreItems cursor={list.nextCursor} loading={list.loading} load={list.loadMore} label="Mais comentários" />
    <form onSubmit={submit}><input value={content} maxLength={LIMITS.comment * 2} onChange={(event) => setContent(event.target.value)} placeholder="Escreva um comentário" />
      <button aria-label="Enviar comentário" disabled={busy || !content.trim() || codePoints(content.trim()) > LIMITS.comment}><Send size={16} /></button>
    </form>
  </section>;
}
