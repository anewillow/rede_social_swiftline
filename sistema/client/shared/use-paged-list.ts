import { useCallback, useEffect, useRef, useState } from 'react';
import type { PageResult } from '../../shared/contracts/index';
import { isAbort, messageOf } from './api';

export function usePagedList<T extends { id: number }>(key: string, fetchPage: (signal: AbortSignal, cursor?: string | null) => Promise<PageResult<T>>, enabled = true) {
  const fetcher = useRef(fetchPage); fetcher.current = fetchPage;
  const active = useRef<AbortController | null>(null);
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const failedCursor = useRef<string | null>(null);
  const load = useCallback(async (cursor: string | null = null) => {
    active.current?.abort();
    if (!enabled) { setLoading(false); return; }
    const controller = new AbortController(); active.current = controller;
    setLoading(true); setError(''); failedCursor.current = cursor;
    try {
      const result = await fetcher.current(controller.signal, cursor);
      if (controller.signal.aborted) return;
      setItems((current) => cursor ? [...new Map([...current, ...result.items].map((item) => [item.id, item])).values()] : result.items);
      setNextCursor(result.nextCursor);
    } catch (failure) { if (!controller.signal.aborted && !isAbort(failure)) setError(messageOf(failure)); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [key, enabled]);
  useEffect(() => { setItems([]); setNextCursor(null); void load(); return () => active.current?.abort(); }, [load]);
  return { items, setItems, nextCursor, loading, error, reload: () => load(), retry: () => load(failedCursor.current), loadMore: () => nextCursor && !loading ? load(nextCursor) : Promise.resolve() };
}
