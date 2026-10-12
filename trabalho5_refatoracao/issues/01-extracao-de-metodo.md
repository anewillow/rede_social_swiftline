# Refatoração - 01 : extrair métodos da exclusão de conta

## Problema identificado

A rota de exclusão de conta concentra várias tarefas no mesmo método: valida a senha, exclui as interações, mensagens, posts e dados do usuário e remove os arquivos de avatar e capa.

Isso caracteriza o code smell **Método Longo**, pois muitas operações diferentes estão reunidas no mesmo lugar.

## Refatoração escolhida

**Extração de Método**, conforme o catálogo apresentado no Capítulo 9 do livro *Engenharia de Software Moderna* de Marco Tulio Valente.

## Antes da refatoração

Todas as etapas estavam concentradas na mesma rota:

```ts
app.delete('/api/auth/delete', requireAuth, async (req, res) => {
  const user = await User.findByPk(req.userId);
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });

  const { password } = req.body as { password?: string };
  if (!password)
    return res.status(400).json({ message: 'Digite sua senha para confirmar a exclusão.' });
  if (!(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ message: 'Senha incorreta.' });

  const { avatar, cover } = user;
  await sequelize.transaction(async (transaction) => {
    const posts = await Post.findAll({
      where: { userId: user.id },
      attributes: ['id'],
      transaction,
    });
    const postIds = posts.map((post) => post.id);
    const comments = await Comment.findAll({
      where: {
        [Op.or]: [
          { userId: user.id },
          ...(postIds.length ? [{ postId: { [Op.in]: postIds } }] : []),
        ],
      },
      attributes: ['id'],
      transaction,
    });
    const commentIds = comments.map((comment) => comment.id);

    await CommentLike.destroy({
      where: {
        [Op.or]: [
          { userId: user.id },
          ...(commentIds.length ? [{ commentId: { [Op.in]: commentIds } }] : []),
        ],
      },
      transaction,
    });

    for (const model of [Like, Repost, SavedPost, PostView]) {
      await model.destroy({
        where: {
          [Op.or]: [
            { userId: user.id },
            ...(postIds.length ? [{ postId: { [Op.in]: postIds } }] : []),
          ],
        },
        transaction,
      });
    }

    await Notification.destroy({
      where: { [Op.or]: [{ userId: user.id }, { actorId: user.id }] },
      transaction,
    });
    await Message.destroy({
      where: { [Op.or]: [{ senderId: user.id }, { receiverId: user.id }] },
      transaction,
    });
    await Follow.destroy({
      where: { [Op.or]: [{ followerId: user.id }, { followingId: user.id }] },
      transaction,
    });
    await Comment.destroy({
      where: {
        [Op.or]: [
          { userId: user.id },
          ...(postIds.length ? [{ postId: { [Op.in]: postIds } }] : []),
        ],
      },
      transaction,
    });
    await Post.destroy({ where: { userId: user.id }, transaction });
    await user.destroy({ transaction });
  });

  await Promise.allSettled([
    removeStoredProfileImage(avatar, uploadsPath, user.id, 'avatar'),
    removeStoredProfileImage(cover, uploadsPath, user.id, 'cover'),
  ]);
  return res.json({ message: 'Conta excluída com sucesso.' });
});
```

> [!WARNING]
> **Como era antes**
>
> A rota realizava todas as tarefas no mesmo método: validava a senha, buscava os dados, fazia as exclusões e removia as imagens. Por isso, o código era longo e mais difícil de entender.

## Depois da refatoração

As etapas foram separadas em métodos menores. A rota passou a apenas validar os dados e chamar as operações necessárias:

