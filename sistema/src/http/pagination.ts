import { createHash } from 'node:crypto';
import { Op, type WhereOptions } from 'sequelize';
import { LIMITS, ValidationFailure } from '../../shared/contracts/index.js';
import type { ServiceInput } from '../types/service.js';

type Ordered = { id: number; createdAt?: Date | string | null };
export function pageWindow(req: ServiceInput, scope: string, direction: 'ASC' | 'DESC' = 'DESC', cursorName = 'cursor') {
  const enabled = req.apiVersion === 2;
  const limitValue = req.query.limit ?? LIMITS.page;
  const limit = Number(limitValue);
  if (enabled && (!['string', 'number'].includes(typeof limitValue) || !/^\d+$/.test(String(limitValue)) || !Number.isInteger(limit) || limit < 1 || limit > LIMITS.maxPage)) throw new ValidationFailure({ limit: 'Use de 1 a 50 itens por página.' });
  const token = req.query[cursorName];
  const identity = createHash('sha256').update(scope + ':' + (req.userId ?? 'public')).digest('hex').slice(0, 24);
  let cursor: { identity: string; date: string | null; id: number } | null = null;
  if (enabled && token !== undefined) {
    try {
      if (typeof token !== 'string' || token.length > 600 || !/^[a-zA-Z0-9_-]+$/.test(token)) throw new Error();
      cursor = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
      if (!cursor || cursor.identity !== identity || !Number.isSafeInteger(cursor.id) || cursor.id < 1 || cursor.date !== null && (typeof cursor.date !== 'string' || !Number.isFinite(Date.parse(cursor.date)))) throw new Error();
    } catch { throw new ValidationFailure({ [cursorName]: 'Página inválida. Recarregue a lista.' }); }
  }
  const compare = direction === 'DESC' ? Op.lt : Op.gt;
  const cursorWhere: WhereOptions = !cursor ? {} : cursor.date === null
    ? direction === 'DESC' ? { createdAt: null, id: { [compare]: cursor.id } } : { [Op.or]: [{ createdAt: null, id: { [compare]: cursor.id } }, { createdAt: { [Op.ne]: null } }] }
    : { [Op.or]: [{ createdAt: { [compare]: new Date(cursor.date) } }, { createdAt: new Date(cursor.date), id: { [compare]: cursor.id } }, ...(direction === 'DESC' ? [{ createdAt: null }] : [])] };
  return {
    options: enabled ? { limit: limit + 1, order: [['createdAt', direction], ['id', direction]] as Array<[string, 'ASC' | 'DESC']> } : {},
    where: (base: WhereOptions): WhereOptions => enabled && cursor ? { [Op.and]: [base, cursorWhere] } : base,
    take: <T>(items: T[]) => enabled ? items.slice(0, limit) : items,
    wrap: <T>(items: T[], raw: Ordered[]) => {
      if (!enabled) return items;
      const last = raw[Math.min(raw.length, limit) - 1];
      const nextCursor = raw.length > limit && last ? Buffer.from(JSON.stringify({ identity, date: last.createdAt ? new Date(last.createdAt).toISOString() : null, id: last.id })).toString('base64url') : null;
      return { items, nextCursor };
    },
  };
}
