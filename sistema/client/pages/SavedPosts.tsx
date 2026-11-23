import { Empty } from '../components/common/Empty';
import { PostCard, PostListFeedback, usePostList } from '../features/posts';
import type { User } from '../types/index';
import { MoreItems } from '../shared/AsyncStatus';

export function SavedPosts({ user, openProfile }: {
  user: User;
  openProfile: (username: string, userId?: number) => void;
}) {
  const { posts, loading, error, retry, nextCursor, loadMore } = usePostList({ kind: 'saved' });
  return (
    <section className="saved-page">
      <header className="saved-header">
        <p className="eyebrow">SALVOS</p>
        <h1>Publicações salvas</h1>
      </header>
      <PostListFeedback loading={loading} error={error} empty={!posts.length} reload={retry} />
      {!loading && !error && !posts.length ? (
        <Empty title="Nada salvo ainda." description="Use o ícone de marcador em uma publicação para encontrá-la aqui depois." />
      ) : (
        <div className="feed-list">
          {posts.map((post) => <PostCard key={post.id} post={post} currentUserId={user.id} openProfile={openProfile} variant="saved" />)}
        </div>
      )}
      <MoreItems cursor={nextCursor} loading={loading} load={loadMore} />
    </section>
  );
}
