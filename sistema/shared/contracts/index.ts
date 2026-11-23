export const LIMITS = { post: 280, pollOption: 80, pollMin: 2, pollMax: 4, imageBytes: 3 * 1024 * 1024, username: 255, bio: 160, location: 120, website: 2048, comment: 2000, message: 5000, query: 120, page: 20, maxPage: 50 } as const;
export const codePoints = (value: string) => [...value].length;
export type Fields = Record<string, string>;
export type AuthInput = { email: string; password: string };
export type RegistrationInput = AuthInput & { username: string; acceptedTerms: boolean };
export type ProfileInput = Partial<Pick<UserView, 'username' | 'bio' | 'avatar' | 'cover' | 'location' | 'website'>>;
export type PostInput = { content: string; pollOptions?: string[] | string };
export type PollInput = { question: string; options: Array<{ id: number; text: string }> };
export type ContentInput = { content: string };
export type LikeInput = { liked: boolean };
export type SaveInput = { saved: boolean };
export type RepostInput = { reposted: boolean };
export type FollowInput = { following: boolean };
export class ValidationFailure extends Error {
  constructor(readonly fields: Fields, message = Object.values(fields)[0] ?? 'Confira os dados enviados.') { super(message); }
}
export type ErrorCode = 'VALIDATION_ERROR' | 'SESSION_INVALID' | 'INVALID_CREDENTIALS' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'PAYLOAD_TOO_LARGE' | 'UNSUPPORTED_MEDIA' | 'RATE_LIMITED' | 'INTERNAL_ERROR' | 'SERVICE_UNAVAILABLE' | 'NETWORK_ERROR' | 'INVALID_RESPONSE';
export type ApiFailure = { error: { code: ErrorCode; message: string; fields?: Fields }; requestId: string };
export type PageResult<T> = { items: T[]; nextCursor: string | null };
export type UserView = { id: number; username: string; email?: string; bio?: string | null; avatar?: string | null; cover?: string | null; location?: string | null; website?: string | null; createdAt?: string | null; following?: boolean; followersCount?: number; followingCount?: number };
export type PostView = { id: number; userId: number; author: string; content: string; image?: string | null; avatar?: string | null; likes?: number; liked?: boolean; commentCount?: number; reposts?: number; reposted?: boolean; views?: number; saved?: boolean; shares?: number; createdAt: string | null; poll?: { options: Array<{ id: number; text: string; votes: number }>; totalVotes: number; votedOptionId: number | null } | null; pollPermissions?: { canManage: boolean } };
export type CommentView = { id: number; userId: number; postId?: number; content: string; createdAt: string; user?: Pick<UserView, 'id' | 'username' | 'avatar'>; permissions: { canEdit: boolean; canDelete: boolean } };
export type MessageView = { id: number; senderId: number; receiverId: number; content: string; createdAt: string; sender?: Pick<UserView, 'username' | 'avatar'> };
export type NotificationView = { id: number; message: string; createdAt: string; isRead?: boolean; actor?: Pick<UserView, 'username' | 'avatar'> };
export type Decoder<T> = (value: unknown) => T;

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationFailure({ form: 'Os dados devem formar um objeto.' });
  return value as Record<string, unknown>;
}
export function text(value: unknown, field: string, max: number, required = false): string {
  if (typeof value !== 'string') throw new ValidationFailure({ [field]: 'Informe um texto válido.' });
  const result = value.trim();
  if (required && !result) throw new ValidationFailure({ [field]: 'Este campo é obrigatório.' });
  if (codePoints(result) > max) throw new ValidationFailure({ [field]: `Use no máximo ${max} caracteres.` });
  return result;
}
export function positiveId(value: unknown, field = 'id'): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new ValidationFailure({ [field]: 'Identificador inválido.' });
  return Number(value);
}
export function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new ValidationFailure({ [field]: 'Informe verdadeiro ou falso.' });
  return value;
}
export function pollOptions(values: unknown[]): string[] {
  if (values.length < LIMITS.pollMin || values.length > LIMITS.pollMax) throw new ValidationFailure({ pollOptions: 'A enquete deve ter de 2 a 4 opções.' });
  const options = values.map((value) => text(value, 'pollOptions', LIMITS.pollOption, true));
  if (new Set(options.map((value) => value.toLocaleLowerCase('pt-BR'))).size !== options.length) throw new ValidationFailure({ pollOptions: 'As opções precisam ser diferentes.' });
  return options;
}
export function validateInput(operation: string, body: unknown, params: Record<string, unknown>): Record<string, unknown> {
  const data = body === undefined ? {} : { ...object(body) };
  for (const field of ['id', 'postId', 'commentId', 'userId']) if (params[field] !== undefined) positiveId(params[field], field);
  if (['createPost', 'updatePost'].includes(operation)) {
    data.content = text(data.content ?? '', 'content', LIMITS.post);
    if (data.pollOptions !== undefined) {
      let options: unknown;
      try { options = typeof data.pollOptions === 'string' ? JSON.parse(data.pollOptions) : data.pollOptions; } catch { throw new ValidationFailure({ pollOptions: 'Não foi possível ler as opções da enquete.' }); }
      if (!Array.isArray(options)) throw new ValidationFailure({ pollOptions: 'Opções inválidas.' });
      data.pollOptions = JSON.stringify(pollOptions(options));
    }
  }
  if (operation === 'updatePoll') {
    data.question = text(data.question, 'question', LIMITS.post, true);
    if (!Array.isArray(data.options)) throw new ValidationFailure({ options: 'Informe as opções.' });
    const options = data.options.map((value) => object(value));
    const values = pollOptions(options.map((value) => value.text));
    data.options = options.map((value, index) => ({ id: positiveId(value.id, 'options'), text: values[index] }));
  }
  if (['createComment', 'updateComment', 'sendMessage'].includes(operation)) data.content = text(data.content, 'content', operation === 'sendMessage' ? LIMITS.message : LIMITS.comment, true);
  if (['login', 'register'].includes(operation)) {
    data.email = text(data.email, 'email', 255, true);
    if (typeof data.password !== 'string' || !data.password.length || codePoints(data.password) > 10000) throw new ValidationFailure({ password: 'Informe uma senha válida.' });
    if (operation === 'register') data.username = text(data.username, 'username', LIMITS.username, true);
  }
  if (operation === 'updateProfile') {
    for (const field of ['username', 'bio', 'location', 'website'] as const) if (data[field] !== undefined) data[field] = text(data[field], field, LIMITS[field], field === 'username');
    if (data.website) {
      let url: URL;
      try { url = new URL(String(data.website)); } catch { throw new ValidationFailure({ website: 'Informe um endereço completo com http ou https.' }); }
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new ValidationFailure({ website: 'Use um endereço http ou https válido.' });
    }
    for (const field of ['avatar', 'cover']) if (data[field] !== undefined && typeof data[field] !== 'string') throw new ValidationFailure({ [field]: 'Imagem inválida.' });
  }
  if (operation === 'toggleLike') data.liked = boolean(data.liked, 'liked');
  if (operation === 'toggleRepost') data.reposted = boolean(data.reposted, 'reposted');
  if (operation === 'toggleSavedPost') data.saved = boolean(data.saved, 'saved');
  if (operation === 'follow') data.following = boolean(data.following, 'following');
  if (operation === 'vote') data.optionId = positiveId(data.optionId, 'optionId');
  if (operation === 'recordViews') {
    if (!Array.isArray(data.postIds) || data.postIds.length > LIMITS.maxPage) throw new ValidationFailure({ postIds: 'Envie no máximo 50 publicações.' });
    data.postIds = [...new Set(data.postIds.map((id) => positiveId(id, 'postIds')))];
  }
  return data;
}

