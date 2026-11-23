# Trabalho 6 — Reengenharia arquitetural do Swiftline

## Introdução

O Swiftline é um protótipo de rede social que permite publicar conteúdos, interagir e trocar mensagens. A reengenharia arquitetural foi aplicada a seis pontos do sistema para separar responsabilidades, reduzir a repetição de código e reorganizar a comunicação entre suas partes.

## 1. Exclusão de contas

**Antes:** o coordenador `deleteAccountRecords`, dentro de `app.ts`, solicitava listas de IDs e as repassava às funções responsáveis pelas exclusões.

```ts
async function deleteAccountRecords(user: User) {
  await sequelize.transaction(async (transaction) => {
    const { postIds, commentIds } = await findAccountContentIds(user.id, transaction);
    await deleteAccountInteractions(user.id, postIds, commentIds, transaction);
    await deleteAccountRelationships(user.id, transaction);
    await deleteAccountContent(user, postIds, transaction);
  });
}

```

**Depois:** a coordenação passou para `delete-account.ts`. Cada módulo recebe o ID do usuário, localiza seus registros e executa sua parte da exclusão.

```ts
    await dependencies.unitOfWork.run(async (modules) => {
      await modules.posts.removeAccountData(account.id);
      await modules.network.removeAccountData(account.id);
      await modules.messages.removeAccountData(account.id);
      await modules.notifications.removeAccountData(account.id);
      await modules.accounts.removeAccount(account.id);
    });
```

A sequência e a transação foram preservadas. A mudança está na divisão do trabalho: o coordenador controla as etapas, e cada módulo cuida dos dados da sua área.

## 2. Dados do autor

**Antes:** cada publicação guardava uma cópia do nome e da foto do autor. Alterar o perfil exigia atualizar também essas cópias.

Trecho de `app.ts`:

```ts
      if (user.username !== previousUsername || user.avatar !== previousAvatar) {
        await Post.update(
          { author: user.username, avatar: user.avatar },
          { where: { userId: user.id }, transaction },
        );
      }
```

**Depois:** as publicações mantêm o `userId`. O arquivo `post-authors.ts` utiliza esse identificador para consultar o nome e a foto atuais no módulo de Contas.

```ts
import type { AuthorDirectory } from '../../accounts/public.js';

export async function resolvePostAuthors<T extends { userId: number }>(
  posts: T[],
  directory: AuthorDirectory,
): Promise<Array<T & { author: string; avatar: string | null }>> {
  if (!posts.length) return [];
  const authors = await directory.findByIds([...new Set(posts.map((post) => post.userId))]);
  const byId = new Map(authors.map((author) => [author.id, author]));
  return posts.map((post) => {
    const author = byId.get(post.userId);
    return {
      ...post,
      author: author?.username ?? 'Usuário indisponível',
      avatar: author?.avatar ?? null,
    };
  });
}
```

Contas passou a fornecer os dados atuais do autor. A alteração do perfil deixou de exigir a regravação das publicações.

## 3. Publicações nas telas

**Antes:** Feed, Perfil e Salvos tinham códigos separados para apresentar as publicações.

Trecho do Feed, em `client/App.tsx`:

```tsx
            <p className="post-content">{post.content}</p>
            {post.image && (
              <img className="post-image" src={post.image} alt="Imagem da publicação" />
            )}
            {post.poll && (
              <PostPoll post={post} onUpdate={updatePost} onPollDeleted={removePoll} />
            )}
            <PostActions post={post} currentUserId={user.id} onUpdate={updatePost} />
```

Trecho de `client/SwiftProfile.tsx`:

```tsx
<p>{post.content}</p>{post.image && <img src={post.image} alt="Imagem da publicação"/>}<ProfilePostActions post={post} onUpdate={updatePost}/>
```

**Depois:** as três telas passaram a utilizar o componente compartilhado `PostCard`.

Em `client/pages/Feed.tsx`:

```tsx
        {posts.map((post, index) => <PostCard key={post.id} post={post} currentUserId={user.id} openProfile={openProfile} era={eras[index % eras.length]} />)}
```

Em `client/pages/SwiftProfile.tsx`:

```tsx
      {posts.map((post) => <PostCard key={post.id} post={post} currentUserId={viewer.id} openProfile={openProfile} variant="profile" era="folklore" />)}
```

Em `client/pages/SavedPosts.tsx`:

```tsx
          {posts.map((post) => <PostCard key={post.id} post={post} currentUserId={user.id} openProfile={openProfile} variant="saved" />)}
```

Cada tela seleciona suas publicações. O `PostCard` reúne a apresentação, os comentários, as enquetes e os controles compartilhados.

## 4. Preparação do banco

**Antes:** a inicialização do servidor também criava tabelas, enquanto outras alterações dependiam de scripts separados.

Trecho de `src/server.ts`:

```ts
  try {
    await sequelize.authenticate();
    console.log('MySQL conectado');
    await sequelize.sync();
```

Trecho de `package.json`:

```json
    "prepare:database": "tsc -p tsconfig.server.json && node scripts/apply-cover-local.mjs",
    "prestart": "npm run prepare:database",
```

