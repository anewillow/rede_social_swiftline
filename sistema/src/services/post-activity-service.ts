import {
  Comment,
  Like,
  PollOption,
  PollVote,
  Post,
  PostView,
  Repost,
  SavedPost,
} from '../models/index.js';
import { authorDirectory } from '../bootstrap/author-directory.js';
import { resolvePostAuthors } from '../modules/posts/public.js';
import type { Transaction } from 'sequelize';

type GroupedCount = { postId: number | string; count: number | string };

export async function postsWithActivity(
  posts: Post[],
  userId?: number,
  transaction?: Transaction,
): Promise<Record<string, unknown>[]> {
  const postIds = posts.map((post) => post.id);
  if (!postIds.length) return [];
  const [
    likes,
    reposts,
    savedPosts,
    commentCounts,
    repostCounts,
    viewCounts,
    pollOptions,
    pollVotes,
    currentAuthors,
    likeCounts,
    pollVoteCounts,
  ] = await Promise.all([
    userId ? Like.findAll({ where: { userId, postId: postIds }, transaction }) : Promise.resolve([]),
    userId ? Repost.findAll({ where: { userId, postId: postIds }, transaction }) : Promise.resolve([]),
    userId ? SavedPost.findAll({ where: { userId, postId: postIds }, transaction }) : Promise.resolve([]),
    Comment.count({ where: { postId: postIds }, group: ['postId'], transaction }),
    Repost.count({ where: { postId: postIds }, group: ['postId'], transaction }),
    PostView.count({ where: { postId: postIds }, group: ['postId'], transaction }),
    PollOption.findAll({ where: { postId: postIds }, order: [['position', 'ASC']], transaction }),
    userId ? PollVote.findAll({ where: { postId: postIds, userId }, transaction }) : Promise.resolve([]),
    resolvePostAuthors(posts.map((post) => ({ ...post.toJSON(), id: post.id, userId: post.userId })), authorDirectory),
    Like.count({ where: { postId: postIds }, group: ['postId'], transaction }),
    PollVote.count({ where: { postId: postIds }, group: ['optionId'], transaction }),
  ]);
  const likedIds = new Set(likes.map((like) => like.postId));
  const repostedIds = new Set(reposts.map((repost) => repost.postId));
  const savedIds = new Set(savedPosts.map((savedPost) => savedPost.postId));
  const toCountMap = (rows: unknown) =>
    new Map((rows as GroupedCount[]).map((row) => [Number(row.postId), Number(row.count)]));
  const commentsByPostId = toCountMap(commentCounts);
  const likesByPostId = toCountMap(likeCounts);
  const repostsByPostId = toCountMap(repostCounts);
  const viewsByPostId = toCountMap(viewCounts);
  const votesByOptionId = new Map<number, number>();
  const votedOptionByPostId = new Map<number, number>();
  for (const count of pollVoteCounts as unknown as Array<{ optionId: number; count: number }>) votesByOptionId.set(Number(count.optionId), Number(count.count));
  for (const vote of pollVotes) {
    if (userId === vote.userId) votedOptionByPostId.set(vote.postId, vote.optionId);
  }
  const optionsByPostId = new Map<number, Array<{ id: number; text: string; votes: number }>>();
  for (const option of pollOptions) {
    const options = optionsByPostId.get(option.postId) ?? [];
    options.push({ id: option.id, text: option.text, votes: votesByOptionId.get(option.id) ?? 0 });
    optionsByPostId.set(option.postId, options);
  }
  return currentAuthors.map((post) => {
    const options = optionsByPostId.get(post.id) ?? [];
    return {
      ...post,
      liked: likedIds.has(post.id),
      likes: likesByPostId.get(post.id) ?? 0,
      reposted: repostedIds.has(post.id),
      saved: savedIds.has(post.id),
      commentCount: commentsByPostId.get(post.id) ?? 0,
      reposts: repostsByPostId.get(post.id) ?? 0,
      views: viewsByPostId.get(post.id) ?? 0,
      poll: options.length
        ? {
            options,
            totalVotes: options.reduce((total, option) => total + option.votes, 0),
            votedOptionId: votedOptionByPostId.get(post.id) ?? null,
          }
        : null,
      pollPermissions: { canManage: userId === post.userId },
    };
  });
}
