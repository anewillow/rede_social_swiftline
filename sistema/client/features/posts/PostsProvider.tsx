import { createContext, useContext, useMemo, useReducer, useRef, type ReactNode } from 'react';
import type { Post } from '../../types/index';
import { emptyPostState, postStateReducer, type PostState } from './post-state';

type PostUpdates = {
  replaceList: (key: string, posts: Post[], startedAt: number, append?: boolean) => void;
  patchPost: (id: number, patch: Partial<Post>) => void;
  removePost: (id: number) => void;
  updateViews: (counts: Record<number, number>) => void;
  revision: () => number;
};

const StateContext = createContext<PostState | null>(null);
const UpdatesContext = createContext<PostUpdates | null>(null);

export function PostsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(postStateReducer, undefined, emptyPostState);
  const current = useRef(state);
  current.current = state;
  const updates = useMemo<PostUpdates>(() => ({
    replaceList: (key, posts, startedAt, append) => dispatch({ type: 'replace-list', key, posts, startedAt, append }),
    patchPost: (id, patch) => dispatch({ type: 'patch', id, patch }),
    removePost: (id) => dispatch({ type: 'remove', id }),
    updateViews: (counts) => dispatch({ type: 'views', counts }),
    revision: () => current.current.revision,
  }), []);
  return (
    <UpdatesContext.Provider value={updates}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </UpdatesContext.Provider>
  );
}

export function usePostUpdates(): PostUpdates {
  const updates = useContext(UpdatesContext);
  if (!updates) throw new Error('As publicações precisam de PostsProvider.');
  return updates;
}

export function usePostState(): PostState {
  const state = useContext(StateContext);
  if (!state) throw new Error('As publicações precisam de PostsProvider.');
  return state;
}
