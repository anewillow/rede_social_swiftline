# Demonstração da reengenharia do Swiftline

## Preparação

Execute os comandos na pasta `sistema`. Node.js, MySQL e Chrome devem estar instalados no computador que executa o projeto.

Para abrir a aplicação:

```powershell
npm run build
npm start
```

Abra o endereço informado pelo servidor. Utilize duas contas de demonstração: **Autora**, na janela normal, e **Leitor**, em uma janela anônima.

A Autora cria uma publicação e uma enquete. O Leitor segue a Autora, salva a publicação, curte, comenta e envia uma mensagem. Esses registros servem às demonstrações seguintes.

**Ordem sugerida:** dados do autor, publicações compartilhadas, notificações, respostas do servidor, banco e exclusão de conta. A exclusão fica por último.

## 1. Exclusão de contas

1. Na sessão da Autora, abra as configurações e selecione **Excluir minha conta**.
2. Informe a senha e confirme a exclusão da conta de demonstração.
3. Na sessão do Leitor, recarregue o Feed e confira a remoção das publicações da Autora.
4. Apresente `src/workflows/delete-account.ts`, com as chamadas aos cinco módulos.

O teste automatizado confere a remoção dos registros relacionados, a preservação dos dados de outras pessoas e a reversão da exclusão quando uma etapa falha.

```powershell
npm run test:account:mysql
```

## 2. Dados do autor

1. Na sessão da Autora, altere o nome ou a foto do perfil.
2. Na sessão do Leitor, recarregue o Feed e abra a publicação existente.
3. Confira o novo nome ou a nova foto no Feed, no Perfil e em Salvos.
4. Apresente `src/modules/posts/application/post-authors.ts`.

O teste automatizado compara os registros das publicações antes e depois da atualização do perfil. A apresentação recebe os dados atuais sem alterar os registros das publicações.

```powershell
npm run test:authors:mysql
```

## 3. Publicações compartilhadas

1. Na sessão do Leitor, abra a publicação no Feed, no Perfil da Autora e em Salvos.
2. Confira os comentários, os botões e a enquete nas três telas.
3. Curta a publicação ou vote na enquete e confira o resultado nas outras telas.
4. Apresente o uso de `PostCard` em `Feed.tsx`, `SwiftProfile.tsx` e `SavedPosts.tsx`.

O teste automatizado também verifica edição, exclusão, permissões dos comentários e recuperação após falhas.

```powershell
npm run test:posts:mysql
```

## 4. Preparação do banco

1. Abra um terminal na pasta `sistema`.
2. Execute a consulta de situação do banco:

```powershell
npm run db:status
```

3. Mostre a versão registrada e a situação de compatibilidade.
4. Apresente a chamada de `assertDatabaseReady()` em `src/server.ts` e as migrações em `migrations/current`.

O teste automatizado utiliza uma base descartável para verificar instalação, atualização, retomada após falha e bloqueio da inicialização quando a estrutura é incompatível.

```powershell
npm run test:database:mysql
```

## 5. Ações com notificações

1. Na sessão do Leitor, comente na publicação da Autora.
2. Na sessão da Autora, abra as notificações e confira o aviso do comentário.
3. Apresente `src/workflows/post-interactions.ts`, com a gravação da ação e da notificação na mesma operação.
4. Execute o teste de falha controlada:

```powershell
npm run test:atomic:mysql
```

Nos cenários de comentário, curtida e seguir, o teste provoca uma falha na gravação da notificação. Em seguida, confere a ausência da ação e da notificação no banco. Na nova tentativa, sem a falha, confere as duas gravações.

## 6. Respostas do servidor

1. Na sessão da Autora, abra a exclusão de conta e informe uma senha incorreta.
2. Confira a mensagem de erro e a permanência da sessão.
3. No painel de rede do navegador, confira a resposta com `error.code`, `error.message` e `requestId`.
4. Apresente `src/http/api-errors.ts` e `client/shared/api.ts`.

O teste automatizado também simula uma lista inválida e uma resposta HTML. O navegador deve apresentar um aviso e permitir nova tentativa, sem derrubar a tela.

```powershell
npm run test:contracts:mysql
```

## Repetição completa

Os comandos abaixo executam a compilação, os testes gerais e as seis verificações com MySQL descartável:

```powershell
npm test
npm run test:account:mysql
npm run test:authors:mysql
npm run test:posts:mysql
npm run test:database:mysql
npm run test:atomic:mysql
npm run test:contracts:mysql
```

Cada suíte MySQL cria sua própria instância, confere a localização do banco e encerra a instância após a execução. As simulações de falha pertencem ao ambiente de teste.
