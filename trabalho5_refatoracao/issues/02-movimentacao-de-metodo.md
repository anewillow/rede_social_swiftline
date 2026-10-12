# Refatoração - 02: mover a montagem dos dados de posts

## Problema identificado

A função `postsWithActivity` trabalha somente com posts e suas interações, mas está localizada no arquivo geral da aplicação, o `app.ts`.

Isso caracteriza uma **responsabilidade mal posicionada**, pois uma regra específica de posts está dentro do módulo que também configura todas as rotas do sistema.

## Refatoração escolhida

**Movimentação de Método**, conforme o catálogo apresentado no Capítulo 9 do livro *Engenharia de Software Moderna* de Marco Tulio Valente.

## Antes da refatoração

A função está dentro do arquivo `app.ts`:

```ts
async function postsWithActivity(
  posts: Post[],
  userId?: number,
): Promise<Record<string, unknown>[]> {
  const postIds = posts.map((post) => post.id);
  if (!postIds.length) return [];
  const [
    likes,
    reposts,
    savedPosts,
    commentCounts,
    repostCounts,
    viewCounts,
    pollOptions,
    pollVotes,
  ] = await Promise.all([
    userId ? Like.findAll({ where: { userId, postId: postIds } }) : Promise.resolve([]),
    userId ? Repost.findAll({ where: { userId, postId: postIds } }) : Promise.resolve([]),
    userId ? SavedPost.findAll({ where: { userId, postId: postIds } }) : Promise.resolve([]),
    Comment.count({ where: { postId: postIds }, group: 'postId' }),
    Repost.count({ where: { postId: postIds }, group: 'postId' }),
    PostView.count({ where: { postId: postIds }, group: 'postId' }),
    PollOption.findAll({ where: { postId: postIds }, order: [['position', 'ASC']] }),
    PollVote.findAll({ where: { postId: postIds } }),
  ]);
  const likedIds = new Set(likes.map((like) => like.postId));
  const repostedIds = new Set(reposts.map((repost) => repost.postId));
  const savedIds = new Set(savedPosts.map((savedPost) => savedPost.postId));
  const toCountMap = (rows: unknown) =>
    new Map((rows as GroupedCount[]).map((row) => [Number(row.postId), Number(row.count)]));
  const commentsByPostId = toCountMap(commentCounts);
  const repostsByPostId = toCountMap(repostCounts);
  const viewsByPostId = toCountMap(viewCounts);
  const votesByOptionId = new Map<number, number>();
  const votedOptionByPostId = new Map<number, number>();
  for (const vote of pollVotes) {
    votesByOptionId.set(vote.optionId, (votesByOptionId.get(vote.optionId) ?? 0) + 1);
    if (userId === vote.userId) votedOptionByPostId.set(vote.postId, vote.optionId);
  }
  const optionsByPostId = new Map<number, Array<{ id: number; text: string; votes: number }>>();
  for (const option of pollOptions) {
    const options = optionsByPostId.get(option.postId) ?? [];
    options.push({ id: option.id, text: option.text, votes: votesByOptionId.get(option.id) ?? 0 });
    optionsByPostId.set(option.postId, options);
  }
  return posts.map((post) => {
    const options = optionsByPostId.get(post.id) ?? [];
    return {
      ...post.toJSON(),
      liked: likedIds.has(post.id),
      reposted: repostedIds.has(post.id),
      saved: savedIds.has(post.id),
      commentCount: commentsByPostId.get(post.id) ?? 0,
      reposts: repostsByPostId.get(post.id) ?? 0,
      views: viewsByPostId.get(post.id) ?? 0,
      poll: options.length
        ? {
            options,
            totalVotes: options.reduce((total, option) => total + option.votes, 0),
            votedOptionId: votedOptionByPostId.get(post.id) ?? null,
          }
        : null,
      pollPermissions: { canManage: userId === post.userId },
    };
  });
}
```

> [!WARNING]
> **Como está antes**
>
> A função monta todos os dados apresentados nas publicações, mas está no arquivo geral `app.ts`. Isso aumenta a responsabilidade desse arquivo e deixa uma regra específica de posts fora de seu contexto.

- O código original completo foi preservado no bloco acima como evidência do “antes”.

## Depois da refatoração

A função foi movida para o arquivo `post-activity.ts` sem mudanças em sua lógica:

