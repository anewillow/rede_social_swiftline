# Demonstração complementar - 05: par de refatorações A e B

## Como funciona a sequência

Esta demonstração possui **três estados do código**, mas somente **duas refatorações**:

| Momento | O que aparece no código | É uma refatoração? |
| --- | --- | --- |
| Estado inicial | `isAuthor` existe e é chamada pelas três permissões | Não. É apenas a referência do antes. |
| Depois de A | `isAuthor` é removida e a comparação fica dentro das três permissões | Sim: **Inline de Método**. |
| Depois de B | `isAuthor` é extraída novamente e o código volta ao estado inicial | Sim: **Extração de Método**. |

Portanto, o par solicitado pelo trabalho é formado por **A e B**. O estado inicial existe apenas para mostrar de onde a sequência começou.

## Estado inicial e relevância

O arquivo `permissions.ts` controla quem pode excluir posts e quem pode editar ou excluir comentários. As três verificações usam a função `isAuthor` para comparar o usuário atual com o autor do conteúdo:

```ts
type UserId = number | undefined;

function isAuthor(currentUserId: UserId, authorId: number): boolean {
  return currentUserId === authorId;
}

export function canDeletePost(currentUserId: UserId, authorId: number): boolean {
  return isAuthor(currentUserId, authorId);
}

export function canEditComment(currentUserId: UserId, authorId: number): boolean {
  return isAuthor(currentUserId, authorId);
}

export function canDeleteComment(currentUserId: UserId, authorId: number): boolean {
  return isAuthor(currentUserId, authorId);
}
```

Esse trecho é relevante porque impede que outro usuário altere ou exclua um conteúdo que não pertence a ele. A função `isAuthor` possui uma única linha e somente três chamadas, atendendo ao caso descrito no Capítulo 9 para **Inline de Método**.

- [Código inicial em `permissions.ts`](../../sistema/src/permissions.ts)
- [Uso das permissões nas rotas](../../sistema/src/app.ts#L722-L755)
- [Testes de autor, outro usuário e visitante](../../sistema/tests/permissions.test.ts)

## Refatoração A - Inline de Método

Primeiro, a comparação feita por `isAuthor` será colocada diretamente nas três funções. A função `isAuthor` será removida:

```ts
type UserId = number | undefined;

export function canDeletePost(currentUserId: UserId, authorId: number): boolean {
  return currentUserId === authorId;
}

export function canEditComment(currentUserId: UserId, authorId: number): boolean {
  return currentUserId === authorId;
}

export function canDeleteComment(currentUserId: UserId, authorId: number): boolean {
  return currentUserId === authorId;
}
```

As funções continuam devolvendo os mesmos valores. Apenas deixam de chamar um método separado.

- [Estado do código depois de A](../../sistema/src/permissions.ts#L1-L13)

## Refatoração B - Extração de Método

Em seguida, a comparação repetida será extraída novamente para `isAuthor`, revertendo a transformação realizada por A:

```ts
function isAuthor(currentUserId: UserId, authorId: number): boolean {
  return currentUserId === authorId;
}

export function canDeletePost(currentUserId: UserId, authorId: number): boolean {
  return isAuthor(currentUserId, authorId);
}

export function canEditComment(currentUserId: UserId, authorId: number): boolean {
  return isAuthor(currentUserId, authorId);
}

export function canDeleteComment(currentUserId: UserId, authorId: number): boolean {
  return isAuthor(currentUserId, authorId);
}
```

Ao final de B, o código retorna à estrutura inicial. Nenhuma regra de permissão é acrescentada, removida ou alterada. As duas etapas serão registradas em commits separados para que A continue visível no histórico depois que B restaurar o código.

A comparação final confirmou que `permissions.ts` ficou idêntico ao estado inicial do repositório.

### Registro das duas etapas no código

- Refatoração A — Inline de Método: commit local `f52a0a7` (`aplica Inline de Metodo na verificacao de autoria (A)`).
- Refatoração B — Extração de Método: commit local `aad747f` (`extrai novamente a verificacao de autoria (B)`).

Os commits alteram somente `sistema/src/permissions.ts`. Quando o repositório for enviado ao GitHub, eles permitirão abrir separadamente o código de A e o código de B, mesmo que o arquivo final tenha retornado à estrutura inicial.

> [!IMPORTANT]
> **Estado inicial:** as três permissões chamam `isAuthor`.  
> **Depois de A:** as três permissões fazem a comparação diretamente.  
> **Depois de B:** a comparação volta para `isAuthor` e o código retorna ao estado inicial.

## Como comprovar que o comportamento não mudou

O projeto já possui três testes para essa regra:

1. o autor pode excluir o próprio post e editar ou excluir o próprio comentário;
2. outro usuário não recebe essas permissões;
3. um visitante também não recebe essas permissões.

Os mesmos três testes serão executados no estado inicial, depois de A e depois de B. Todos devem continuar passando nas três etapas.

Essa demonstração não conta como uma quinta refatoração principal. Ela atende ao requisito adicional de mostrar duas operações inversas aplicadas em sequência.

## Critérios de aceitação

- [x] Os três testes de permissão passam no estado inicial.
- [x] A refatoração A remove `isAuthor` e coloca a comparação nas três funções.
- [x] A refatoração A é registrada em um commit próprio (`f52a0a7`).
- [x] Os três testes de permissão continuam passando depois de A.
- [x] A refatoração B extrai novamente a função `isAuthor`.
- [x] A refatoração B é registrada em outro commit (`aad747f`).
- [x] O código final possui a mesma estrutura do estado inicial.
- [x] Os três testes de permissão continuam passando depois de B.
- [x] A sequência A e B não altera as permissões do sistema.

## Evidência em vídeo

- [Vídeo da sequência A e B](../evidencias/issue-05-par-a-b-inline-e-extracao-de-metodo.mp4)
