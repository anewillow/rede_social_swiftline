# Testes da reengenharia no GitHub

O fluxo **Testes da reengenharia** executa o código do Swiftline em máquinas do GitHub. Os seis casos possuem execuções independentes, com Node.js, navegador e MySQL descartável.

## Primeiro envio

O envio do código para `main` ou `reengenharia-arquitetural` inicia o fluxo automaticamente. Os sete grupos aparecem na aba **Actions**: a verificação geral e os seis casos da reengenharia.

## Repetir uma execução

1. Abra **Actions → Testes da reengenharia**.
2. Selecione a execução desejada.
3. Clique em **Re-run all jobs**.

## Iniciar pelo botão Run workflow

O botão **Run workflow** fica disponível após o arquivo `.github/workflows/testes-reengenharia.yml` estar publicado na branch padrão:

1. Abra o repositório no GitHub.
2. Selecione **Actions**.
3. Abra **Testes da reengenharia**.
4. Clique em **Run workflow** e confirme a execução.

## Apresentar

1. Abra **Actions → Testes da reengenharia**.
2. Selecione a execução pela data.
3. Abra o caso desejado.
4. Expanda **Executar o caso com MySQL descartável**.

O registro apresenta os testes executados, os resultados e as falhas, caso ocorram. O resumo contém a quantidade de testes aprovados e de cenários não executados. Os relatórios produzidos pelo processo ficam nos artefatos da execução.

| Caso | Verificação |
| --- | --- |
| 1. Exclusão de contas | Remoção dos dados relacionados, preservação de outras contas e reversão após falha. |
| 2. Dados do autor | Consulta dos dados atuais sem regravar as publicações, inclusive no navegador. |
| 3. Publicações nas três telas | Ações, comentários, enquetes, edição e exclusão no navegador. |
| 4. Preparação do banco | Instalação, migrações, adoção e bloqueio de estruturas incompatíveis. |
| 5. Ações com notificações | Falhas controladas e confirmação ou reversão das gravações. |
| 6. Respostas do servidor | Contratos, sessão, respostas inválidas e recuperação das telas no navegador. |

Os três cenários opcionais que dependem de uma cópia da base local não são executados nesse fluxo. A execução não usa a base do computador de quem apresenta.

O GitHub registra a execução dos testes. A utilização interativa do Swiftline continua disponível na aplicação.
