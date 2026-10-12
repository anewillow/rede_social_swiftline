# Refatoração - 03: extrair classe de notícias

## Contexto e problema

Na Swiftline, a seção **Notícias agora** apresenta conteúdos obtidos pelo serviço GDELT. Para entregar essas notícias, o backend faz a consulta externa, ajusta as datas, remove resultados repetidos, ordena os conteúdos e mantém um cache de cinco minutos.

Poém, toda essa lógica está dentro de `app.ts`, o mesmo arquivo que organiza as rotas da aplicação. O código funciona, mas o arquivo ficou responsável por duas coisas diferentes: receber as requisições do sistema e controlar todos os detalhes das notícias. Como uma simples mudança no tempo do cache exige editar o arquivo que também contém as rotas de contas, posts, mensagens e outras funcionalidades.

O code smell identificado é a **concentração de responsabilidades**. Para resolvê-lo, será aplicada a **Extração de Classe**, conforme o Capítulo 9 do livro *Engenharia de Software Moderna* de Marco Tulio Valente.

## Antes da refatoração

Os tipos, o cache e a função que busca as notícias estão dentro de `app.ts`:

```ts
type TaylorNews = {
  id: string;
  title: string;
  url: string;
  description: string;
  publishedAt: string;
  source: string;
  image: string | null;
};

let taylorNewsCache: { expiresAt: number; updatedAt: string; news: TaylorNews[] } | null = null;

type GdeltArticle = {
  url?: string;
  title?: string;
  seendate?: string;
  socialimage?: string;
  domain?: string;
  sentence?: string;
  context?: string;
};

const gdeltPublishedAt = (value?: string) => {
  if (!value) return new Date().toISOString();
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/);
  if (compact) {
    const [, year, month, day, hour, minute, second] = compact;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

async function latestTaylorNews(): Promise<TaylorNews[]> {
  if (taylorNewsCache && taylorNewsCache.expiresAt > Date.now()) return taylorNewsCache.news;

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
      (article) =>
        article.title &&
        article.url &&
        /taylor\s+swift/i.test(article.title),
    )
    .map((article, index) => {
      const source = article.domain?.replace(/^www\./, '') || 'GDELT';
      const publishedAt = gdeltPublishedAt(article.seendate);
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
        items.findIndex((candidate) => candidate.title.toLowerCase() === item.title.toLowerCase()) ===
        index,
    )
    .sort(
      (first, second) =>
        new Date(second.publishedAt).getTime() - new Date(first.publishedAt).getTime(),
    )
    .slice(0, 6);

  if (!news.length) throw new Error('Nenhuma notícia sobre Taylor Swift encontrada na GDELT');
  taylorNewsCache = {
    expiresAt: Date.now() + 5 * 60 * 1000,
    updatedAt: new Date().toISOString(),
    news,
  };
  return news;
}
```

A rota de notícias também acessa diretamente a função e o cache:

```ts
app.get('/api/news', async (_req, res) => {
  try {
    const news = await latestTaylorNews();
    return res.json({
      news,
      updatedAt: taylorNewsCache?.updatedAt ?? new Date().toISOString(),
      refreshAfterSeconds: 300,
      source: 'GDELT Context 2.0',
    });
  } catch {
    return res
      .status(503)
      .json({ news: [], error: 'As notícias estão temporariamente indisponíveis.' });
  }
});
```

Os dois trechos mostram o problema: a rota `/api/news` e todos os detalhes usados por ela estão misturados no arquivo geral da aplicação.

- O código original completo foi preservado nos blocos acima como evidência do “antes”.

## Como a Extração de Classe resolve o problema

Será criada a classe `TaylorNewsService`. Ela vai receber tudo o que pertence às notícias: o cache, a conversão das datas, a consulta à GDELT e a preparação dos resultados. Como esses dados e essas operações fazem parte da mesma responsabilidade, passam a ficar juntos em uma única classe.

A rota `/api/news` deixará de conhecer os detalhes da GDELT e do cache. Ela apenas solicitará as notícias à nova classe e devolverá a resposta. Assim, `app.ts` continua cuidando das rotas e `TaylorNewsService` passa a cuidar das notícias.

Na prática, poderá ser alterado o cache, trocar a fonte externa ou testar o tratamento das notícias na nova classe, sem procurar essas regras entre todas as rotas do sistema. A mudança não altera o que aparece para o usuário o ela torna a manutenção dessa funcionalidade mais localizada.

> [!IMPORTANT]
> **Antes:** `app.ts` controla a rota, a GDELT, o tratamento dos dados e o cache.  
> **Depois:** `app.ts` controla a rota e `TaylorNewsService` controla a integração, o tratamento e o cache.

## Depois da refatoração

A lógica das notícias foi reunida na nova classe `TaylorNewsService`:

```ts
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
```

O `app.ts` passou a importar e criar uma instância da classe:

```ts
import { TaylorNewsService } from './taylor-news-service.js';

const taylorNewsService = new TaylorNewsService();
```

A rota permaneceu com o mesmo endereço e o mesmo formato de resposta, mas agora solicita os dados à classe:

```ts
app.get('/api/news', async (_req, res) => {
  try {
    const news = await taylorNewsService.getLatestNews();
    return res.json({
      news,
      updatedAt: taylorNewsService.updatedAt ?? new Date().toISOString(),
      refreshAfterSeconds: 300,
      source: 'GDELT Context 2.0',
    });
  } catch {
    return res
      .status(503)
      .json({ news: [], error: 'As notícias estão temporariamente indisponíveis.' });
  }
});
```

- [`TaylorNewsService` completa](../../sistema/src/taylor-news-service.ts)
- [Importação em `app.ts`](../../sistema/src/app.ts#L40)
- [Instância do serviço em `app.ts`](../../sistema/src/app.ts#L43)
- [Rota `/api/news` atualizada](../../sistema/src/app.ts#L450-L464)

## Critérios de aceitação

- [x] A seção **Notícias agora** continua sendo carregada.
- [x] O cache continua válido por cinco minutos.
- [x] A rota `/api/news` preserva o formato atual da resposta.
- [x] O comportamento externo permanece igual após a refatoração.

## Evidência em vídeo

- [Vídeo único — antes e depois da refatoração](../evidencias/issue-03-antes-e-depois-extracao-de-classe-noticias.mp4)
