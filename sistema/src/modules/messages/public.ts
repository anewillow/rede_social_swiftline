export interface MessagesAccountRemoval {
  removeAccountData(userId: number): Promise<void>;
}
