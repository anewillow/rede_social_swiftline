export interface NotificationsAccountRemoval {
  removeAccountData(userId: number): Promise<void>;
}

export interface NotificationRecorder {
  record(input: { userId: number; actorId: number; type: 'comment' | 'like' | 'follow'; message: string }): Promise<void>;
}