**Depois:** o comando `db:migrate` passou a aplicar as migrações numeradas e registrar quais já foram executadas.

Trecho de `src/infrastructure/database/db-command.ts`:

```ts
    } else if (operation === 'migrate') {
      const executed = await migrateDatabase(connection);
      console.log(executed.length ? 'Migrações aplicadas: ' + executed.join(', ') : 'O banco já está atualizado.');
```

Na inicialização, `src/server.ts` confere a versão e a estrutura do banco antes de abrir o servidor:

```ts
    await sequelize.authenticate();
    console.log('MySQL conectado');
    await assertDatabaseReady();
    startImageMaintenance();
    app.listen(port, () => console.log(`Swiftline está online em http://localhost:${port}`));
```

A preparação do banco foi separada da inicialização do servidor. As alterações passaram a seguir um histórico de execução.

## 5. Gravação de ações com notificações

**Antes:** o comentário e sua notificação eram gravados separadamente. Uma falha na segunda gravação podia deixar o comentário salvo sem a respectiva notificação.

Trecho de `src/app.ts`:

```ts
  const comment = await Comment.create({ postId: post.id, userId: req.userId!, content });
  if (post.userId !== req.userId) {
    const actor = await User.findByPk(req.userId);
    await Notification.create({
      userId: post.userId,
      actorId: req.userId!,
      type: 'comment',
      message: `${actor?.username ?? 'Alguém'} respondeu à sua publicação.`,
    });
  }
```

**Depois:** o arquivo `post-interactions.ts` passou a coordenar a ação e sua notificação na mesma transação.

```ts
    comment: (input: { userId: number; postId: number; content: string }) => unitOfWork.run(async ({ accounts, posts, notifications }) => {
      const post = await posts.lockPost(input.postId);
      if (!post) throw new InteractionError('POST_NOT_FOUND');
      const actor = await accounts.findById(input.userId);
      if (!actor) throw new InteractionError('USER_NOT_FOUND');
      const comment = await posts.addComment(post.id, actor.id, input.content);
      if (post.userId !== actor.id) await notifications.record({ userId: post.userId, actorId: actor.id, type: 'comment', message: `${actor.username} respondeu à sua publicação.` });
      return { ...comment, user: actor };
    }),
```

A transação é executada em `unit-of-work.ts`:

```ts
  return {
    async run(operation) {
      return database.transaction((transaction) => operation(createScope(transaction)));
    },
  };
```

Quando há notificação, as duas gravações são confirmadas juntas. Se uma falhar, a operação é desfeita. Essa organização também foi aplicada às curtidas e às ações de seguir.

## 6. Respostas do servidor

**Antes:** cada tela interpretava as respostas diretamente, e o servidor enviava erros em formatos diferentes.

Trecho de `client/App.tsx`:

```ts
  const load = async () => {
    const response = await fetch(`/api/posts/${postId}/comments`, { headers: headers() });
    const comments = await response.json();
    setItems(comments);
    onCountChange(comments.length);
  };
```

Uma rota utilizava `error`:

```ts
    return res.status(401).json({ error: 'Entre na sua conta para ver quem você segue.' });
```

Outra utilizava `message`:

```ts
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
```

**Depois:** os erros passaram a seguir o formato definido em `src/http/api-errors.ts`.

```ts
export function sendApiError(req: Request, res: Response, status: number, message: string, code = codes[status] ?? 'INTERNAL_ERROR', fields?: Fields): void {
  res.status(status).json({ error: { code, message, ...(fields ? { fields } : {}) }, requestId: req.requestId ?? randomUUID() });
}
```

A leitura das respostas foi reunida em `client/shared/api.ts`, que verifica o tipo de conteúdo e os erros:

```ts
    const response = await fetch(endpoint, { ...options, headers, signal: controller.signal });
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) throw new ApiError('INVALID_RESPONSE', 'O servidor enviou uma resposta inesperada. Tente novamente.', response.status);
    let body: unknown;
    try { body = await response.json(); } catch { throw new ApiError('INVALID_RESPONSE', 'Não foi possível ler a resposta do servidor.', response.status); }
    if (!response.ok) {
      let failure: ApiFailure;
      try { failure = decodeFailure(body); } catch { throw new ApiError('INVALID_RESPONSE', 'O servidor enviou uma falha em formato inesperado.', response.status); }
```

O mesmo arquivo também verifica o formato dos dados:

```ts
    try { return decode(body); } catch { throw new ApiError('INVALID_RESPONSE', 'Os dados recebidos estão incompletos. Tente novamente.', response.status); }
```

As telas passaram a compartilhar a leitura das respostas, e o servidor passou a fornecer os erros no mesmo formato.

## Conclusão

As seis mudanças formam a reengenharia arquitetural do Swiftline porque reorganizam o trabalho e a comunicação entre as telas, os módulos, o servidor e o banco. Cada parte solicita uma tarefa à responsável por executá-la e recebe o resultado, sem precisar controlar seus detalhes.

Com isso, cada parte passou a ter uma responsabilidade mais clara, com menos repetição e menos detalhes concentrados nos mesmos arquivos, o que facilita a manutenção.