```ts
async function findAccountContentIds(userId: number, transaction: Transaction) {
  const posts = await Post.findAll({
    where: { userId },
    attributes: ['id'],
    transaction,
  });
  const postIds = posts.map((post) => post.id);
  const comments = await Comment.findAll({
    where: {
      [Op.or]: [{ userId }, ...(postIds.length ? [{ postId: { [Op.in]: postIds } }] : [])],
    },
    attributes: ['id'],
    transaction,
  });
  return { postIds, commentIds: comments.map((comment) => comment.id) };
}

async function deleteAccountInteractions(
  userId: number,
  postIds: number[],
  commentIds: number[],
  transaction: Transaction,
) {
  await CommentLike.destroy({
    where: {
      [Op.or]: [
        { userId },
        ...(commentIds.length ? [{ commentId: { [Op.in]: commentIds } }] : []),
      ],
    },
    transaction,
  });

  for (const model of [Like, Repost, SavedPost, PostView]) {
    await model.destroy({
      where: {
        [Op.or]: [{ userId }, ...(postIds.length ? [{ postId: { [Op.in]: postIds } }] : [])],
      },
      transaction,
    });
  }
}

async function deleteAccountRelationships(userId: number, transaction: Transaction) {
  await Notification.destroy({
    where: { [Op.or]: [{ userId }, { actorId: userId }] },
    transaction,
  });
  await Message.destroy({
    where: { [Op.or]: [{ senderId: userId }, { receiverId: userId }] },
    transaction,
  });
  await Follow.destroy({
    where: { [Op.or]: [{ followerId: userId }, { followingId: userId }] },
    transaction,
  });
}

async function deleteAccountContent(
  user: User,
  postIds: number[],
  transaction: Transaction,
) {
  await Comment.destroy({
    where: {
      [Op.or]: [
        { userId: user.id },
        ...(postIds.length ? [{ postId: { [Op.in]: postIds } }] : []),
      ],
    },
    transaction,
  });
  await Post.destroy({ where: { userId: user.id }, transaction });
  await user.destroy({ transaction });
}

async function deleteAccountRecords(user: User) {
  await sequelize.transaction(async (transaction) => {
    const { postIds, commentIds } = await findAccountContentIds(user.id, transaction);
    await deleteAccountInteractions(user.id, postIds, commentIds, transaction);
    await deleteAccountRelationships(user.id, transaction);
    await deleteAccountContent(user, postIds, transaction);
  });
}

async function deleteAccountProfileImages(
  userId: number,
  avatar: string | null,
  cover: string | null,
) {
  await Promise.allSettled([
    removeStoredProfileImage(avatar, uploadsPath, userId, 'avatar'),
    removeStoredProfileImage(cover, uploadsPath, userId, 'cover'),
  ]);
}

app.delete('/api/auth/delete', requireAuth, async (req, res) => {
  const user = await User.findByPk(req.userId);
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });

  const { password } = req.body as { password?: string };
  if (!password)
    return res.status(400).json({ message: 'Digite sua senha para confirmar a exclusão.' });
  if (!(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ message: 'Senha incorreta.' });

  const { id, avatar, cover } = user;
  await deleteAccountRecords(user);
  await deleteAccountProfileImages(id, avatar, cover);
  return res.json({ message: 'Conta excluída com sucesso.' });
});
```

> [!TIP]
> **Como ficou depois**
>
> Cada método passou a ter uma responsabilidade:
>
> - `findAccountContentIds`: busca os posts e comentários;
> - `deleteAccountInteractions`: exclui as interações;
> - `deleteAccountRelationships`: exclui notificações, mensagens e seguidores;
> - `deleteAccountContent`: exclui comentários, posts e o usuário;
> - `deleteAccountProfileImages`: remove o avatar e a capa;
> - `deleteAccountRecords`: organiza a execução das exclusões.
>
> A rota principal agora apenas valida os dados e chama os métodos necessários.

> [!IMPORTANT]
> **O comportamento não mudou:** a mesma rota, as mesmas validações, a mesma ordem de exclusão e a mesma resposta foram mantidas.

- [Métodos extraídos em `app.ts`](../../sistema/src/app.ts#L265-L359)
- [Rota simplificada em `app.ts`](../../sistema/src/app.ts#L361-L375)

## Justificativa

A **Extração de Método** separou as exclusões em métodos menores e mais fáceis de entender. Para o usuário, a conta continua sendo excluída sem nenhuma mudança na parte visual.

## Resultado obtido

- separar as etapas da exclusão de conta;
- deixar o código mais claro;
- manter o mesmo comportamento do sistema.

A aplicação compilou e os nove testes existentes passaram. Ainda falta gravar a demonstração manual do “depois”.

## Critérios de aceitação

- [x] A conta continua sendo excluída pela mesma ação da interface.
- [x] A senha continua sendo validada antes da exclusão.
- [x] Os dados relacionados continuam sendo removidos.
- [x] Os arquivos de avatar e capa continuam sendo apagados quando existirem.
- [x] O comportamento externo permanece igual após a refatoração.

## Evidência em vídeo

- [Vídeo único — antes e depois da refatoração](../evidencias/issue-01-antes-e-depois-extracao-de-metodo.mp4)

