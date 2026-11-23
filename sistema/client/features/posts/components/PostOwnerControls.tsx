import { FormEvent, useEffect, useState } from 'react';
import { MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import type { Post } from '../../../types/index';
import { postsApi } from '../../../services/posts-api';
import { messageOf } from '../../../shared/api';
import { LIMITS, codePoints } from '../../../../shared/contracts/index';

export function PostOwnerControls({
  post,
  onUpdate,
  onDelete,
}: {
  post: Post;
  onUpdate: (postId: number, patch: Partial<Post>) => void;
  onDelete: (postId: number) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null);
  const [content, setContent] = useState(post.content || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!dialog) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving && !deleting) setDialog(null);
    };
    addEventListener('keydown', closeOnEscape);
    return () => removeEventListener('keydown', closeOnEscape);
  }, [dialog, saving, deleting]);
  const openEdit = () => {
    setContent(post.content || '');
    setError('');
    setMenuOpen(false);
    setDialog('edit');
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const result = await postsApi.update(post.id, { content });
      onUpdate(post.id, result.post);
      setDialog(null);
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    setError('');
    try {
      await postsApi.remove(post.id);
      onDelete(post.id);
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setDeleting(false);
    }
  };
  return (
    <>
      <div className="owner-post-menu">
        <button
          type="button"
          className="owner-post-menu-trigger"
          aria-label="Opções da publicação"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MoreHorizontal size={19} />
        </button>
        {menuOpen && (
          <div className="owner-post-menu-popover">
            <button type="button" onClick={openEdit}>
              <Pencil size={15} />
              <span><strong>Editar</strong><small>Alterar o texto</small></span>
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                setMenuOpen(false);
                setError('');
                setDialog('delete');
              }}
            >
              <Trash2 size={15} />
              <span><strong>Excluir</strong><small>Remover publicação</small></span>
            </button>
          </div>
        )}
      </div>

      {dialog && (
        <div
          className="owner-post-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving && !deleting) setDialog(null);
          }}
        >
          {dialog === 'edit' ? (
            <form className="owner-post-modal" role="dialog" aria-modal="true" onSubmit={save}>
              <header>
                <span><Pencil size={18} /></span>
                <div><small>SUA PUBLICAÇÃO</small><h2>Editar texto</h2></div>
                <button type="button" aria-label="Fechar" onClick={() => setDialog(null)}>
                  <X size={18} />
                </button>
              </header>
              <textarea
                autoFocus
                maxLength={LIMITS.post * 2}
                value={content}
                onChange={(event) => {
                  setContent(event.target.value);
                  setError('');
                }}
                aria-label="Texto da publicação"
              />
              <div className="owner-post-edit-count">{codePoints(content.trim())}/{LIMITS.post}</div>
              {error && <p role="alert">{error}</p>}
              <footer>
                <button type="button" onClick={() => setDialog(null)}>Cancelar</button>
                <button type="submit" className="save" disabled={saving || codePoints(content.trim()) > LIMITS.post}>
                  {saving ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </footer>
            </form>
          ) : (
            <section className="owner-post-modal delete" role="dialog" aria-modal="true">
              <span className="owner-post-delete-icon"><Trash2 size={22} /></span>
              <h2>Excluir publicação?</h2>
              <p>O texto, as curtidas e os comentários serão removidos.</p>
              {error && <p className="owner-post-modal-error" role="alert">{error}</p>}
              <footer>
                <button type="button" onClick={() => setDialog(null)}>Cancelar</button>
                <button type="button" className="danger" disabled={deleting} onClick={() => void remove()}>
                  {deleting ? 'Excluindo...' : 'Excluir publicação'}
                </button>
              </footer>
            </section>
          )}
        </div>
      )}
    </>
  );
}
