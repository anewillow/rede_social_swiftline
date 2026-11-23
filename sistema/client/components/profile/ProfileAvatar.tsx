import type { User } from '../../types/index';

export function ProfileAvatar({ user }: { user: User }) {
  return user.avatar ? <img className="profile-avatar" src={user.avatar} alt="" /> : <span className="profile-avatar profile-initials">{user.username.slice(0, 2).toUpperCase()}</span>;
}
