import type { Transaction } from 'sequelize';
import { Comment, Like, Post } from '../../../models/index.js';
import type { PostInteractions } from '../public.js';

export function createPostInteractions(transaction: Transaction): PostInteractions {
  return {
    async lockPost(id) {
      const post = await Post.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      return post ? { id: post.id, userId: post.userId } : null;
    },
    async addComment(postId, userId, content) {
      return (await Comment.create({ postId, userId, content }, { transaction })).toJSON();
    },
    async changeLike(postId, userId, desired) {
      const existing = await Like.findOne({ where: { postId, userId }, transaction, lock: transaction.LOCK.UPDATE });
      const liked = desired ?? !existing;
      if (existing && !liked) await existing.destroy({ transaction });
      else if (!existing && liked) await Like.create({ postId, userId }, { transaction });
      const likes = await Like.count({ where: { postId }, transaction });
      await Post.update({ likes }, { where: { id: postId }, transaction });
      return { likes, liked, created: liked && !existing };
    },
  };
}
