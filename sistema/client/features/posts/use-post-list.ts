import { useCallback, useEffect, useRef, useState } from 'react';
import { postsApi } from '../../services/posts-api';
import { messageOf } from '../../shared/api';
import { FOLLOWING_CHANGED_EVENT } from '../../services/users-api';
import { usePostState, usePostUpdates } from './PostsProvider';
import { selectPostList } from './post-state';

type PostQuery = { kind: 'feed'; following: boolean } | { kind: 'user'; username: string } | { kind: 'saved' };

export function usePostList(query: PostQuery, enabled = true) {
  const key = query.kind === 'feed' ? 'feed:' + query.following : query.kind === 'user' ? 'user:' + query.username : 'saved';
  const state = usePostState();
  const updates = usePostUpdates();
  const active = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const failedCursor = useRef<string | null>(null);
  const load = useCallback(async (cursor: string | null = null) => {
    active.current?.abort();
    if (!enabled) { setLoading(false); return; }
    const controller = new AbortController();
    active.current = controller;
    const startedAt = updates.revision();
    failedCursor.current = cursor;
    setLoading(true);
    setError('');
    try {
      const result = query.kind === 'feed' ? await postsApi.list(query.following, controller.signal, cursor)
        : query.kind === 'user' ? await postsApi.forUser(query.username, controller.signal, cursor)
        : await postsApi.saved(controller.signal, cursor);
      const items = result.items;
      if (controller.signal.aborted) return;
      updates.replaceList(key, items, startedAt, Boolean(cursor));
      setNextCursor(result.nextCursor);
      if (items.length) {
        void postsApi.recordViews({ postIds: items.map((post) => post.id) })
          .then((result) => { if (!controller.signal.aborted) updates.updateViews(result.views); }).catch(() => {});
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(messageOf(failure));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [key, enabled, updates]);
  useEffect(() => {
    setNextCursor(null);
    void load();
    return () => active.current?.abort();
  }, [load]);
  useEffect(() => {
    const changed = () => { if (query.kind === 'feed' && query.following) void load(); };
    addEventListener(FOLLOWING_CHANGED_EVENT, changed); return () => removeEventListener(FOLLOWING_CHANGED_EVENT, changed);
  }, [load]);
  return { posts: selectPostList(state, key), loading, error, nextCursor, reload: () => load(), retry: () => load(failedCursor.current), loadMore: () => nextCursor && !loading ? load(nextCursor) : Promise.resolve() };
}
