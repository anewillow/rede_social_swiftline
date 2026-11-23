export type { UserView as User, PostView as Post, CommentView as Comment } from '../../shared/contracts/index';
import type { UserView as User, PostView as Post } from '../../shared/contracts/index';


export type SearchResults = { users: User[]; posts: Post[] };

export type NewsItem = {
  id: string;
  title: string;
  url: string;
  description: string;
  publishedAt: string;
  source: string;
  image: string | null;
};

export type Page =
  | 'feed'
  | 'network'
  | 'messages'
  | 'notifications'
  | 'saved'
  | 'profile'
  | 'help'
  | 'settings'
  | 'userProfile';