function fail(): never { throw new Error('Resposta incompatível com o contrato.'); }
const record = (value: unknown) => { try { return object(value); } catch { return fail(); } };
const number = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : fail();
const string = (value: unknown) => typeof value === 'string' ? value : fail();
const flag = (value: unknown) => typeof value === 'boolean' ? value : fail();
const date = (value: unknown) => value === null || typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value as string | null : fail();
export const decodeUser: Decoder<UserView> = (value) => {
  const data = record(value); const result: UserView = { id: positiveId(data.id), username: string(data.username) };
  for (const key of ['email', 'bio', 'avatar', 'cover', 'location', 'website'] as const) if (data[key] !== undefined) { if (data[key] !== null && typeof data[key] !== 'string') fail(); Object.assign(result, { [key]: data[key] }); }
  if (data.createdAt !== undefined) result.createdAt = date(data.createdAt);
  if (data.following !== undefined) result.following = flag(data.following);
  for (const key of ['followersCount', 'followingCount'] as const) if (data[key] !== undefined) result[key] = number(data[key]);
  return result;
};
export const decodePost: Decoder<PostView> = (value) => {
  const data = record(value); const result: PostView = { id: positiveId(data.id), userId: positiveId(data.userId), author: string(data.author), content: data.content === null ? '' : string(data.content), createdAt: date(data.createdAt) };
  for (const key of ['image', 'avatar'] as const) if (data[key] !== undefined) result[key] = data[key] === null ? null : string(data[key]);
  for (const key of ['likes', 'commentCount', 'reposts', 'views', 'shares'] as const) if (data[key] !== undefined) result[key] = data[key] === null ? 0 : number(data[key]);
  for (const key of ['liked', 'reposted', 'saved'] as const) if (data[key] !== undefined) result[key] = flag(data[key]);
  if (data.poll !== undefined) {
    if (data.poll === null) result.poll = null;
    else result.poll = decodePoll(data.poll);
  }
  if (data.pollPermissions !== undefined) result.pollPermissions = { canManage: flag(record(data.pollPermissions).canManage) };
  return result;
};
export const decodeComment: Decoder<CommentView> = (value) => {
  const data = record(value), permissions = record(data.permissions);
  const result: CommentView = { id: positiveId(data.id), userId: positiveId(data.userId), content: string(data.content), createdAt: date(data.createdAt) ?? fail(), permissions: { canEdit: flag(permissions.canEdit), canDelete: flag(permissions.canDelete) } };
  if (data.postId !== undefined) result.postId = positiveId(data.postId);
  if (data.user) { const user = record(data.user); result.user = { id: positiveId(user.id), username: string(user.username), avatar: user.avatar == null ? null : string(user.avatar) }; }
  return result;
};
export const decodeMessage: Decoder<MessageView> = (value) => {
  const data = record(value); const result: MessageView = { id: positiveId(data.id), senderId: positiveId(data.senderId), receiverId: positiveId(data.receiverId), content: string(data.content), createdAt: date(data.createdAt) ?? fail() };
  if (data.sender) { const sender = record(data.sender); result.sender = { username: string(sender.username), avatar: sender.avatar == null ? null : string(sender.avatar) }; } return result;
};
export const decodeNotification: Decoder<NotificationView> = (value) => {
  const data = record(value); const result: NotificationView = { id: positiveId(data.id), message: string(data.message), createdAt: date(data.createdAt) ?? fail() };
  if (data.isRead !== undefined) result.isRead = flag(data.isRead);
  if (data.actor) { const actor = record(data.actor); result.actor = { username: string(actor.username), avatar: actor.avatar == null ? null : string(actor.avatar) }; } return result;
};
export const decodePage = <T>(decode: Decoder<T>): Decoder<PageResult<T>> => (value) => { const data = record(value); if (!Array.isArray(data.items) || data.nextCursor !== null && typeof data.nextCursor !== 'string') fail(); return { items: data.items.map(decode), nextCursor: data.nextCursor as string | null }; };
export const decodeFields = <T extends Record<string, 'number' | 'boolean' | 'string'>>(keys: T): Decoder<{ [K in keyof T]: T[K] extends 'number' ? number : T[K] extends 'boolean' ? boolean : string }> => (value) => {
  const data = record(value); return Object.fromEntries(Object.entries(keys).map(([key, type]) => [key, type === 'number' ? number(data[key]) : type === 'boolean' ? flag(data[key]) : string(data[key])])) as never;
};
export const decodeObject = record;
export const decodeString: Decoder<string> = string;
export const decodeBoolean: Decoder<boolean> = flag;
export const decodeNumber: Decoder<number> = number;
export const decodeShape = <T extends Record<string, Decoder<unknown>>>(fields: T): Decoder<{ [K in keyof T]: ReturnType<T[K]> }> => (value) => {
  const data = record(value); return Object.fromEntries(Object.entries(fields).map(([key, decode]) => [key, decode(data[key])])) as never;
};
export const decodePoll: Decoder<NonNullable<PostView['poll']>> = (value) => {
  const poll = record(value); if (!Array.isArray(poll.options)) fail();
  return { options: poll.options.map((item) => { const option = record(item); return { id: positiveId(option.id), text: string(option.text), votes: number(option.votes) }; }), totalVotes: number(poll.totalVotes), votedOptionId: poll.votedOptionId === null ? null : positiveId(poll.votedOptionId) };
};

export const decodeFailure: Decoder<ApiFailure> = (value) => {
  const data = record(value), error = record(data.error);
  const codes: ErrorCode[] = ['VALIDATION_ERROR', 'SESSION_INVALID', 'INVALID_CREDENTIALS', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'PAYLOAD_TOO_LARGE', 'UNSUPPORTED_MEDIA', 'RATE_LIMITED', 'INTERNAL_ERROR', 'SERVICE_UNAVAILABLE', 'NETWORK_ERROR', 'INVALID_RESPONSE'];
  if (!codes.includes(error.code as ErrorCode)) fail();
  const fields = error.fields === undefined ? undefined : Object.fromEntries(Object.entries(record(error.fields)).map(([key, item]) => [key, string(item)]));
  return { error: { code: error.code as ErrorCode, message: string(error.message), ...(fields ? { fields } : {}) }, requestId: string(data.requestId) };
};
