# Relatório Final - Manutenção Corretiva

> Documento em elaboração. A seção do Bug 1 está concluída. Os links de commits, Pull Requests e evidências dos Bugs 2 e 3 devem ser adicionados pelos respectivos responsáveis quando as correções forem finalizadas.

## 1. Descrição breve do sistema

O Swiftline é uma aplicação web de rede social voltada para fãs de Taylor Swift. O sistema permite cadastrar e autenticar usuários, editar perfis, publicar textos e imagens, interagir com publicações, buscar usuários, gerenciar seguidores, trocar mensagens e receber notificações.

A aplicação utiliza React, TypeScript e Vite no frontend, Node.js e Express no backend e MySQL com Sequelize para persistência dos dados.

## 2. Bugs identificados

| Bug | Classificação | Severidade | Issue | Situação |
| --- | --- | --- | --- | --- |
| Bug 1 - Vulnerabilidade de negação de serviço no Multer | Dependência vulnerável / segurança | Alta | [Issue #1](https://github.com/anewillow/rede_social_swiftline/issues/1) | Correção concluída; PR aguardando revisão |
| Bug 2 - Foto de perfil selecionada não permanece salva | Lógica | Média | [Issue #2](https://github.com/anewillow/rede_social_swiftline/issues/2) | Em andamento com o responsável |
| Bug 3 - Imagem de capa selecionada não permanece salva | Lógica | Média | [Issue #3](https://github.com/anewillow/rede_social_swiftline/issues/3) | Em andamento com a responsável |

## 3. Correção e validação do Bug 1

### 3.1 Identificação e triagem

O Dependabot identificou que o projeto utilizava o Multer na versão `2.0.2`, afetada pela vulnerabilidade CVE-2026-3520. A falha permite negação de serviço por recursão descontrolada durante o processamento de solicitações malformadas.

O alerta foi confirmado como verdadeiro porque a dependência vulnerável estava instalada e era utilizada no processamento de uploads. A Issue #1 foi classificada com as labels `bug`, `security` e `severity: high`, recebeu responsável e teve a triagem registrada em comentário. Quando a correção foi iniciada em uma branch própria, a issue recebeu a label `status: in-progress`.

- Issue: [#1 - Vulnerabilidade de negação de serviço no Multer](https://github.com/anewillow/rede_social_swiftline/issues/1)
- Evidência do alerta: [print do Dependabot](./images/dependabot-multer-alerta.png)
- Branch: `fix/issue-1-atualizar-multer`

### 3.2 Correção realizada

A dependência `multer` foi atualizada da versão `2.0.2` para `2.2.0`, incluindo a atualização do `package-lock.json`. Também foi criado o teste automatizado `tests/multer-version.test.mjs`, que impede o retorno a uma versão inferior a `2.2.0`.

- Commit: [`2ec7891` - fix: atualiza Multer para corrigir vulnerabilidade de DoS (fixes #1)](https://github.com/anewillow/rede_social_swiftline/commit/2ec789116fb5bbf95c92104cb32302b493f69476)
- Pull Request: [#4 - fix: atualiza Multer para corrigir vulnerabilidade de DoS](https://github.com/anewillow/rede_social_swiftline/pull/4)
- Teste automatizado: [`tests/multer-version.test.mjs`](https://github.com/anewillow/rede_social_swiftline/blob/fix/issue-1-atualizar-multer/tests/multer-version.test.mjs)

### 3.3 Evidências de validação

Antes da correção, o comando `npm.cmd run test:security` encontrou o Multer `2.0.2` e apresentou o seguinte resultado:

- `pass 0`
- `fail 1`
- Mensagem: `Versão vulnerável do Multer encontrada: 2.0.2. Esperado: 2.2.0 ou superior.`

Depois da atualização para o Multer `2.2.0`, o mesmo teste apresentou:

- `pass 1`
- `fail 0`

A verificação `npx.cmd tsc --noEmit` também foi executada e terminou sem erros. Os prints de antes e depois foram anexados na Issue #1 e na descrição do PR #4, conforme solicitado.

### 3.4 Situação atual

O código do Bug 1 foi corrigido, testado, registrado em commit e enviado ao PR #4. O PR ainda aguarda a revisão e a aprovação de outro integrante do grupo. Depois da aprovação, ele deverá ser mergeado na `main`. A expressão `Fixes #1`, presente no commit e no PR, fará o GitHub fechar automaticamente a Issue #1 após o merge.

## 4. Pendências para conclusão do relatório do grupo

- Adicionar os links dos commits e Pull Requests dos Bugs 2 e 3.
- Adicionar as evidências de validação dos Bugs 2 e 3.
- Atualizar a situação do Bug 1 para concluído depois da aprovação e do merge do PR #4.
- Registrar eventual retrabalho somente se alguma issue for reaberta ou algum PR precisar de nova rodada de correção.
