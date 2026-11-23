# Swiftline

O código da interface está em `client`. O código do servidor está em `src`.

O [relatório da reengenharia arquitetural](docs/relatorio-reengenharia-arquitetural.md) reúne a organização inicial, os seis problemas tratados, os diagramas antes e depois e os resultados dos testes.

O fluxo [Testes da reengenharia no GitHub](docs/testes-no-github.md) executa os seis casos pelo GitHub Actions e registra o resultado de cada execução.

| Pasta | Conteúdo |
| --- | --- |
| `client/pages` | Telas de login e cadastro, feed, perfil, mensagens e outras páginas. |
| `client/components` | Componentes comuns, estrutura das telas e avatar do perfil. |
| `client/features/posts` | Publicação compartilhada por Feed, Perfil e Salvos: componentes, carregamento e estado. |
| `client/services` | Chamadas da interface à API. |
| `client/styles` | Estilos da interface. |
| `client/assets` | Imagens da interface. |
| `client/config` | Constantes da interface. |
| `client/types` | Tipos compartilhados de usuários, publicações e comentários. |
| `client/utils` | Funções auxiliares de navegação e apresentação. |
| `src/routes` | Endereços da API e verificações exigidas em cada endereço. |
| `src/controllers` | Adaptação entre os pedidos HTTP e os serviços. |
| `src/services` | Regras e operações de cada funcionalidade. |
| `src/models` | Modelos das tabelas e seus relacionamentos. |
| `src/middleware` | Autenticação, recebimento de arquivos e tratamento do limite de dados. |
| `src/config` | Conexão com o banco, caminhos e configuração do limite de requisições. |
| `src/types` | Tipos usados pelo servidor. |
| `src/modules` | Operações de cada funcionalidade; a exclusão de conta já usa a divisão por módulos. |
| `src/workflows` | Coordenador da exclusão de conta e contrato da operação com transação. |
| `src/infrastructure` | Migrações e conferência do banco, transações e limpeza de imagens de perfil no novo fluxo. |
| `src/bootstrap` | Montagem das dependências da exclusão de conta. |
| `migrations/current` | Sequência ativa para instalar e atualizar o banco. |
| `migrations/history` | Arquivos anteriores preservados para consulta histórica. |
| `scripts` | Execução dos testes com MySQL descartável. |
| `public/uploads` | Imagens enviadas pelos usuários. |
| `public/uploads/managed` | Imagens novas com chaves do servidor e limpeza recuperável. |
| `var/upload-staging` | Recebimento privado e temporário das imagens de publicações. |
| `tests/unit` | Testes de funções e das chamadas da interface à API. |
| `tests/integration` | Testes das rotas, controladores, serviços e limite de requisições. |
| `tests/security` | Verificação da versão do Multer. |
| `docs` | Registro da organização antes e depois da mudança. |

## Executar

Execute dentro da pasta `sistema`, com as dependências instaladas e o MySQL configurado. O banco indicado por `DB_NAME` deve existir. Com o servidor parado, confira a base:

```powershell
npm run build
npm run db:status
```

Em um banco vazio, execute `npm run db:migrate`. Em uma base existente sem o novo histórico, execute:

```powershell
npm run db:adopt
npm run db:migrate
```

A adoção confere a estrutura e as referências antes de registrar a versão inicial; não recria as tabelas existentes. A migração instala ou aplica as próximas etapas em ordem. A retirada de `posts.author` e `posts.avatar` pertence a essa sequência e mantém o backup de autoria. A base local já foi adotada e está atualizada.

Depois, inicie:

```powershell
npm start
```

O servidor conecta e confere a versão e a estrutura; não cria nem corrige tabelas. Se faltar uma etapa ou houver incompatibilidade, ele não abre o atendimento e informa o motivo. Para desenvolvimento, use `npm run dev`; a mesma conferência se aplica. As migrações devem executar com o servidor parado e uma cópia prévia em atualizações com dados.

## Verificar

```powershell
npm test
```

`npm test` compila a interface e o servidor e executa os testes unitários, de integração e de segurança. Nos testes comuns das rotas, os acessos ao banco são substituídos por respostas controladas; eles não precisam do MySQL nem alteram dados reais. As seis suítes com MySQL descartável são ignoradas nesse comando e executam separadamente:

```powershell
npm run test:account:mysql
```

Para conferir a fonte única de nome e foto, a busca pelo autor, a interface e a migração com restauração:

```powershell
npm run test:authors:mysql
```

Para conferir ações, comentários, enquetes, edição e exclusão nas três telas:

```powershell
npm run test:posts:mysql
```

Para conferir instalação, adoção, retomada após falha e bloqueio da inicialização com banco incompatível:

```powershell
npm run test:database:mysql
```

Para conferir ação com notificação, concorrência, falhas de gravação e retomada da limpeza das imagens:

```powershell
npm run test:atomic:mysql
```

O caso 5 acrescentou a migração `0005-file-cleanup.js`. Em outra instalação já registrada, aplique `npm run db:migrate` com o servidor parado antes de abrir esta versão. A base local já está atualizada. A fila `file_cleanup_jobs` registra as remoções junto da transação dos dados; o servidor tenta a limpeza após a confirmação e a cada minuto. Arquivos novos sem referência entram na reconciliação após 24 horas. Imagens antigas de publicações ficam fora da varredura até um inventário específico.

Esses comandos exigem `mysqld` disponível no PATH ou o caminho definido em `MYSQLD_BINARY`. Cada comando inicia um servidor MySQL exclusivo em um diretório temporário e porta local livre, verifica a localização do banco e usa dados próprios. Depois do sucesso, encerra o servidor e remove o diretório temporário. O banco usado pela aplicação não participa desses testes. As suítes de interface usam o Chrome instalado no Windows ou o caminho definido em `SWIFTLINE_CHROME_BINARY`; nas outras instalações, usam o Chromium disponível no Playwright.

`client-dist`, `dist`, `node_modules` e `test-results` guardam resultados de compilação, dependências ou resultados de testes.

O registro da mudança está em [Organização antes e depois](docs/organizacao-antes-depois.md).

O [Projeto de reengenharia arquitetural](docs/projeto-reengenharia-arquitetural.md) descreve a arquitetura de referência, a arquitetura proposta, as responsabilidades dos módulos e a ordem de aplicação. Os casos aplicados estão documentados em [Exclusão de conta](docs/caso1-exclusao-conta-aplicada.md), [Dados do autor](docs/caso2-autores-perfil-aplicado.md), [Publicação compartilhada](docs/caso3-publicacoes-compartilhadas-aplicado.md), [Banco versionado](docs/caso4-banco-versionado-aplicado.md) e [Operações e imagens](docs/caso5-operacoes-e-imagens-aplicado.md). O [caso 6: comunicação](docs/caso6-comunicacao-aplicada.md) também está aplicado. Os seis casos concretos estão documentados; o mapa completo de módulos continua como plano geral.

## Contratos de comunicação (caso 6)

A interface usa a API v2, com validação de respostas, erros JSON, sessão, paginação e estados desejados para interações. Os caminhos anteriores de /api continuam disponíveis. A migração 0006-api-contracts.js amplia o texto e acrescenta localização e site ao perfil. Em outra instalação, execute npm run db:migrate com o servidor parado antes de iniciar a versão nova.

Para verificar os contratos, a recuperação das telas e os fluxos de sessão em MySQL descartável:

```powershell
npm run test:contracts:mysql
```
