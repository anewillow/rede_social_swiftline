import { Op, type Transaction } from 'sequelize';
import {
  Comment, CommentLike, Like, PollOption, PollVote, Post, PostView, Repost, SavedPost,
} from '../../../models/index.js';
import type { PostsAccountRemoval } from '../public.js';
import { enqueueImageCleanup } from '../../../infrastructure/storage/file-cleanup.js';

export function createPostsAccountRemoval(transaction: Transaction): PostsAccountRemoval {
  return {
    async removeAccountData(userId) {
      const posts = await Post.findAll({ where: { userId }, attributes: ['id', 'image'], transaction, lock: transaction.LOCK.UPDATE });
      const postIds = posts.map((post) => post.id);
      for (const post of posts) await enqueueImageCleanup(post.image, transaction);
      const relatedPosts = postIds.length ? [{ postId: { [Op.in]: postIds } }] : [];
      const comments = await Comment.findAll({
        where: { [Op.or]: [{ userId }, ...relatedPosts] },
        attributes: ['id'],
        transaction,
      });
      const commentIds = comments.map((comment) => comment.id);

      await CommentLike.destroy({
        where: {
          [Op.or]: [{ userId }, ...(commentIds.length ? [{ commentId: { [Op.in]: commentIds } }] : [])],
        },
        transaction,
      });
      for (const model of [Like, Repost, SavedPost, PostView]) {
        await model.destroy({ where: { [Op.or]: [{ userId }, ...relatedPosts] }, transaction });
      }

      // Remove também os votos do usuário em enquetes de outras pessoas.
      await PollVote.destroy({ where: { [Op.or]: [{ userId }, ...relatedPosts] }, transaction });
      if (postIds.length)
        await PollOption.destroy({ where: { postId: { [Op.in]: postIds } }, transaction });

      await Comment.destroy({ where: { [Op.or]: [{ userId }, ...relatedPosts] }, transaction });
      await Post.destroy({ where: { userId }, transaction });
    },
  };
}
