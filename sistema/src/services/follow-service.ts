import { serviceResult, type ServiceInput, type ServiceResult } from '../types/service.js';
import { Follow, User } from '../models/index.js';
import { postInteractions } from '../bootstrap/post-interactions.js';
import { InteractionError } from '../workflows/post-interactions.js';

export async function follow(req: ServiceInput): Promise<ServiceResult> {
  try { const result = await postInteractions.follow({ userId: req.userId!, username: String(req.params.username), following: req.apiVersion === 2 ? req.body.following : undefined }); return serviceResult(req.apiVersion === 2 ? result : { success: result.success, followersCount: result.followersCount }, 200); }
  catch (error) {
    if (error instanceof InteractionError) return serviceResult({ error: 'Usuário inválido' }, 400);
    throw error;
  }
}

export async function unfollow(req: ServiceInput): Promise<ServiceResult> {
  const target = await User.findOne({ where: { username: req.params.username } });
  if (!target) return serviceResult({ error: 'Usuário não encontrado' }, 404);
  await Follow.destroy({ where: { followerId: req.userId!, followingId: target.id } });
  return serviceResult({
    success: true,
    followersCount: await Follow.count({ where: { followingId: target.id } }),
  }, 200);
}

export async function isFollowing(req: ServiceInput): Promise<ServiceResult> {
  const target = await User.findOne({ where: { username: req.params.username } });
  return serviceResult({
    following:
      !!target &&
      !!(await Follow.findOne({ where: { followerId: req.userId!, followingId: target.id } })),
  }, 200);
}
