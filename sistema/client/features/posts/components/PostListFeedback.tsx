export function PostListFeedback({ loading, error, empty, reload }: {
  loading: boolean;
  error: string;
  empty: boolean;
  reload: () => Promise<void>;
}) {
  if (error) return <div className="post-list-feedback" role="alert">{error} <button type="button" onClick={() => void reload()}>Tentar novamente</button></div>;
  if (loading && empty) return <p className="post-list-feedback" role="status">Carregando publicações...</p>;
  return null;
}
