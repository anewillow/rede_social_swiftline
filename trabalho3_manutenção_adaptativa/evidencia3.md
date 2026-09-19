# TP3 - Manutenção Adaptativa

## Estratégia 3 — Migração de API externa

**Equipe:** Dayane Rodrigues, Lucas Marinho e Victória Caroline Alves  
**Professor:** Andrey Rodrigues

---

## Problema

O Swiftline utilizava o feed RSS do Bing para exibir notícias sobre Taylor Swift. Essa fonte retornava os dados em XML. Como estratégia de manutenção adaptativa, migramos a funcionalidade para a API GDELT, que retorna os resultados em JSON.

---

## Justificativa da escolha da GDELT

Escolhemos a GDELT porque ela oferece acesso público sem exigir uma chave de autenticação e permite pesquisar notícias recentes de diferentes fontes. A API retorna os dados em JSON e fornece informações que o Swiftline precisa, como título, link, fonte, data, imagem e descrição.

Também conseguimos direcionar a consulta para notícias relacionadas a Taylor Swift. Por esses motivos, consideramos a GDELT adequada para substituir o Bing RSS e manter a área de notícias do sistema atualizada.

---

## Testes no Postman

Antes de apresentarmos o resultado no sistema, testamos as duas fontes no Postman.

Na requisição ao Bing RSS, recebemos o status `200 OK` e uma resposta em XML. Na requisição à API GDELT, também recebemos o status `200 OK`, mas com a resposta em JSON. Esses testes comprovaram que as duas fontes estavam acessíveis e permitiram verificar a diferença entre os formatos retornados.

---

## Adaptação realizada

Substituímos a requisição ao Bing RSS pela consulta à API GDELT Context 2.0. Configuramos a pesquisa para buscar notícias recentes relacionadas a Taylor Swift.

Como a resposta direta da GDELT também podia conter matérias que apenas mencionavam Taylor Swift no texto, adicionamos um filtro para manter somente os resultados que apresentam o nome dela no título. Também removemos títulos repetidos, organizamos as notícias pelas mais recentes e limitamos a quantidade exibida.

Adaptamos os campos recebidos para que o Swiftline continuasse mostrando o título, a fonte, a data, a imagem, a descrição e o link da matéria. Também adicionamos um cache de cinco minutos e uma mensagem para situações em que a fonte estiver temporariamente indisponível.

### Código alterado

- `src/app.ts`: consulta à GDELT, conversão dos dados, filtro das notícias, cache e rota `/api/news`.
- `client/App.tsx`: exibição das notícias e identificação da fonte **GDELT Context 2.0**.

### Trechos principais da mudança

Antes, criávamos uma requisição para o Bing RSS e transformávamos a resposta em texto para ler o XML:

```typescript
const feedUrl = new URL('https://www.bing.com/news/search');
feedUrl.searchParams.set('q', '"Taylor Swift" loc:BR');
feedUrl.searchParams.set('format', 'rss');

const response = await fetch(feedUrl, {
  headers: {
    Accept: 'application/rss+xml, application/xml;q=0.9',
  },
});

const xml = await response.text();
const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
```

Depois, passamos a consultar a GDELT e a ler a resposta em JSON. Também filtramos os resultados para manter somente as notícias com Taylor Swift no título:

```typescript
const apiUrl = new URL('https://api.gdeltproject.org/api/v2/context/context');
apiUrl.searchParams.set('query', '"Taylor Swift"');
apiUrl.searchParams.set('mode', 'artlist');
apiUrl.searchParams.set('maxrecords', '75');
apiUrl.searchParams.set('timespan', '72H');
apiUrl.searchParams.set('format', 'json');

const response = await fetch(apiUrl, {
  headers: { Accept: 'application/json' },
  signal: AbortSignal.timeout(15000),
});

const data = (await response.json()) as { articles?: GdeltArticle[] };
const news = (data.articles ?? []).filter(
  (article) =>
    article.title &&
    article.url &&
    /taylor\s+swift/i.test(article.title),
);
```

Por fim, alteramos a identificação da fonte e o tempo do cache retornados pela rota de notícias:

```typescript
return res.json({
  news,
  updatedAt: taylorNewsCache?.updatedAt ?? new Date().toISOString(),
  refreshAfterSeconds: 300,
  source: 'GDELT Context 2.0',
});
```

---

## Evidência

[Assistir ao vídeo da estratégia 3](https://github.com/user-attachments/assets/f7dfdaef-1034-44a8-9898-8de9632152b2)

Em um único vídeo, mostramos o antes e o depois da estratégia:

1. o funcionamento anterior das notícias com o Bing RSS;
2. a requisição ao Bing no Postman, com resposta em XML;
3. a requisição à GDELT no Postman, com resposta em JSON;
4. os principais trechos do código modificados;
5. o endereço `http://127.0.0.1:3000/api/news` retornando as notícias integradas;
6. as notícias sendo exibidas no Swiftline;
7. a identificação da fonte **GDELT Context 2.0** e do cache de cinco minutos.

---

## Resultado

Concluímos a migração da fonte externa. O Swiftline deixou de depender do Bing RSS e passou a carregar notícias pela API GDELT, mantendo as informações necessárias e exibindo somente resultados filtrados sobre Taylor Swift.
