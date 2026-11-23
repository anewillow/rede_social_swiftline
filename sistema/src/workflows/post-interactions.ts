import type { InteractionAccounts } from '../modules/accounts/public.js';
import type { PostInteractions } from '../modules/posts/public.js';
import type { NetworkInteractions } from '../modules/network/public.js';
import type { NotificationRecorder } from '../modules/notifications/public.js';
import type { AtomicUnitOfWork } from './ports/unit-of-work.js';

export class InteractionError extends Error {
  constructor(readonly code: 'POST_NOT_FOUND' | 'USER_NOT_FOUND' | 'INVALID_TARGET') { super(code); }
}
export type InteractionScope = { accounts: InteractionAccounts; posts: PostInteractions; network: NetworkInteractions; notifications: NotificationRecorder };

export function createPostInteractionOperations(unitOfWork: AtomicUnitOfWork<InteractionScope>) {
  return {
    comment: (input: { userId: number; postId: number; content: string }) => unitOfWork.run(async ({ accounts, posts, notifications }) => {
      const post = await posts.lockPost(input.postId);
      if (!post) throw new InteractionError('POST_NOT_FOUND');
      const actor = await accounts.findById(input.userId);
      if (!actor) throw new InteractionError('USER_NOT_FOUND');
      const comment = await posts.addComment(post.id, actor.id, input.content);
      if (post.userId !== actor.id) await notifications.record({ userId: post.userId, actorId: actor.id, type: 'comment', message: `${actor.username} respondeu à sua publicação.` });
      return { ...comment, user: actor };
    }),
    like: (input: { userId: number; postId: number; liked?: boolean }) => unitOfWork.run(async ({ accounts, posts, notifications }) => {
      const post = await posts.lockPost(input.postId);
      if (!post) throw new InteractionError('POST_NOT_FOUND');
      const actor = await accounts.findById(input.userId);
      if (!actor) throw new InteractionError('USER_NOT_FOUND');
      const result = await posts.changeLike(post.id, actor.id, input.liked);
      if (result.created && post.userId !== actor.id) await notifications.record({ userId: post.userId, actorId: actor.id, type: 'like', message: `${actor.username} curtiu sua publicação.` });
      return result;
    }),
    follow: (input: { userId: number; username: string; following?: boolean }) => unitOfWork.run(async ({ accounts, network, notifications }) => {
      const target = await accounts.findByUsername(input.username);
      if (!target || target.id === input.userId) throw new InteractionError('INVALID_TARGET');
      await accounts.lockAccounts([input.userId, target.id]);
      const actor = await accounts.findById(input.userId);
      if (!actor) throw new InteractionError('USER_NOT_FOUND');
      const created = await network.follow(actor.id, target.id, input.following);
      if (created) await notifications.record({ userId: target.id, actorId: actor.id, type: 'follow', message: `${actor.username} começou a seguir você.` });
      return { success: true, following: input.following ?? true, followersCount: await network.countFollowers(target.id) };
    }),
  };
}
