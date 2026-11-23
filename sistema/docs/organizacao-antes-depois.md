# Organização inicial dos arquivos do Swiftline: antes e depois

Data: 20 de novembro de 2026.

Este registro descreve a modularização inicial já aplicada. As tabelas abaixo preservam essa etapa histórica. A transformação das responsabilidades e das ligações está detalhada no [Projeto de reengenharia arquitetural](projeto-reengenharia-arquitetural.md). Os casos aplicados estão registrados em [Exclusão de conta](caso1-exclusao-conta-aplicada.md), [Dados do autor](caso2-autores-perfil-aplicado.md), [Publicação compartilhada](caso3-publicacoes-compartilhadas-aplicado.md), [Banco versionado](caso4-banco-versionado-aplicado.md) e [Operações e imagens](caso5-operacoes-e-imagens-aplicado.md); e em [Caso 6: comunicação](caso6-comunicacao-aplicada.md). Os seis casos estão aplicados.

## Parte 1 - Antes da organização inicial

### Organização encontrada

O código da aplicação ficava dentro de `sistema`. As pastas principais eram `client`, `src`, `migrations`, `scripts`, `public` e `tests`. As pastas `client-dist`, `dist`, `node_modules` e `test-results` continham arquivos compilados, dependências e resultados de testes.

| Local | Como estava | Dificuldade observada |
| --- | --- | --- |
| `client/App.tsx` | Arquivo com 2.865 linhas. Reunia a escolha da tela, login e cadastro, feed, comentários, enquetes, mensagens, notificações, configurações, ajuda e edição de perfil. | Para localizar uma tela ou alterar uma chamada à API, era necessário procurar no mesmo arquivo extenso. |
| `client/SwiftProfile.tsx` | Reunia a tela do perfil público, avatar, comentários, ações de publicações e chamadas à API. | As responsabilidades da tela e de seus componentes estavam juntas. |
| Chamadas ao servidor | Distribuídas pelos dois arquivos de interface. A montagem dos cabeçalhos de autenticação aparecia nos dois. | Alterações nas chamadas exigiam procurar o código dentro das telas. |
| Tipos da interface | Declarados nos arquivos das telas. Havia definições de usuário, publicação e comentário nos dois arquivos. | As telas mantinham definições separadas para os mesmos dados. |
| `client/styles.css` | Estilos das várias telas em um arquivo na raiz da interface. | Os estilos não tinham uma pasta própria. |
| `src/app.ts` | Arquivo com 927 linhas e 39 rotas da API. Reunia configuração HTTP, recebimento de arquivos, validações, consultas ao banco, respostas e integrações externas. | As regras de funcionalidades diferentes estavam no mesmo arquivo da configuração do servidor. |
| `src/routes` e `src/controllers` | Pastas vazias. | A separação sugerida pelos nomes das pastas não existia no código executado. |
| `src/models` | Continha os modelos, os relacionamentos e o arquivo de conexão com o banco. | A configuração da conexão estava junto das definições dos dados. |
| Arquivos auxiliares do servidor | Imagens de perfil, permissões, atividades das publicações, notícias e limite de requisições ficavam diretamente em `src`. | As funções auxiliares não estavam agrupadas por responsabilidade. |
| `src/views` | Pasta vazia. | Não tinha função na interface React usada pelo sistema. |
| `tests` | Cinco arquivos de testes no mesmo nível. | Não havia divisão entre testes de funções, integração HTTP e segurança. |
| `migrations`, `scripts` e `public` | Alterações do banco, preparação do sistema e arquivos públicos já tinham pastas próprias. | Essas pastas já tinham funções identificáveis; os caminhos precisavam continuar corretos após a reorganização. |

### Funcionamento verificado antes da mudança

A compilação da interface e do servidor passou. Os nove testes existentes passaram: permissões de autoria, gravação e validação de imagens do perfil, limite de requisições e versão do Multer.

O build já apresentava avisos sobre o carregamento do arquivo de configuração do Vite e sobre a posição da importação de fontes no CSS.

Foi preservada uma cópia dos arquivos de código, testes, migrações, scripts, configurações de compilação e imagens da interface em `tmp/reengenharia-antes-20261120/sistema`, junto do registro das alterações locais e dos hashes dos arquivos. Essa cópia registra o código como estava no computador, inclusive alterações ainda não enviadas ao repositório. Ela não é uma cópia do banco de dados nem dos uploads dos usuários.

## Parte 2 - Depois da organização inicial

### Interface

