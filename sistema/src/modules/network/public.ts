export interface NetworkAccountRemoval {
  removeAccountData(userId: number): Promise<void>;
}

export interface NetworkInteractions {
  follow(userId: number, targetId: number, desired?: boolean): Promise<boolean>;
  countFollowers(targetId: number): Promise<number>;
}
