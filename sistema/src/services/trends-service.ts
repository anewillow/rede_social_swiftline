type TaylorTrend = { tag: string; count: number; kind: 'Álbum' | 'Música' };
type TaylorTopic = { tag: string; article: string; kind: TaylorTrend['kind'] };

const taylorTopics: TaylorTopic[] = [
  { tag: 'The Life of a Showgirl', article: 'The_Life_of_a_Showgirl', kind: 'Álbum' },
  { tag: 'The Tortured Poets Department', article: 'The_Tortured_Poets_Department', kind: 'Álbum' },
  { tag: 'Midnights', article: 'Midnights', kind: 'Álbum' },
  { tag: 'evermore', article: 'Evermore_(Taylor_Swift_album)', kind: 'Álbum' },
  { tag: 'folklore', article: 'Folklore_(Taylor_Swift_album)', kind: 'Álbum' },
  { tag: 'Lover', article: 'Lover_(album)', kind: 'Álbum' },
  { tag: 'reputation', article: 'Reputation_(album)', kind: 'Álbum' },
  { tag: '1989', article: '1989_(Taylor_Swift_album)', kind: 'Álbum' },
  { tag: 'Red', article: 'Red_(Taylor_Swift_album)', kind: 'Álbum' },
  { tag: 'Speak Now', article: 'Speak_Now', kind: 'Álbum' },
  { tag: 'Fearless', article: 'Fearless_(Taylor_Swift_album)', kind: 'Álbum' },
  { tag: 'Taylor Swift', article: 'Taylor_Swift_(album)', kind: 'Álbum' },
  { tag: 'The Fate of Ophelia', article: 'The_Fate_of_Ophelia', kind: 'Música' },
  { tag: 'Opalite', article: 'Opalite_(song)', kind: 'Música' },
  { tag: 'Fortnight', article: 'Fortnight_(song)', kind: 'Música' },
  { tag: 'Cruel Summer', article: 'Cruel_Summer_(Taylor_Swift_song)', kind: 'Música' },
  { tag: 'Anti-Hero', article: 'Anti-Hero_(song)', kind: 'Música' },
  { tag: 'All Too Well', article: 'All_Too_Well', kind: 'Música' },
  { tag: 'Blank Space', article: 'Blank_Space', kind: 'Música' },
  { tag: 'Shake It Off', article: 'Shake_It_Off', kind: 'Música' },
  { tag: 'Love Story', article: 'Love_Story_(Taylor_Swift_song)', kind: 'Música' },
  { tag: 'cardigan', article: 'Cardigan_(song)', kind: 'Música' },
];

let taylorTrendCache: { expiresAt: number; trends: TaylorTrend[] } | null = null;

const pageviewDate = (date: Date) =>
  `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;

export async function globalTaylorTrends(): Promise<TaylorTrend[]> {
  if (taylorTrendCache && taylorTrendCache.expiresAt > Date.now()) return taylorTrendCache.trends;
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  const startDate = pageviewDate(start);
  const endDate = pageviewDate(end);
  const results = await Promise.allSettled(
    taylorTopics.map(async (topic) => {
      const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/${encodeURIComponent(topic.article)}/daily/${startDate}/${endDate}`;
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'Swiftline/1.0 Taylor trends' },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`Wikimedia respondeu ${response.status}`);
      const data = (await response.json()) as { items?: Array<{ views?: number }> };
      return {
        tag: topic.tag,
        kind: topic.kind,
        count: (data.items ?? []).reduce((total, item) => total + Number(item.views ?? 0), 0),
      } satisfies TaylorTrend;
    }),
  );
  const trends = results
    .flatMap((result) =>
      result.status === 'fulfilled' && result.value.count > 0 ? [result.value] : [],
    )
    .sort((first, second) => second.count - first.count)
    .slice(0, 5);
  if (!trends.length) throw new Error('Dados globais indisponíveis');
  taylorTrendCache = { expiresAt: Date.now() + 30 * 60 * 1000, trends };
  return trends;
}
