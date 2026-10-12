
# TRABALHO PRÁTICO 5 - REFATORAÇÃO

**Equipe: Dayane Rodrigues, Lucas Marinho, Victória Caroline Alves**
**Professor: Andrey Rodrigues**

## Relatório — Swiftline

## 1. Introdução

Este trabalho tem como objetivo melhorar a estrutura interna do sistema swiftline sem afetar as funcionalidades para o usuário. A análise e as refatorações tem como referência o [Capítulo 9 — Refactoring, do livro Engenharia de Software Moderna](https://engsoftmoderna.info/cap9.html) de Marco Tulio Valente.

## 2. Resumo das refatorações realizadas

As três primeiras refatorações foram planejadas e aplicadas depois da gravação de seus estados anteriores. A quarta foi identificada de forma oportunista durante a verificação do código e aplicada depois da gravação do “antes”.

### 2.1 Refatorações em nível de código

| Refatoração | Local analisado | Problema identificado | Situação |
| --- | --- | --- | --- |
| **Extração de Método** | Rota de exclusão de conta | Método longo que reúne validação, exclusão de dados relacionados e remoção de arquivos | Implementada; demonstração manual do “depois” pendente. |
| **Movimentação de Método** | Função `postsWithActivity` | Regra de montagem dos posts localizada no módulo geral da aplicação | Implementada; demonstração manual do “depois” pendente. |
| **Extração de Classe** | Integração de notícias | Comunicação externa, formatação e cache concentrados no arquivo das rotas | Implementada; demonstração manual do “depois” pendente. |
| **Remoção de Código Morto** | Componentes `SearchBar` e `PublicProfile` | Componentes declarados, mas não utilizados pela interface atual | Implementada de forma oportunista e verificada no navegador. |

Além das quatro refatorações principais, foi aplicado um par de operações inversas nas regras de permissão. A refatoração A aplicou Inline de Método sobre `isAuthor`; a refatoração B aplicou Extração de Método e devolveu o código à estrutura inicial. Os testes comprovaram que autor, outro usuário e visitante mantiveram exatamente as mesmas permissões durante a sequência.

### 2.2 Refatoração em nível de design

A refatoração de design será descrita nesta seção depois de sua definição e execução. Serão registrados a estrutura anterior, a nova organização e o motivo arquitetural da mudança.

## 3. Justificativas principais das escolhas

### 3.1 Extração de Método

A rota de exclusão de conta executa várias etapas dentro de um único bloco. Esse caso caracteriza o code smell **Método Longo**. A refatoração é relevante porque essa funcionalidade remove dados de diferentes partes do sistema e precisa ser compreendida com facilidade para evitar falhas de manutenção.

### 3.2 Movimentação de Método

A função `postsWithActivity` consulta e organiza informações de posts, curtidas, comentários, enquetes e visualizações, mas está localizada no arquivo geral da aplicação. A movimentação aproxima essa lógica do domínio de posts, reduzindo a concentração de responsabilidades em `app.ts`.

### 3.3 Extração de Classe

O `app.ts` deveria organizar as rotas, mas também guarda o cache e executa a consulta, a filtragem e a formatação das notícias. A Extração de Classe é adequada porque transfere exatamente esse estado e essas operações para `TaylorNewsService`. Dessa forma, `app.ts` permanece responsável pelas rotas e a nova classe fica responsável pelas notícias, facilitando alterar o cache, trocar a fonte e testar a integração separadamente.

### 3.4 Remoção de Código Morto

Os componentes `SearchBar` e `PublicProfile` estão declarados, mas não são utilizados pela aplicação atual. A remoção é relevante porque evita que a equipe altere uma implementação antiga acreditando que está modificando a tela em uso. Essa oportunidade foi encontrada durante a verificação técnica das refatorações anteriores.

As escolhas estão ligadas a funcionalidades reais do Swiftline: exclusão de conta, exibição de posts, notícias e perfis. Essas funcionalidades são usadas apenas como contexto; as refatorações são mudanças técnicas e não novas histórias de usuário.

## 4. Links para os trechos relevantes do código

Os links abaixo apontam para os trechos analisados. Ao final, serão acrescentados os links permanentes dos commits no GitHub com as versões “antes” e “depois”.

| Refatoração | Código analisado |
| --- | --- |
| Extração de Método | [Métodos extraídos](../sistema/src/app.ts#L265-L359) e [rota simplificada](../sistema/src/app.ts#L361-L375) |
| Movimentação de Método | [`post-activity.ts`](../sistema/src/post-activity.ts) e [importação em `app.ts`](../sistema/src/app.ts#L39) |
| Extração de Classe | [`TaylorNewsService`](../sistema/src/taylor-news-service.ts) e [rota de notícias](../sistema/src/app.ts#L450-L464) |
| Remoção de Código Morto | [Busca ativa em `RightRail`](../sistema/client/App.tsx#L520-L745), [chamada de `SwiftProfile`](../sistema/client/App.tsx#L249) e [evidência completa do antes e depois](issues/04-remocao-de-codigo-morto.md) |

## 5. Principais aprendizados e dificuldades

### 5.1 Aprendizados iniciais

A análise mostrou que uma refatoração deve partir de um problema verificável no código. A escolha não deve ser feita apenas pelo nome da técnica: é necessário relacionar o code smell, a mudança proposta e a funcionalidade afetada.

### 5.2 Dificuldades iniciais

A principal dificuldade é separar refatoração de correção ou criação de funcionalidade. Como o comportamento externo deve permanecer igual, será necessário registrar o funcionamento anterior e repetir os mesmos testes depois de cada mudança. Os aprendizados e as dificuldades finais serão atualizados após a execução das refatorações.