| Pasta | Organização aplicada |
| --- | --- |
| `client/pages` | Dez arquivos de telas: `Auth`, `Feed`, `Network`, `Messages`, `Notifications`, `SavedPosts`, `Profile`, `SwiftProfile`, `AccountSettings` e `Help`. Login e cadastro compartilham a tela `Auth`, como já ocorria no sistema. |
| `client/components/common` | Avatar e mensagem de conteúdo vazio usados nas telas. |
| `client/components/layout` | Estrutura da página, coluna de busca e notícias, e sugestões de pessoas. |
| `client/components/posts` | Edição e exclusão de publicação, enquetes, ações e comentários. |
| `client/components/profile` | Avatar e interações das publicações no perfil público. |
| `client/services` | Chamadas separadas por autenticação, publicações, comentários, usuários, mensagens, notificações e busca/notícias. Um arquivo comum monta os cabeçalhos e executa os pedidos HTTP. |
| `client/styles` | Arquivo de estilos e caminho atualizado para a imagem de fundo do cadastro. |
| `client/config` | Constantes de tamanho e tipo de imagem e da preferência de contraste. |
| `client/types` | Definições compartilhadas de usuário, publicação, comentário, notícias, resultados de busca e páginas. |
| `client/utils` | Escolha da página a partir do endereço e apresentação de tamanho de arquivo. |
| `client/assets` | Imagens usadas na interface. |

`client/App.tsx` passou de 2.865 para 119 linhas. Seu papel é manter a sessão, a navegação e a escolha da tela. As 45 chamadas HTTP presentes nos arquivos antigos passaram a usar os serviços da interface.

### Servidor

| Pasta | Organização aplicada |
| --- | --- |
| `src/routes` | As 39 rotas foram distribuídas por autenticação, perfil, conta, publicações, enquetes, comentários, usuários, seguidores, notificações, mensagens e busca/notícias. Cada rota indica suas verificações de autenticação e recebimento de imagem. |
| `src/controllers` | Os controladores recebem os pedidos e acionam os serviços. Um adaptador comum envia o status e os dados da resposta, ou encaminha erros ao Express. |
| `src/services` | As validações, consultas e operações de cada funcionalidade ficaram em arquivos próprios. Também ficaram aqui as operações de imagens de perfil, permissões, atividades das publicações e integrações de notícias e tendências. |
| `src/models` | Modelos das tabelas e seus relacionamentos. |
| `src/middleware` | Autenticação, recebimento de imagens e tratamento de pedidos com excesso de dados. |
| `src/config` | Conexão com o banco, caminhos de arquivos públicos e da interface compilada, e limite de requisições. |
| `src/types` | Dados de entrada e saída dos serviços, contagens de publicações e extensão dos tipos do Express. |

`src/app.ts` passou de 927 para 20 linhas. Seu papel é configurar o Express, conectar os grupos de rotas e disponibilizar os arquivos públicos. `src/server.ts` continua responsável pela inicialização do servidor.

A pasta vazia `src/views` foi retirada, pois as telas da aplicação ficam em `client/pages`.

### Caminho de uma operação

Ao cadastrar um usuário, a tela `client/pages/Auth.tsx` chama `client/services/auth-api.ts`. O pedido chega a `src/routes/auth-routes.ts`, passa pelo controlador e alcança `src/services/auth-service.ts`. O serviço valida os dados, usa o modelo de usuário e devolve o resultado ao controlador.

### Banco, arquivos públicos e testes

| Pasta | Situação após a organização |
| --- | --- |
| `migrations` | Oito migrações preservadas. |
| `scripts` | A rotina existente de preparação do banco usa o novo caminho da configuração da conexão. |
| `public/uploads` | Caminho usado para as imagens enviadas pelos usuários. |
| `tests/unit` | Testes das permissões, imagens de perfil e chamadas da interface à API. |
| `tests/integration` | Testes das rotas e do limite de requisições. |
| `tests/security` | Verificação da versão instalada do Multer. |
| `docs` | Registro do antes e do depois da organização. |

Os comandos individuais de teste foram atualizados para os novos caminhos. O comando `npm test` reúne os testes unitários, de integração e de segurança. As rotas de teste usam respostas controladas em lugar do banco real.

A regra de exclusão de `config` no Git foi ajustada para permitir o versionamento das novas configurações de código. As regras de exclusão de senhas e arquivos privados continuam no arquivo de exclusões do projeto.

### Verificação depois da mudança

A compilação da interface e do servidor passou. Os 25 testes automatizados passaram, incluindo os nove testes anteriores e os casos adicionados para conferir autenticação, validações de cadastro, permissões de edição, enquetes, mensagens, resposta de falha das notícias, entrega da interface compilada e dados enviados pela interface. Também foi feita uma comparação das 39 rotas com a versão anterior: endereços, métodos, autenticação, regras e respostas foram preservados.

As migrações e a imagem de fundo da interface foram comparadas com a cópia anterior e mantêm o mesmo conteúdo. Os avisos do Vite e da importação de fontes no CSS já existiam antes da reorganização.

Uma conferência no navegador Chrome, com API simulada, verificou login, publicação com FormData, envio de mensagem, busca de pessoas, notificações, edição de perfil, configurações, ajuda, perfil público e publicações salvas. Não apareceram erros JavaScript durante esses fluxos.

Essas verificações não equivalem a testar todas as operações com o MySQL e dados reais. A reorganização foi realizada nos arquivos locais; não houve envio ao GitHub.
