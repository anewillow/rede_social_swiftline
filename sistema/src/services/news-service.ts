type TaylorNews = {
  id: string;
  title: string;
  url: string;
  description: string;
  publishedAt: string;
  source: string;
  image: string | null;
};

type GdeltArticle = {
  url?: string;
  title?: string;
  seendate?: string;
  socialimage?: string;
  domain?: string;
  sentence?: string;
  context?: string;
};

export class TaylorNewsService {
  private cache: { expiresAt: number; updatedAt: string; news: TaylorNews[] } | null = null;

  get updatedAt(): string | undefined {
    return this.cache?.updatedAt;
  }

  private publishedAt(value?: string): string {
    if (!value) return new Date().toISOString();
    const compact = value.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/);
    if (compact) {
      const [, year, month, day, hour, minute, second] = compact;
      return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  async getLatestNews(): Promise<TaylorNews[]> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.news;

    const apiUrl = new URL('https://api.gdeltproject.org/api/v2/context/context');
    apiUrl.searchParams.set('query', '"Taylor Swift"');
    apiUrl.searchParams.set('mode', 'artlist');
    apiUrl.searchParams.set('maxrecords', '75');
    apiUrl.searchParams.set('timespan', '72H');
    apiUrl.searchParams.set('format', 'json');

    const response = await fetch(apiUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Swiftline/1.0 Taylor news reader',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`GDELT respondeu ${response.status}`);

    const data = (await response.json()) as { articles?: GdeltArticle[] };
    const news = (data.articles ?? [])
      .filter(
        (article) => article.title && article.url && /taylor\s+swift/i.test(article.title),
      )
      .map((article, index) => {
        const source = article.domain?.replace(/^www\./, '') || 'GDELT';
        const publishedAt = this.publishedAt(article.seendate);
        const description = (article.context || article.sentence || '')
          .replace(/\s+/g, ' ')
          .trim();
        return {
          id: `${publishedAt}-${index}`,
          title: article.title!.trim(),
          url: article.url!,
          description: description || `Notícia sobre Taylor Swift publicada por ${source}.`,
          publishedAt,
          source,
          image: article.socialimage ? article.socialimage.replace(/^http:/, 'https:') : null,
        } satisfies TaylorNews;
      })
      .filter(
        (item, index, items) =>
          items.findIndex(
            (candidate) => candidate.title.toLowerCase() === item.title.toLowerCase(),
          ) === index,
      )
      .sort(
        (first, second) =>
          new Date(second.publishedAt).getTime() - new Date(first.publishedAt).getTime(),
      )
      .slice(0, 6);

    if (!news.length) throw new Error('Nenhuma notícia sobre Taylor Swift encontrada na GDELT');
    this.cache = {
      expiresAt: Date.now() + 5 * 60 * 1000,
      updatedAt: new Date().toISOString(),
      news,
    };
    return news;
  }
}
