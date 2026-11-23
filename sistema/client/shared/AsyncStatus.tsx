import './api.css';
export function AsyncStatus({ loading, error, retry }: { loading: boolean; error: string; retry: () => unknown }) {
  if (error) return <p className="api-status" role="alert">{error} <button type="button" onClick={() => void retry()}>Tentar novamente</button></p>;
  return loading ? <p className="api-status" role="status">Aguarde...</p> : null;
}
export function MoreItems({ cursor, loading, load, label = 'Carregar mais' }: { cursor: string | null; loading: boolean; load: () => unknown; label?: string }) {
  return cursor ? <button type="button" className="api-more" disabled={loading} onClick={() => void load()}>{label}</button> : null;
}
