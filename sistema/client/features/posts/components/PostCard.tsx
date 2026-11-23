import { Avatar } from '../../../components/common/Avatar';
import type { Post } from '../../../types/index';
import { usePostUpdates } from '../PostsProvider';
import { PostActions } from './PostActions';
import { PostOwnerControls } from './PostOwnerControls';
import { PostPoll } from './PostPoll';

export function PostCard({ post, currentUserId, openProfile, variant = 'feed', era }: {
  post: Post;
  currentUserId: number;
  openProfile: (username: string, userId?: number) => void;
  variant?: 'feed' | 'profile' | 'saved';
  era?: string;
}) {
  const { patchPost, removePost } = usePostUpdates();
  const owned = post.userId === currentUserId && !post.poll;
  return (
    <article id={`post-${post.id}`} className={['post', 'tweet', variant === 'profile' ? 'profile-post' : '', owned ? 'owner-post' : ''].filter(Boolean).join(' ')}>
      {owned && <PostOwnerControls post={post} onUpdate={patchPost} onDelete={removePost} />}
      <header>
        <button className="person-link avatar-link" onClick={() => openProfile(post.author, post.userId)}>
          <Avatar person={post} />
        </button>
        <div>
          <button className="person-link author-link" onClick={() => openProfile(post.author, post.userId)}>{post.author}</button>
          {era && <span className="era-tag">{era}</span>}
          <p>@{post.author.replace(/\s/g, '').toLowerCase()} · {post.createdAt ? new Date(post.createdAt).toLocaleDateString('pt-BR') : 'Data indisponível'}</p>
        </div>
      </header>
      <p className="post-content">{post.content}</p>
      {post.image && <img className="post-image" src={post.image} alt="Imagem da publicação" />}
      {post.poll && <PostPoll post={post} onUpdate={patchPost} onPollDeleted={(id) => patchPost(id, { poll: null })} />}
      <PostActions post={post} currentUserId={currentUserId} onUpdate={patchPost} />
    </article>
  );
}
