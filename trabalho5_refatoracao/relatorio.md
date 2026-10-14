# Trabalho Prático 5 — Refatoração

**Equipe:** Dayane Rodrigues, Lucas Marinho e Victória Caroline Alves

**Professor:** Andrey Rodrigues

As refatorações seguem o [Capítulo 9 do livro Engenharia de Software Moderna](https://engsoftmoderna.info/cap9.html) e tiveram como objetivo melhorar a estrutura interna do Swiftline sem mudar seu comportamento.

## 1. Resumo e justificativas

As refatorações reorganizaram funções e classes sem mudar o funcionamento do sistema. Em relação ao design, `app.ts` deixou de concentrar a montagem dos posts e o tratamento das notícias. Essas tarefas passaram para `post-activity.ts` e `TaylorNewsService`. As três primeiras refatorações e o par A/B foram planejados; a remoção de código morto foi oportunista.

| Refatoração | Problema e mudança realizada |
| --- | --- |
| Extração de Método | **Método Longo:** a rota de exclusão concentrava a validação e as etapas de remoção, que foram separadas em funções menores. |
| Movimentação de Método | **Baixa coesão:** `postsWithActivity` estava no módulo geral das rotas e foi movida para `post-activity.ts`. |
| Extração de Classe | **Responsabilidades excessivas:** `app.ts` cuidava das rotas e das notícias; consulta, tratamento e cache passaram para `TaylorNewsService`. |
| Remoção de Código Morto | **Código Morto:** `SearchBar` e `PublicProfile` não eram usados e foram removidos. A interface já utilizava `RightRail` e `SwiftProfile`. |
| Inline + Extração de Método (A/B) | A colocou a comparação dentro das três funções de permissão; B restaurou `isAuthor`. O arquivo voltou ao estado inicial e os três testes continuaram passando. |

## 2. Links

| Refatoração | Issue |
| --- | --- |
| Extração de Método | [Issue 01 — #21](https://github.com/anewillow/rede_social_swiftline/issues/21) |
| Movimentação de Método | [Issue 02 — #23](https://github.com/anewillow/rede_social_swiftline/issues/23) |
| Extração de Classe | [Issue 03 — #24](https://github.com/anewillow/rede_social_swiftline/issues/24) |
| Remoção de Código Morto | [Issue 04 — #25](https://github.com/anewillow/rede_social_swiftline/issues/25) |
| Par A/B | [Issue 05 — #26](https://github.com/anewillow/rede_social_swiftline/issues/26) |

## 3. Aprendizados e dificuldades

**Aprendizado.** A refatoração deve partir de um problema visível e preservar o comportamento. No par A/B, os testes confirmaram o mesmo resultado para autor, outro usuário e visitante.

**Dificuldade.** Foi necessário retirar responsabilidades de `app.ts` sem alterar as rotas e confirmar quais componentes realmente não eram usados. No par A/B, as duas etapas precisaram ser registradas separadamente porque o código final voltou ao estado inicial.

## 4. Referência

VALENTE, Marco Tulio. *Engenharia de software moderna: princípios e práticas para desenvolvimento de software com produtividade*. [S. l.]: Independente, 2020.
