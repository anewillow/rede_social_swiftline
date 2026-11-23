import { useState } from 'react';
import { Bookmark, Eye, MessageSquare, Repeat2, Share, ThumbsUp } from 'lucide-react';
import { Comments } from './Comments';
import type { Post } from '../../../types/index';
import { postsApi } from '../../../services/posts-api';
import { messageOf } from '../../../shared/api';

export function PostActions({
  post,
  currentUserId,
  onUpdate,
}: {
  post: Post;
  currentUserId: number;
  onUpdate: (postId: number, patch: Partial<Post>) => void;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [pending, setPending] = useState(false);
  const react = async (action: 'like' | 'repost' | 'save') => {
    if (pending) return;
    setPending(true);
    setFeedback('');
    try {
      if (action === 'like') { const result = await postsApi.like(post.id, !post.liked); onUpdate(post.id, result); }
      if (action === 'repost') {
        const result = await postsApi.repost(post.id, !post.reposted);
        onUpdate(post.id, { reposts: result.reposts, reposted: result.reposted });
        setFeedback(result.reposted ? 'Publicação repostada.' : 'Repost removido.');
      }
      if (action === 'save') {
        const result = await postsApi.save(post.id, !post.saved);
        onUpdate(post.id, { saved: result.saved });
        setFeedback(result.saved ? 'Publicação salva.' : 'Publicação removida dos salvos.');
      }
    } catch (error) { setFeedback(messageOf(error)); }
    finally { setPending(false); }
  };
  const share = async () => {
    if (pending) return;
    setPending(true);
    const url = `${location.origin}/feed.html#post-${post.id}`;
    let usedNativeShare = false;
    try {
      if (navigator.share) {
        usedNativeShare = true;
        await navigator.share({ title: `Publicação de ${post.author}`, text: post.content, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setFeedback('Link copiado.');
      } else if (window.prompt('Copie o link da publicação:', url) === null) return;
      const result = await postsApi.share(post.id);
        onUpdate(post.id, { shares: result.shares });
        if (usedNativeShare) setFeedback('Publicação compartilhada.');
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        setFeedback(messageOf(error, 'Não foi possível compartilhar agora.'));
    } finally { setPending(false); }
  };
  return (
    <>
      <footer>
        <button
          className={commentsOpen ? 'comments-button active-reaction' : 'comments-button'}
          aria-label="Comentários"
          aria-expanded={commentsOpen}
          onClick={() => setCommentsOpen(!commentsOpen)}
        >
          <MessageSquare size={17} />
          <span className="count-badge">{post.commentCount || 0}</span>
        </button>
        <button
          className={post.reposted ? 'reaction active-reaction' : 'reaction'}
          aria-label={post.reposted ? 'Remover repost' : 'Repostar'}
          aria-pressed={Boolean(post.reposted)}
          disabled={pending}
          onClick={() => void react('repost')}
        >
          <Repeat2 size={17} />
          <span>{post.reposts || 0}</span>
        </button>
        <button
          className={
            post.liked ? 'reaction active-reaction like-post-btn' : 'reaction like-post-btn'
          }
          aria-label={post.liked ? 'Remover curtida' : 'Curtir'}
          aria-pressed={Boolean(post.liked)}
          disabled={pending}
          onClick={() => void react('like')}
        >
          <ThumbsUp size={17} />
          <span>{post.likes || 0}</span>
        </button>
        <button
          aria-label={`${post.views || 0} visualizações`}
          onClick={() => setFeedback(`${post.views || 0} visualizações únicas.`)}
        >
          <Eye size={17} />
          <span>{post.views || 0}</span>
        </button>
        <button
          className={post.saved ? 'reaction active-reaction' : 'reaction'}
          aria-label={post.saved ? 'Remover dos salvos' : 'Salvar'}
          aria-pressed={Boolean(post.saved)}
          disabled={pending}
          onClick={() => void react('save')}
        >
          <Bookmark size={17} fill={post.saved ? 'currentColor' : 'none'} />
        </button>
        <button aria-label="Compartilhar" disabled={pending} onClick={() => void share()}>
          <Share size={17} />
          {Boolean(post.shares) && <span>{post.shares}</span>}
        </button>
      </footer>
      {feedback && (
        <p className="action-feedback" role="status">
          {feedback}
        </p>
      )}
      {commentsOpen && (
        <Comments
          postId={post.id}
          currentUserId={currentUserId}
          commentCount={post.commentCount ?? 0}
          onCountChange={(count) => onUpdate(post.id, { commentCount: count })}
        />
      )}
    </>
  );
}
