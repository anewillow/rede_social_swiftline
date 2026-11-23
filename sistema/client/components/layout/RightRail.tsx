import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { PeopleRail } from './PeopleRail';
import type { SearchResults, NewsItem } from '../../types/index';
import { discoveryApi } from '../../services/discovery-api';
import { AsyncStatus, MoreItems } from '../../shared/AsyncStatus';
import { messageOf } from '../../shared/api';

export function RightRail({ openProfile }: { openProfile: (username: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsUpdatedAt, setNewsUpdatedAt] = useState<string | null>(null);
  const [newsSource, setNewsSource] = useState('GDELT Context 2.0');
  const [featuredNews, setFeaturedNews] = useState(0);
  const [searchError, setSearchError] = useState(''), [newsError, setNewsError] = useState('');
  const [attempt, setAttempt] = useState(0), [newsAttempt, setNewsAttempt] = useState(0);
  const [cursors, setCursors] = useState({ users: null as string | null, posts: null as string | null });
  const [more, setMore] = useState<'users' | 'posts' | null>(null);
  useEffect(() => {
    const term = query.trim(); const controller = new AbortController();
    setResults(null); setSearchError(''); setCursors({ users: null, posts: null });
    if (term.length < 2) { setSearching(false); return; }
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await discoveryApi.search(term, controller.signal);
        if (controller.signal.aborted) return;
        setResults({ users: result.users.items, posts: result.posts.items });
        setCursors({ users: result.users.nextCursor, posts: result.posts.nextCursor });
      } catch (error) { if (!controller.signal.aborted) setSearchError(messageOf(error)); }
      finally { if (!controller.signal.aborted) setSearching(false); }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, attempt]);
  useEffect(() => {
    if (!more || !cursors[more]) return;
    const controller = new AbortController(); setSearching(true); setSearchError('');
    discoveryApi.search(query.trim(), controller.signal, { [more + 'Cursor']: cursors[more]! })
      .then((result) => { if (!controller.signal.aborted) {
        setResults((current) => current ? { ...current, [more]: [...new Map([...current[more], ...result[more].items].map((item) => [item.id, item])).values()] } : current);
        setCursors((current) => ({ ...current, [more]: result[more].nextCursor }));
      } }).catch((error) => { if (!controller.signal.aborted) setSearchError(messageOf(error)); })
      .finally(() => { if (!controller.signal.aborted) { setSearching(false); setMore(null); } });
    return () => controller.abort();
  }, [more, query]);
  useEffect(() => {
    const controller = new AbortController(); let active = false;
    const loadNews = async () => {
      if (active) return; active = true;
      try {
        const result = await discoveryApi.getNews(controller.signal);
        if (controller.signal.aborted) return;
        setNews(result.news); setNewsUpdatedAt(result.updatedAt ?? null);
        setNewsSource(result.source ?? 'GDELT Context 2.0'); setNewsError('');
        setFeaturedNews((index) => result.news.length ? index % result.news.length : 0);
      } catch (error) { if (!controller.signal.aborted) setNewsError(messageOf(error)); }
      finally { active = false; if (!controller.signal.aborted) setNewsLoading(false); }
    };
    void loadNews();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void loadNews(); }, 30000);
    return () => { window.clearInterval(timer); controller.abort(); };
  }, [newsAttempt]);

  useEffect(() => {
    if (news.length < 2) return;
    const timer = window.setInterval(
      () => setFeaturedNews((index) => (index + 1) % news.length),
      8 * 1000,
    );
    return () => window.clearInterval(timer);
  }, [news.length]);
  const closeSearch = () => {
    setMore(null);
    setQuery('');
    setResults(null);
  };
  const openPost = (postId: number) => {
    history.pushState({}, '', `/feed.html#post-${postId}`);
    dispatchEvent(new PopStateEvent('popstate'));
    closeSearch();
    window.setTimeout(
      () =>
        document
          .getElementById(`post-${postId}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      150,
    );
  };
  const hasResults = Boolean(results?.users.length || results?.posts.length);
  const displayedNews = news.length
    ? [news[featuredNews], ...news.filter((_item, index) => index !== featuredNews)]
    : [];
  return (
    <aside className="right-rail">
      <form className="rail-search" onSubmit={(event) => event.preventDefault()}>
        <Search size={18} />
        <input
          value={query}
          maxLength={120}
          onChange={(event) => { setMore(null); setQuery(event.target.value); }}
          placeholder="Buscar pessoas e posts"
          aria-label="Buscar pessoas e publicações na Swiftline"
        />
        {query && (
          <button type="button" aria-label="Limpar busca" onClick={closeSearch}>
            ×
          </button>
        )}
      </form>
      {query.trim().length >= 2 && (
        <section className="rail-results" aria-live="polite">
          <AsyncStatus loading={false} error={searchError} retry={() => setAttempt((value) => value + 1)} />
          {searching && !hasResults ? (
            <p className="rail-empty">Buscando...</p>
          ) : hasResults ? (
            <>
              {Boolean(results?.users.length) && (
                <div>
                  <h3>Pessoas</h3>
                  {results?.users.map((person) => (
                    <button
                      key={person.id}
                      onClick={() => {
                        openProfile(person.username);
                        closeSearch();
                      }}
                    >
                      <Avatar person={person} />
                      <span>
                        <strong>{person.username}</strong>
                        <small>@{person.username.replace(/\s/g, '').toLowerCase()}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {Boolean(results?.posts.length) && (
                <div>
                  <h3>Publicações</h3>
                  {results?.posts.map((post) => (
                    <button key={post.id} onClick={() => openPost(post.id)}>
                      <span>
                        <strong>{post.author}</strong>
                        <small>
                          {post.content.slice(0, 70)}
                          {post.content.length > 70 ? '…' : ''}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="rail-empty">Nenhuma pessoa ou publicação encontrada.</p>
          )}
          <MoreItems cursor={cursors.users} loading={searching} load={() => setMore('users')} label="Mais pessoas" />
          <MoreItems cursor={cursors.posts} loading={searching} load={() => setMore('posts')} label="Mais publicações" />
        </section>
      )}
      <section className="news-list" aria-live="polite">
        <header className="news-heading">
          <h2>Notícias agora</h2>
          <span>AO VIVO</span>
        </header>
        <AsyncStatus loading={false} error={newsError} retry={() => setNewsAttempt((value) => value + 1)} />
        {newsLoading && !news.length ? (
          <p className="rail-empty">Carregando notícias...</p>
        ) : displayedNews.length ? (
          displayedNews.map((item, index) => (
            <a
              className={index === 0 ? 'news-card featured' : 'news-card'}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              key={item.id}
            >
              {item.image && (
                <img
                  src={item.image}
                  alt={`Imagem da notícia: ${item.title}`}
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <div>
                <small>
                  {item.source} ·{' '}
                  {new Date(item.publishedAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </small>
                <strong>{item.title}</strong>
                {index === 0 && item.description && (
                  <p>
                    {item.description.slice(0, 120)}
                    {item.description.length > 120 ? '…' : ''}
                  </p>
                )}
              </div>
            </a>
          ))
        ) : (
          <p className="rail-empty">As notícias estão temporariamente indisponíveis.</p>
        )}
        <p className="news-update">
          <span aria-hidden="true" />
          Fonte: {newsSource} · atualizada{' '}
          {newsUpdatedAt
            ? new Date(newsUpdatedAt).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })
            : 'agora'}{' '}
          · cache de 5 min
        </p>
      </section>
      <PeopleRail openProfile={openProfile} />
      <section className="daily-note">
        <span>✦</span>
        <div>
          <strong>Constelação do dia</strong>
          <p>Guarde o que fez sentido hoje.</p>
        </div>
      </section>
    </aside>
  );
}
