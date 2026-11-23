import type { AuthorDirectory } from '../modules/accounts/public.js';
import { authorDirectoryRepository } from '../modules/accounts/persistence/author-directory-repository.js';

export const authorDirectory: AuthorDirectory = authorDirectoryRepository;