```ts
import {
  Comment,
  Like,
  PollOption,
  PollVote,
  Post,
  PostView,
  Repost,
  SavedPost,
} from './models/index.js';

type GroupedCount = { postId: number | string; count: number | string };

export async function postsWithActivity(
  posts: Post[],
  userId?: number,
): Promise<Record<string, unknown>[]> {
  const postIds = posts.map((post) => post.id);
  if (!postIds.length) return [];
  const [
    likes,
    reposts,
    savedPosts,
    commentCounts,
    repostCounts,
    viewCounts,
    pollOptions,
    pollVotes,
  ] = await Promise.all([
    userId ? Like.findAll({ where: { userId, postId: postIds } }) : Promise.resolve([]),
    userId ? Repost.findAll({ where: { userId, postId: postIds } }) : Promise.resolve([]),
    userId ? SavedPost.findAll({ where: { userId, postId: postIds } }) : Promise.resolve([]),
    Comment.count({ where: { postId: postIds }, group: 'postId' }),
    Repost.count({ where: { postId: postIds }, group: 'postId' }),
    PostView.count({ where: { postId: postIds }, group: 'postId' }),
    PollOption.findAll({ where: { postId: postIds }, order: [['position', 'ASC']] }),
    PollVote.findAll({ where: { postId: postIds } }),
  ]);
  const likedIds = new Set(likes.map((like) => like.postId));
  const repostedIds = new Set(reposts.map((repost) => repost.postId));
  const savedIds = new Set(savedPosts.map((savedPost) => savedPost.postId));
  const toCountMap = (rows: unknown) =>
    new Map((rows as GroupedCount[]).map((row) => [Number(row.postId), Number(row.count)]));
  const commentsByPostId = toCountMap(commentCounts);
  const repostsByPostId = toCountMap(repostCounts);
  const viewsByPostId = toCountMap(viewCounts);
  const votesByOptionId = new Map<number, number>();
  const votedOptionByPostId = new Map<number, number>();
  for (const vote of pollVotes) {
    votesByOptionId.set(vote.optionId, (votesByOptionId.get(vote.optionId) ?? 0) + 1);
    if (userId === vote.userId) votedOptionByPostId.set(vote.postId, vote.optionId);
  }
  const optionsByPostId = new Map<number, Array<{ id: number; text: string; votes: number }>>();
  for (const option of pollOptions) {
    const options = optionsByPostId.get(option.postId) ?? [];
    options.push({ id: option.id, text: option.text, votes: votesByOptionId.get(option.id) ?? 0 });
    optionsByPostId.set(option.postId, options);
  }
  return posts.map((post) => {
    const options = optionsByPostId.get(post.id) ?? [];
    return {
      ...post.toJSON(),
      liked: likedIds.has(post.id),
      reposted: repostedIds.has(post.id),
      saved: savedIds.has(post.id),
      commentCount: commentsByPostId.get(post.id) ?? 0,
      reposts: repostsByPostId.get(post.id) ?? 0,
      views: viewsByPostId.get(post.id) ?? 0,
      poll: options.length
        ? {
            options,
            totalVotes: options.reduce((total, option) => total + option.votes, 0),
            votedOptionId: votedOptionByPostId.get(post.id) ?? null,
          }
        : null,
      pollPermissions: { canManage: userId === post.userId },
    };
  });
}
```

O `app.ts` passou a importar a função do novo arquivo:

```ts
import { postsWithActivity } from './post-activity.js';
```

> [!TIP]
> **Como ficou depois**
>
> A lógica específica das publicações agora está em `post-activity.ts`. O `app.ts` apenas importa e utiliza a função nas rotas que precisam montar os dados dos posts.

> [!IMPORTANT]
> **O comportamento não mudou:** as consultas, os cálculos, o retorno da função e todos os locais que a utilizam foram mantidos.

- [`post-activity.ts` completo](../../sistema/src/post-activity.ts)
- [Importação em `app.ts`](../../sistema/src/app.ts#L39)
- [Utilização da função nas rotas](../../sistema/src/app.ts#L391)

## Justificativa

Mover `postsWithActivity` para um módulo responsável pelos posts deixou essa regra no local adequado e reduziu a quantidade de responsabilidades do `app.ts`.

## Resultado obtido

- a função foi movida para `post-activity.ts`;
- os locais que chamam a função continuam funcionando pela nova importação;
- os mesmos dados continuam sendo montados para as publicações;
- a aplicação compilou e os nove testes existentes passaram.

## Critérios de aceitação

- [x] O feed continua exibindo as mesmas publicações.
- [x] Curtidas, repostagens, comentários e itens salvos continuam sendo informados corretamente.
- [x] As enquetes continuam exibindo opções, votos e permissões.
- [x] O comportamento externo permanece igual após a refatoração.

## Evidência em vídeo

- [Vídeo único — antes e depois da refatoração](../evidencias/issue-02-antes-e-depois-movimentacao-de-metodo.mp4)
