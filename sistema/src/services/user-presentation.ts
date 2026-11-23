import type { User } from '../models/index.js';
import { Follow } from '../models/index.js';

export const publicUser = (user: User) => ({
  id: user.id,
  username: user.username,
  bio: user.bio,
  avatar: user.avatar,
  cover: user.cover,
  location: user.location,
  website: user.website,
  createdAt: user.createdAt,
});
export const privateUser = (user: User) => ({ ...publicUser(user), email: user.email });

export async function usersWithFollowing(users: User[], viewer?: number) {
  const relations = viewer && users.length ? await Follow.findAll({ where: { followerId: viewer, followingId: users.map((user) => user.id) }, attributes: ['followingId'] }) : [];
  const followed = new Set(relations.map((relation) => relation.followingId));
  return users.map((user) => ({ ...publicUser(user), following: followed.has(user.id) }));
}
export async function profileWithCounts(user: User, viewer?: number) {
  const [followersCount, followingCount, following] = await Promise.all([Follow.count({ where: { followingId: user.id } }), Follow.count({ where: { followerId: user.id } }), viewer ? Follow.count({ where: { followerId: viewer, followingId: user.id } }) : 0]);
  return { ...publicUser(user), followersCount, followingCount, following: Boolean(following) };
}
