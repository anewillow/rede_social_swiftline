import type { AuthorDirectory } from '../../accounts/public.js';

export async function resolvePostAuthors<T extends { userId: number }>(
  posts: T[],
  directory: AuthorDirectory,
): Promise<Array<T & { author: string; avatar: string | null }>> {
  if (!posts.length) return [];
  const authors = await directory.findByIds([...new Set(posts.map((post) => post.userId))]);
  const byId = new Map(authors.map((author) => [author.id, author]));
  return posts.map((post) => {
    const author = byId.get(post.userId);
    return {
      ...post,
      author: author?.username ?? 'Usuário indisponível',
      avatar: author?.avatar ?? null,
    };
  });
}
