export interface PostsAccountRemoval {
  removeAccountData(userId: number): Promise<void>;
}

export interface PostInteractions {
  lockPost(id: number): Promise<{ id: number; userId: number } | null>;
  addComment(postId: number, userId: number, content: string): Promise<Record<string, unknown>>;
  changeLike(postId: number, userId: number, desired?: boolean): Promise<{ likes: number; liked: boolean; created: boolean }>;
}

export { resolvePostAuthors } from './application/post-authors.js';
