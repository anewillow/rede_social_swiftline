export type AccountToDelete = {
  id: number;
  avatar: string | null;
  cover: string | null;
};

export interface AccountDeletionAccess {
  authorizeDeletion(userId: number, password?: string): Promise<AccountToDelete>;
}

export interface AccountsRemoval {
  removeAccount(userId: number): Promise<void>;
}

export type PublicAuthor = { id: number; username: string; avatar: string | null };

export interface AuthorDirectory {
  findByIds(userIds: number[]): Promise<PublicAuthor[]>;
  findIdsByName(query: string): Promise<number[]>;
}

export interface InteractionAccounts {
  findById(id: number): Promise<PublicAuthor | null>;
  findByUsername(username: string): Promise<PublicAuthor | null>;
  lockAccounts(ids: number[]): Promise<void>;
}

export { AccountDeletionError, createAccountDeletionAccess } from './application/account-deletion-access.js';
