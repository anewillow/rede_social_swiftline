type UserId = number | undefined;

function isAuthor(currentUserId: UserId, authorId: number): boolean {
  return currentUserId === authorId;
}

export function canDeletePost(currentUserId: UserId, authorId: number): boolean {
  return isAuthor(currentUserId, authorId);
}

export function canEditComment(currentUserId: UserId, authorId: number): boolean {
  return isAuthor(currentUserId, authorId);
}

export function canDeleteComment(currentUserId: UserId, authorId: number): boolean {
  return isAuthor(currentUserId, authorId);
}

export function getCommentPermissions(currentUserId: UserId, authorId: number) {
  return {
    canEdit: canEditComment(currentUserId, authorId),
    canDelete: canDeleteComment(currentUserId, authorId),
  };
}
