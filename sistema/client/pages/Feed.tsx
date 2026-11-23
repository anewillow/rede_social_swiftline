import { FormEvent, useEffect, useState } from 'react';
import { BarChart3, FileImage, Gift, Music2, Plus, Send, Smile, X } from 'lucide-react';
import { Avatar } from '../components/common/Avatar';
import { Empty } from '../components/common/Empty';
import { PostCard, PostListFeedback, usePostList } from '../features/posts';
import { formatFileSize } from '../utils/format-file-size';
import { safeImagePreview } from '../utils/image-preview';
import type { User } from '../types/index';
import { MAX_POST_IMAGE_SIZE, POST_IMAGE_TYPES } from '../config/constants';
import { postsApi } from '../services/posts-api';
import { messageOf } from '../shared/api';
import { MoreItems } from '../shared/AsyncStatus';
import { LIMITS, codePoints } from '../../shared/contracts/index';
import { usePostState, usePostUpdates } from '../features/posts';
import { AsyncStatus } from '../shared/AsyncStatus';

export function Feed({
  user,
  openProfile,
}: {
  user: User;
  openProfile: (username: string, userId?: number) => void;
}) {
  const [content, setContent] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageError, setImageError] = useState('');
  const [showImageHint, setShowImageHint] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollError, setPollError] = useState('');
  const [tab, setTab] = useState<'forYou' | 'following'>('forYou');
  const [toolMessage, setToolMessage] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const { posts, loading, error, reload, retry, nextCursor, loadMore } = usePostList({ kind: 'feed', following: tab === 'following' });
  const state = usePostState(), updates = usePostUpdates();
  const readFocus = () => Number(/^#post-([1-9]\d*)$/.exec(location.hash)?.[1]) || null;
  const [focusId, setFocusId] = useState(readFocus), [focusError, setFocusError] = useState('');
  const [focusAttempt, setFocusAttempt] = useState(0);
  useEffect(() => { const changed = () => setFocusId(readFocus()); addEventListener('popstate', changed); addEventListener('hashchange', changed); return () => { removeEventListener('popstate', changed); removeEventListener('hashchange', changed); }; }, []);
  useEffect(() => {
    setFocusError(''); if (!focusId) return;
    const controller = new AbortController(), startedAt = updates.revision();
    postsApi.get(focusId, controller.signal).then((post) => { if (!controller.signal.aborted) updates.replaceList('focused', [post], startedAt); })
      .catch((failure) => { if (!controller.signal.aborted) setFocusError(messageOf(failure)); });
    return () => controller.abort();
  }, [focusId, focusAttempt, updates]);
  const focused = focusId && !posts.some((post) => post.id === focusId) ? state.entities[focusId] : null;
  useEffect(() => {
    if (loading) return;
    requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [loading, tab, focusId, focused]);
  useEffect(() => {
    setImagePreview('');
    if (!image) return;
    const reader = new FileReader();
    let active = true;
    reader.onload = () => {
      if (!active) return;
      const preview = safeImagePreview(reader.result);
      setImagePreview(preview ?? '');
      if (!preview) setImageError('Não foi possível preparar a prévia da imagem.');
    };
    reader.onerror = () => {
      if (active) setImageError('Não foi possível ler a imagem selecionada.');
    };
    reader.readAsDataURL(image);
    return () => { active = false; reader.abort(); };
  }, [image]);
  useEffect(() => {
    if (!showImageHint) return;
    const timeout = window.setTimeout(() => setShowImageHint(false), 4500);
    return () => window.clearTimeout(timeout);
  }, [showImageHint]);
  const publish = async (event: FormEvent) => {
    event.preventDefault();
    if (publishing) return;
    if (codePoints(content.trim()) > LIMITS.post) { setPublishError('O texto pode ter no máximo 280 caracteres.'); return; }
    const normalizedPollOptions = pollOptions.map((option) => option.trim());
    if (pollOpen) {
      if (!content.trim()) {
        setPollError('Escreva a pergunta da enquete.');
        return;
      }
      if (normalizedPollOptions.some((option) => !option)) {
        setPollError('Preencha todas as opções.');
        return;
      }
      if (
        new Set(normalizedPollOptions.map((option) => option.toLocaleLowerCase('pt-BR'))).size !==
        normalizedPollOptions.length
      ) {
        setPollError('As opções precisam ser diferentes.');
        return;
      }
    } else if (!content.trim() && !image) return;
    setPublishError('');
    setPollError('');
    const body = new FormData();
    body.set('content', content);
    if (image) body.set('image', image);
    if (pollOpen) body.set('pollOptions', JSON.stringify(normalizedPollOptions));
    const startedAt = Date.now();
    let errorMessage = '';
    setPublishing(true);
    try {
      await postsApi.create(body);
        setContent('');
        setImage(null);
        setPollOpen(false);
        setPollOptions(['', '']);
        setPollError('');
        setToolMessage('');
        try {
          await reload();
        } catch {
          // A publicação já foi concluída; uma falha ao atualizar o feed não deve permitir duplicá-la.
        }
    } catch (error) {
      errorMessage = messageOf(error);
    } finally {
      const remainingTime = 800 - (Date.now() - startedAt);
      if (remainingTime > 0)
        await new Promise<void>((resolve) => setTimeout(resolve, remainingTime));
      setPublishing(false);
      if (errorMessage) setPublishError(errorMessage);
    }
  };
  const eras = ['folklore', '1989', 'reputation', 'Lover', 'Midnights'];
  return (
    <>
      <section className="feed-header">
        <div className="feed-title">
          <span aria-hidden="true">✦</span>
          <div>
            <small>SWIFTLINE</small>
            <h1>Sua timeline</h1>
          </div>
        </div>
        <div className="feed-tabs">
          <button className={tab === 'forYou' ? 'active' : ''} onClick={() => setTab('forYou')}>
            Para você
          </button>
          <button
            className={tab === 'following' ? 'active' : ''}
            onClick={() => setTab('following')}
          >
            Seguindo
          </button>
        </div>
      </section>
      <form className="composer" onSubmit={publish} aria-busy={publishing}>
        <Avatar person={user} />
        <div>
          {pollOpen && (
            <div className="poll-question-heading">
              <span>1</span>
              <div>
                <strong>Pergunta da enquete</strong>
                <small>Escreva uma pergunta curta e direta.</small>
              </div>
            </div>
          )}
          <textarea
            id="post-text"
            maxLength={LIMITS.post * 2}
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              if (pollOpen) setPollError('');
            }}
            placeholder={pollOpen ? 'O que você quer perguntar?' : 'O que está acontecendo?'}
          />
          {showImageHint && !image && !imageError && (
            <p className="image-upload-hint" role="status">
              <FileImage size={13} aria-hidden="true" />
              Imagens PNG, JPG, GIF ou WebP · máximo 3 MB
            </p>
          )}
          {image && (
            <div className="image-attachment">
              <div className="image-attachment-preview">
                <img src={safeImagePreview(imagePreview)} alt="Prévia da imagem selecionada" />
                <button
                  type="button"
                  className="image-attachment-remove"
                  aria-label={`Remover ${image.name}`}
                  title="Remover imagem"
                  onClick={() => {
                    setImage(null);
                    setImageError('');
                  }}
                >
                  <X size={17} />
                </button>
              </div>
              <p className="image-attachment-info">
                <span aria-hidden="true">✓</span>
                <strong>{image.name}</strong>
                <small>{formatFileSize(image.size)} · pronta para publicar</small>
              </p>
            </div>
          )}
          {imageError && (
            <p className="image-validation-error" role="alert">
              <span aria-hidden="true">!</span>
              {imageError}
            </p>
          )}
          {pollOpen && (
            <section className="poll-composer" aria-label="Criar enquete">
              <header>
                <span className="poll-step-badge" aria-hidden="true">2</span>
                <div>
                  <strong>Opções de resposta</strong>
                  <small>Adicione de duas a quatro opções.</small>
                </div>
                <button
                  type="button"
                  className="poll-close"
                  aria-label="Remover enquete"
                  onClick={() => {
                    setPollOpen(false);
                    setPollOptions(['', '']);
                    setPollError('');
                  }}
                >
                  <X size={16} />
                </button>
              </header>
              <div className="poll-option-list">
                {pollOptions.map((option, index) => (
                  <div className="poll-option-field" key={index}>
                    <span>{String.fromCharCode(65 + index)}</span>
                    <input
                      value={option}
                      maxLength={LIMITS.pollOption * 2}
                      placeholder={`Opção ${index + 1}`}
                      aria-label={`Opção ${index + 1} da enquete`}
                      onChange={(event) => {
                        const nextOptions = [...pollOptions];
                        nextOptions[index] = event.target.value;
                        setPollOptions(nextOptions);
                        setPollError('');
                      }}
                    />
                    <small>{option.length}/80</small>
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        aria-label={`Remover opção ${index + 1}`}
                        onClick={() => {
                          setPollOptions((options) => options.filter((_, item) => item !== index));
                          setPollError('');
                        }}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <footer>
                {pollOptions.length < 4 ? (
                  <button
                    type="button"
                    className="poll-add-option"
                    onClick={() => setPollOptions((options) => [...options, ''])}
                  >
                    <Plus size={14} /> Adicionar opção
                  </button>
                ) : (
                  <span>Limite de 4 opções</span>
                )}
                <small>{pollOptions.length} de 4</small>
              </footer>
              {pollError && <p className="poll-error" role="alert">{pollError}</p>}
            </section>
          )}
          {toolMessage && <p className="tool-message">{toolMessage}</p>}
          {publishError && (
            <div className="composer-error" role="alert">
              <span>
                <span className="composer-error-icon" aria-hidden="true">
                  !
                </span>
                {publishError}
              </span>
              <button type="submit" disabled={publishing}>
                Tentar novamente
              </button>
            </div>
          )}
          <div>
            <div className="composer-tools">
              <label
                className="composer-tool"
                data-tooltip="Adicionar imagem (máx. 3 MB)"
                aria-label="Adicionar imagem, máximo 3 MB"
                tabIndex={0}
                onClick={() => {
                  setShowImageHint(true);
                  setToolMessage('');
                }}
              >
                <FileImage size={18} />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={(event) => {
                    const selectedImage = event.target.files?.[0];
                    event.currentTarget.value = '';
                    if (!selectedImage) return;
                    if (!POST_IMAGE_TYPES.includes(selectedImage.type)) {
                      setImage(null);
                      setShowImageHint(false);
                      setImageError('Formato não aceito. Use PNG, JPG, GIF ou WebP.');
                      return;
                    }
                    if (selectedImage.size > MAX_POST_IMAGE_SIZE) {
                      setImage(null);
                      setShowImageHint(false);
                      setImageError('A imagem é maior que 3 MB. Escolha um arquivo menor.');
                      return;
                    }
                    setImage(selectedImage);
                    setShowImageHint(false);
                    setImageError('');
                    setToolMessage('');
                  }}
                />
              </label>
              <button
                type="button"
                className="composer-tool"
                data-tooltip="Adicionar GIF"
                aria-label="GIF"
                onClick={() => setToolMessage('GIF estará disponível em breve.')}
              >
                <Gift size={18} />
              </button>
              <button
                type="button"
                className={pollOpen ? 'composer-tool active' : 'composer-tool'}
                data-tooltip="Criar enquete"
                aria-label="Enquete"
                aria-pressed={pollOpen}
                onClick={() => {
                  const willOpen = !pollOpen;
                  setPollOpen(willOpen);
                  setPollError('');
                  setToolMessage('');
                  if (willOpen) {
                    requestAnimationFrame(() => document.getElementById('post-text')?.focus());
                  }
                }}
              >
                <BarChart3 size={18} />
              </button>
              <button
                type="button"
                className="composer-tool"
                data-tooltip="Adicionar emoji"
                aria-label="Emoji"
                onClick={() => {
                  setContent((text) => `${text}${text ? ' ' : ''}✨`);
                  setToolMessage('');
                }}
              >
                <Smile size={18} />
              </button>
              <button
                type="button"
                className="composer-tool"
                data-tooltip="Adicionar música"
                aria-label="Música"
                onClick={() => setToolMessage('Música estará disponível em breve.')}
              >
                <Music2 size={18} />
              </button>
            </div>
            <span>{codePoints(content.trim())}/{LIMITS.post}</span>
            <button
              type="submit"
              className="primary-button"
              disabled={publishing || codePoints(content.trim()) > LIMITS.post}
              aria-label={publishing ? 'Publicando' : pollOpen ? 'Publicar enquete' : 'Postar'}
            >
              <Send size={16} />{' '}
              {publishing ? 'Publicando...' : pollOpen ? 'Publicar enquete' : 'Postar'}
            </button>
          </div>
        </div>
      </form>
      <section className="feed-list">
        <PostListFeedback loading={loading} error={error} empty={!posts.length} reload={retry} />
        {!loading && !error && posts.length === 0 && (
          <Empty
            title={
              tab === 'following'
                ? 'Ainda não há posts de quem você segue.'
                : 'Seu feed está esperando você.'
            }
            description={
              tab === 'following'
                ? 'Siga pessoas ou aguarde novas publicações para vê-las aqui.'
                : 'Poste algo ou siga pessoas para preencher a sua timeline.'
            }
          />
        )}
        <AsyncStatus loading={false} error={focusError} retry={() => setFocusAttempt((value) => value + 1)} />
        {focused && <PostCard post={focused} currentUserId={user.id} openProfile={openProfile} />}
        {posts.map((post, index) => <PostCard key={post.id} post={post} currentUserId={user.id} openProfile={openProfile} era={eras[index % eras.length]} />)}
        <MoreItems cursor={nextCursor} loading={loading} load={loadMore} />
      </section>
    </>
  );
}
