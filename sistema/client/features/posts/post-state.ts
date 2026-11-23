import type { Post } from '../../types/index';

export type PostState = {
  entities: Record<number, Post>;
  lists: Record<string, number[]>;
  revision: number;
  changedAt: Record<number, number>;
  removed: Record<number, true>;
};

export type PostStateAction =
  | { type: 'replace-list'; key: string; posts: Post[]; startedAt: number; append?: boolean }
  | { type: 'patch'; id: number; patch: Partial<Post> }
  | { type: 'views'; counts: Record<number, number> }
  | { type: 'remove'; id: number };

export const emptyPostState = (): PostState => ({ entities: {}, lists: {}, revision: 0, changedAt: {}, removed: {} });

export function postStateReducer(state: PostState, action: PostStateAction): PostState {
  if (action.type === 'replace-list') {
    const entities = { ...state.entities };
    const ids: number[] = action.append ? [...(state.lists[action.key] ?? [])] : [];
    for (const post of action.posts) {
      if (state.removed[post.id]) continue;
      if ((state.changedAt[post.id] ?? 0) <= action.startedAt) entities[post.id] = post;
      if (entities[post.id] && !(action.key === 'saved' && entities[post.id].saved === false) && !ids.includes(post.id)) ids.push(post.id);
    }
    return { ...state, entities, lists: { ...state.lists, [action.key]: ids } };
  }
  if (action.type === 'views') {
    const entities = { ...state.entities };
    for (const [id, count] of Object.entries(action.counts)) {
      if (entities[Number(id)]) entities[Number(id)] = { ...entities[Number(id)], views: count };
    }
    return { ...state, entities };
  }
  if (action.type === 'remove') {
    const entities = { ...state.entities };
    delete entities[action.id];
    return {
      ...state, entities, revision: state.revision + 1,
      removed: { ...state.removed, [action.id]: true },
      lists: Object.fromEntries(Object.entries(state.lists).map(([key, ids]) => [key, ids.filter((id) => id !== action.id)])),
    };
  }
  const current = state.entities[action.id];
  if (!current) return state;
  const revision = state.revision + 1;
  return {
    ...state, revision,
    entities: { ...state.entities, [action.id]: { ...current, ...action.patch, id: current.id, userId: current.userId } },
    changedAt: { ...state.changedAt, [action.id]: revision },
    lists: action.patch.saved === false
      ? { ...state.lists, saved: (state.lists.saved ?? []).filter((id) => id !== action.id) }
      : state.lists,
  };
}

export function selectPostList(state: PostState, key: string): Post[] {
  return (state.lists[key] ?? []).map((id) => state.entities[id]).filter((post): post is Post => Boolean(post));
}
