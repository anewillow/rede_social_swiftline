import { Comment, Like, Post, PostView, Repost, SavedPost } from './models/index.js';

type GroupedCount = { postId: number | string; count: number | string };

export async function postsWithActivity(
  posts: Post[],
  userId?: number,
): Promise<Record<string, unknown>[]> {
  const postIds = posts.map((post) => post.id);
  if (!postIds.length) return [];
  const [likes, reposts, savedPosts, commentCounts, repostCounts, viewCounts] = await Promise.all([
    userId ? Like.findAll({ where: { userId, postId: postIds } }) : Promise.resolve([]),
    userId ? Repost.findAll({ where: { userId, postId: postIds } }) : Promise.resolve([]),
    userId ? SavedPost.findAll({ where: { userId, postId: postIds } }) : Promise.resolve([]),
    Comment.count({ where: { postId: postIds }, group: 'postId' }),
    Repost.count({ where: { postId: postIds }, group: 'postId' }),
    PostView.count({ where: { postId: postIds }, group: 'postId' }),
  ]);
  const likedIds = new Set(likes.map((like) => like.postId));
  const repostedIds = new Set(reposts.map((repost) => repost.postId));
  const savedIds = new Set(savedPosts.map((savedPost) => savedPost.postId));
  const toCountMap = (rows: unknown) =>
    new Map((rows as GroupedCount[]).map((row) => [Number(row.postId), Number(row.count)]));
  const commentsByPostId = toCountMap(commentCounts);
  const repostsByPostId = toCountMap(repostCounts);
  const viewsByPostId = toCountMap(viewCounts);
  return posts.map((post) => ({
    ...post.toJSON(),
    liked: likedIds.has(post.id),
    reposted: repostedIds.has(post.id),
    saved: savedIds.has(post.id),
    commentCount: commentsByPostId.get(post.id) ?? 0,
    reposts: repostsByPostId.get(post.id) ?? 0,
    views: viewsByPostId.get(post.id) ?? 0,
  }));
}
