# Diagnóstico do Swiftline

Data da revisão: 20 de novembro de 2026.

A revisão encontrou **15 grupos de problemas**: **14 no código e no funcionamento** e **uma lacuna de cobertura de testes**. Os quatro problemas inicialmente apresentados estão incluídos nessa contagem. Ocorrências com a mesma causa e a mesma direção de solução foram agrupadas; por isso, 19 reproduções controladas não significam 19 problemas independentes.

Este diagnóstico trata do código local após a organização dos arquivos. Essa organização foi principalmente uma modularização; não representa, por si só, uma reengenharia arquitetural concluída. O diagnóstico é a base para definir e justificar a arquitetura pretendida.

## Escopo e procedimento

Foram inventariados 125 arquivos: 66 de servidor, 38 de interface, sete de testes, oito migrações, um script e cinco arquivos de configuração ou entrada. Foram examinados os grupos das 39 rotas, as dez telas, os modelos, os serviços, o recebimento de arquivos, a navegação, a sessão e as integrações.

A revisão combinou leitura do código, comparação entre as partes e 19 verificações controladas: 11 de servidor e oito de interface no Chrome. Nas verificações, o banco e as respostas de serviços externos foram substituídos por respostas controladas. Os testes de arquivos usaram uma pasta temporária própria. Nenhum banco real ou dado dos usuários foi alterado.

Foram excluídos da análise de código próprio os pacotes de node_modules, os arquivos compilados de dist e client-dist, resultados de testes e arquivos pessoais enviados pelos usuários. A contagem representa os achados confirmados neste escopo, não uma prova de inexistência de outras falhas.

## Relação dos achados

| ID | Problema | Área | Prioridade |
| --- | --- | --- | --- |
| P01 | Regras de funcionalidades ainda ligadas ao pedido HTTP e ao banco | Estrutura | Média |
| P02 | Dados do autor repetidos e sincronizados em vários caminhos | Dados | Alta |
| P03 | Publicações e relações têm lógica repetida e comportamento diferente entre telas | Interface | Média |
| P04 | Preparação e evolução do banco seguem caminhos diferentes | Banco e inicialização | Alta |
| P05 | Algumas gravações não coordenam falhas e pedidos simultâneos | Consistência | Alta |
| P06 | Arquivos de publicações não têm um fluxo completo de validação e limpeza | Arquivos | Alta |
| P07 | Campos e limites não estão alinhados entre tela API e banco | Contrato de dados | Alta |
| P08 | Falhas não seguem um tratamento comum entre servidor e interface | Erros | Alta |
| P09 | Sessão rejeitada não é encerrada de forma centralizada | Sessão | Alta |
| P10 | A navegação tem mapas diferentes para o mesmo endereço | Navegação | Média |
| P11 | Respostas atrasadas podem atualizar uma conversa que já mudou | Estado assíncrono | Alta |
| P12 | Listagens e cálculos crescem sem paginação | Volume de dados | Média |
| P13 | Consultas externas iguais não compartilham uma atualização em andamento | Integrações | Média |
| P14 | Configurações necessárias aceitam valores locais sem validação do ambiente | Configuração e segurança | Alta quando publicado sem configuração própria |
| P15 | A cobertura existente não verifica o sistema com banco real nem todos os fluxos | Verificação | Alta para validar a próxima transformação |

## Evidências e mudanças propostas

### P01 Regras de funcionalidades ainda ligadas ao pedido HTTP e ao banco

**O que foi confirmado.** Os serviços recebem ServiceInput, definido a partir de Request do Express. As mesmas funções leem body, params e query, escolhem status HTTP, aplicam regras e chamam os modelos do Sequelize. O controlador funciona como um repassador.

**Efeito ou reprodução.** A separação em arquivos não criou uma separação completa de responsabilidades. Testar ou reutilizar uma regra exige conhecer o formato HTTP e as operações concretas do banco.

**Direção de mudança.** Definir entradas e resultados próprios de cada operação. O controlador interpreta o pedido e monta a resposta; o serviço executa o caso de uso; o acesso aos dados fica atrás de operações com nomes definidos. A necessidade de cada separação deve ser justificada por uso e teste, sem criar arquivos vazios.

**Onde aparece no código.**

- `src/types/service.ts`, linha 3.
- `src/controllers/handle.ts`, linha 9.
- `src/services/auth-service.ts`, linha 9.
- `src/services/posts-service.ts`, linha 66.

### P02 Dados do autor repetidos e sincronizados em vários caminhos

**O que foi confirmado.** Nome e avatar são mantidos em User e em Post. A edição do perfil atualiza publicações, e a inicialização também percorre publicações e usuários para repetir essa sincronização. A consulta da inicialização não seleciona avatar, mas a comparação usa post.avatar.

**Efeito ou reprodução.** A alteração de um perfil depende da atualização de cópias. Na reprodução da inicialização, a ausência do campo consultado já provocou uma atualização de avatar. A inicialização carrega esses registros antes de abrir o servidor.

**Direção de mudança.** Definir a origem oficial dos dados do autor. Avaliar consultar os dados atuais do usuário nas publicações ou, se as cópias forem necessárias, definir uma única rotina explícita de sincronização. Retirar a correção de dados do caminho normal de inicialização.

**Onde aparece no código.**

- `src/models/Post.ts`, linha 20.
- `src/services/profile-service.ts`, linha 46.
- `src/server.ts`, linha 13.

### P03 Publicações e relações têm lógica repetida e comportamento diferente entre telas

**O que foi confirmado.** Feed, salvos e perfil montam a publicação separadamente. PostActions e ProfilePostActions repetem as ações; Comments e ProfileComments tratam o mesmo tipo de comentário de formas diferentes. As sugestões e a busca iniciam o estado seguindo como uma lista vazia, sem obter as relações existentes.

**Efeito ou reprodução.** A mesma enquete apareceu no feed, mas não no perfil nem em salvos. O comentário próprio teve opção de edição no feed e não no perfil. A busca mostrou Seguir sem consultar se a relação já existia.

**Direção de mudança.** Definir um componente de publicação e operações de interação compartilhados, com variações visuais explícitas. Obter do servidor o estado real das relações e manter uma regra comum para atualizá-lo.

**Onde aparece no código.**

- `client/pages/Feed.tsx`, linha 452.
- `client/pages/SavedPosts.tsx`, linha 68.
- `client/components/posts/PostActions.tsx`, linha 18.
- `client/components/profile/ProfilePostActions.tsx`, linha 10.
- `client/components/posts/Comments.tsx`, linha 81.
- `client/components/profile/ProfileComments.tsx`, linha 6.
- `client/pages/Network.tsx`, linha 11.
- `client/components/layout/PeopleRail.tsx`, linha 8.

### P04 Preparação e evolução do banco seguem caminhos diferentes

**O que foi confirmado.** O projeto contém migrações, um script que cria a coluna de capa e sequelize.sync durante a inicialização. O prestart chama apenas a rotina da capa; não existe um comando de migração no package.json. As migrações usam Posts em alguns lugares e posts em outros; uma migração muda avatar para TEXT, mas o modelo declara STRING.

**Efeito ou reprodução.** As definições disponíveis não formam um único processo reproduzível de evolução do esquema. As divergências podem produzir esquemas diferentes conforme o caminho usado e a configuração do MySQL. O efeito em um banco real não foi executado nesta revisão.

**Direção de mudança.** Estabelecer uma sequência versionada para criar e atualizar o banco, alinhar as definições de modelos e migrações e testar essa sequência em um banco descartável. A inicialização deve verificar a conexão e abrir o servidor sem corrigir o esquema silenciosamente.

**Onde aparece no código.**

- `package.json`, linha 7.
- `scripts/apply-cover-local.mjs`, linha 22.
- `src/server.ts`, linha 12.
- `migrations/20250830191000-change-avatar-to-text-in-posts.js`, linha 6.
- `src/models/Post.ts`, linha 22.

### P05 Algumas gravações não coordenam falhas e pedidos simultâneos

**O que foi confirmado.** Criar comentário, criar curtida ou seguir uma pessoa envolve gravar uma ação e depois gravar a notificação, sem uma transação comum nesses fluxos. O compartilhamento lê o contador, soma um e salva. Voto e algumas interações fazem a verificação antes da gravação em passos separados.

**Efeito ou reprodução.** Ao simular falha de notificação, o fluxo executou a criação de um comentário e respondeu 500; repetir o pedido executou outra criação. Em dois compartilhamentos simultâneos, ambos responderam sucesso, mas o contador final foi um em vez de dois.

**Direção de mudança.** Definir a unidade de cada operação: transações para gravações que precisam ocorrer juntas, incrementos atômicos para contadores e tratamento das restrições de unicidade. Se notificações não precisarem bloquear a ação principal, definir seu registro e reenvio de forma explícita.

**Onde aparece no código.**

- `src/services/comments-service.ts`, linha 10.
- `src/services/comments-service.ts`, linha 13.
- `src/services/follow-service.ts`, linha 8.
- `src/services/posts-service.ts`, linha 174.
- `src/services/polls-service.ts`, linha 17.

### P06 Arquivos de publicações não têm um fluxo completo de validação e limpeza

**O que foi confirmado.** O Multer de publicações usa diskStorage sem fileFilter nem limits. A verificação de formato e tamanho está na tela, e o arquivo já é gravado antes da validação da publicação. A exclusão de publicação não remove o arquivo correspondente. O tratamento das imagens do perfil é separado e tem validações que esse caminho de publicações não aplica.

**Efeito ou reprodução.** Um arquivo de texto inofensivo foi aceito no campo de imagem e servido publicamente. Uma publicação rejeitada deixou seu arquivo no disco. Excluir outra publicação também deixou o arquivo. Todas essas reproduções usaram uma pasta temporária própria da auditoria.

**Direção de mudança.** Definir um fluxo de arquivo com validação no servidor, armazenamento, confirmação da publicação e compensação quando a operação falha. Definir a remoção ou a política de retenção dos arquivos ao excluir a publicação ou a conta. Aplicar limites no recebimento, antes de gravar o conteúdo.

**Onde aparece no código.**

- `src/middleware/upload.ts`, linha 6.
- `src/routes/posts-routes.ts`, linha 10.
- `src/services/posts-service.ts`, linha 40.
- `src/services/posts-service.ts`, linha 179.
- `src/services/profile-images-service.ts`, linha 5.

### P07 Campos e limites não estão alinhados entre tela API e banco

**O que foi confirmado.** A tela permite texto de até 280 caracteres. O modelo da publicação usa VARCHAR(255); a edição rejeita acima de 280, mas a criação não aplica esse limite. A edição de perfil apresenta localização e site, mas não os envia no pedido nem os mantém no modelo. Os clientes recebem Response e usam vários resultados JSON sem um contrato validado em tempo de execução.

**Efeito ou reprodução.** Com gravação simulada, criar um texto de 281 caracteres retornou 201 e editar o mesmo tamanho retornou 400. A declaração do modelo foi inspecionada e corresponde a VARCHAR(255); a rejeição pelo MySQL não foi testada. Localização e site preenchidos não foram enviados e ficaram vazios ao reabrir a tela.

**Direção de mudança.** Definir campos, tipos e limites para cada operação, alinhar interface, validação do servidor, modelo e migração. Campos que a tela oferece para salvar precisam ter suporte completo ou uma indicação clara de que não são persistidos.

**Onde aparece no código.**

- `client/pages/Feed.tsx`, linha 173.
- `src/models/Post.ts`, linha 23.
- `src/services/posts-service.ts`, linha 92.
- `client/pages/Profile.tsx`, linha 12.
- `client/pages/Profile.tsx`, linha 33.

### P08 Falhas não seguem um tratamento comum entre servidor e interface

**O que foi confirmado.** As respostas de erro variam entre error e message. Erros não previstos são encaminhados ao tratamento padrão do Express, que responde HTML. Algumas telas verificam response.ok e o formato dos dados; outras usam o JSON diretamente como uma lista.

**Efeito ou reprodução.** Uma falha controlada de consulta produziu HTTP 500 com conteúdo HTML. Na interface, uma resposta 503 de comentários com um objeto de erro chegou a items e provocou map is not a function durante a renderização.

**Direção de mudança.** Definir um formato de erro para a API, um tratador final de erros e funções clientes que diferenciem sucesso, falha de rede e falha da API. Cada tela deve conservar um estado de erro recuperável e validar a forma do resultado antes de renderizá-lo.

**Onde aparece no código.**

- `src/controllers/handle.ts`, linha 12.
- `src/app.ts`, linha 14.
- `src/middleware/payload-error.ts`, linha 10.
- `client/components/posts/Comments.tsx`, linha 23.
- `client/services/api.ts`, linha 9.

### P09 Sessão rejeitada não é encerrada de forma centralizada

**O que foi confirmado.** App recupera usuário e token do armazenamento local. Quando a consulta de sessão não é aceita, transforma a resposta em null, mas não limpa o armazenamento nem encerra a sessão visual. A função comum de pedidos também não aplica uma política para respostas 401.

**Efeito ou reprodução.** Com /api/auth/me respondendo 401, a interface autenticada continuou visível e o usuário e o token permaneceram no armazenamento local. Isso não elimina a proteção do servidor, mas deixa a interface em uma sessão inválida.

**Direção de mudança.** Definir um único responsável pelo estado de autenticação. Ao confirmar sessão inválida, limpar os dados locais e oferecer a entrada novamente, com uma política explícita para dados ainda não enviados.

**Onde aparece no código.**

- `client/App.tsx`, linha 66.
- `client/App.tsx`, linha 69.
- `client/services/api.ts`, linha 6.

### P10 A navegação tem mapas diferentes para o mesmo endereço

**O que foi confirmado.** App associa a página saved a /saved.html. A função que interpreta o endereço não trata saved e cai no feed. Outros componentes também escrevem endereços diretamente com history.pushState.

**Efeito ou reprodução.** Abrir ou recarregar /saved.html exibiu o feed. O endereço e a tela não representam a mesma página nesse caminho.

**Direção de mudança.** Definir uma única tabela de rotas ou um roteador que seja usado tanto ao navegar quanto ao interpretar o endereço atual. Conferir recarga, voltar, avançar e links diretos para cada página.

**Onde aparece no código.**

- `client/App.tsx`, linha 37.
- `client/utils/navigation.ts`, linha 3.
- `client/components/layout/Shell.tsx`, linha 29.

### P11 Respostas atrasadas podem atualizar uma conversa que já mudou

**O que foi confirmado.** Ao selecionar uma pessoa, Messages busca o histórico e aplica setItems quando a resposta chega. Esse pedido não é cancelado e não confere se a pessoa ainda é a selecionada. A busca de pessoas já usa AbortController, mas o carregamento da conversa não usa a mesma proteção.

**Efeito ou reprodução.** Foi possível selecionar Alice, selecionar Bob e receber primeiro o histórico de Bob. Quando a resposta atrasada de Alice chegou, a tela continuou com o cabeçalho de Bob e passou a mostrar o histórico de Alice.

**Direção de mudança.** Associar cada carregamento à conversa correspondente, cancelar pedidos anteriores ou ignorar resultados obsoletos. Definir estados de carregamento e resultados por identificador de conversa.

**Onde aparece no código.**

- `client/pages/Messages.tsx`, linha 44.
- `client/pages/Messages.tsx`, linha 46.
- `client/services/messages-api.ts`, linha 5.

### P12 Listagens e cálculos crescem sem paginação

**O que foi confirmado.** Feed, comentários, históricos de mensagens, seguidores e notificações usam consultas sem paginação. O enriquecimento das publicações carrega opções e votos dos posts obtidos para montar as contagens em memória. A busca de destinatários e a busca global têm limites, portanto o problema não foi atribuído a todas as consultas.

**Efeito ou reprodução.** Um pedido de feed com limit=10 e offset=20 não aplicou limite nem deslocamento à consulta. Conforme os dados crescem, esses caminhos continuam buscando todos os registros correspondentes. Esta revisão não mediu lentidão no banco real.

**Direção de mudança.** Definir paginação por cursor ou por página, limites máximos e uma estratégia de contagem no banco. Carregar somente os dados necessários à página atual e testar o comportamento com volume representativo.

**Onde aparece no código.**

- `src/services/posts-service.ts`, linha 21.
- `src/services/comments-service.ts`, linha 50.
- `src/services/messages-service.ts`, linha 21.
- `src/services/notifications-service.ts`, linha 5.
- `src/services/post-activity-service.ts`, linha 37.

### P13 Consultas externas iguais não compartilham uma atualização em andamento

**O que foi confirmado.** Notícias e tendências mantêm cache em memória, mas o preenchem somente depois da consulta externa. Não há uma operação em andamento compartilhada entre pedidos simultâneos. As tendências fazem várias consultas por atualização.

**Efeito ou reprodução.** Dois pedidos simultâneos ao mesmo serviço de notícias, com cache vazio, executaram duas consultas externas simuladas. O cache reduz consultas posteriores, mas não impede essa repetição na atualização.

**Direção de mudança.** Compartilhar a mesma atualização entre pedidos simultâneos, manter limites e tempos de espera e decidir como apresentar dados anteriores quando o provedor falha. Escolher persistência de cache conforme a implantação real, sem presumir vários servidores.

**Onde aparece no código.**

- `src/services/news-service.ts`, linha 39.
- `src/services/news-service.ts`, linha 92.
- `src/services/trends-service.ts`, linha 42.

### P14 Configurações necessárias aceitam valores locais sem validação do ambiente

**O que foi confirmado.** A autenticação fornece um segredo padrão quando JWT_SECRET está ausente. A conexão também oferece valores locais fixos para o banco. Não há uma etapa que valide as configurações necessárias ao ambiente de execução. Os caminhos de arquivos dependem do diretório de onde o processo é iniciado.

**Efeito ou reprodução.** Ao remover JWT_SECRET apenas do processo isolado da auditoria, a função continuou fornecendo um segredo padrão. Não foi afirmado que um servidor publicado esteja nessa condição. O caminho atual de execução depende da orientação de iniciar dentro de sistema.

**Direção de mudança.** Reunir e validar as configurações na inicialização, distinguir desenvolvimento e ambiente publicado e exigir os segredos apropriados. Resolver os caminhos a partir de uma raiz definida para a aplicação e registrar mensagens claras quando a configuração estiver incompleta.

**Onde aparece no código.**

- `src/middleware/auth.ts`, linha 4.
- `src/config/database.ts`, linha 4.
- `src/config/paths.ts`, linha 3.

### P15 A cobertura existente não verifica o sistema com banco real nem todos os fluxos

**O que foi confirmado.** Os sete arquivos da suíte contêm 25 casos e subcasos. Os testes das rotas e das chamadas da interface substituem dependências por respostas controladas. Não há teste conectado a MySQL descartável nem uma suíte Playwright dedicada registrada no projeto; o script test:e2e existe, mas não há configuração ou arquivos .spec de Playwright.

**Efeito ou reprodução.** A aprovação da suíte atual não demonstra aplicação de migrações, restrições do banco, comportamento concorrente, compensação de arquivos ou todos os fluxos do navegador. As reproduções desta auditoria confirmaram comportamentos que essa suíte não verifica.

**Direção de mudança.** Adicionar verificação de instalação e migração em banco descartável, testes dos limites dos serviços e casos de erro e concorrência. Registrar testes de navegador para navegação, sessão e operações principais. Usar o diagnóstico para escolher os casos, evitando testes que apenas repitam a implementação.

**Onde aparece no código.**

- `tests/integration/api-routes.test.ts`, linha 55.
- `tests/unit/client-api.test.ts`, linha 19.
- `package.json`, linha 17.

## Resultado das verificações

### Servidor

- upload sem filtro no servidor.
- arquivo permanece apos publicacao rejeitada.
- arquivo permanece apos exclusao de publicacao.
- limites de texto diferentes entre criar editar e modelo.
- comentario criado mesmo quando notificacao falha.
- dois compartilhamentos simultaneos perdem uma contagem.
- listagem ignora parametros de paginacao.
- erro inesperado da API usa HTML.
- cache de noticias repete consultas simultaneas.
- configuracao aceita ausencia de segredo JWT.
- inicializacao atualiza avatar mesmo sem consultar esse campo.

### Interface

- endereco de salvos abre feed ao carregar novamente.
- sessao rejeitada continua com usuario e token locais.
- resposta antiga de conversa sobrescreve a conversa atual.
- mesma enquete nao aparece no perfil e nos salvos.
- edicao de comentario difere entre feed e perfil.
- estado inicial de seguir nao consulta a relacao existente.
- localizacao e site preenchidos nao sao enviados nem mantidos.
- falha de comentarios pode interromper a renderizacao da tela.

As verificações confirmam o comportamento do código nos cenários descritos. Os casos de falha e concorrência usam substituições controladas dos modelos; efeitos de chaves estrangeiras, transações, configuração do MySQL e aplicação completa das migrações ainda exigem um banco descartável. A suíte habitual de 25 testes havia passado, mas não cobre esses cenários adicionais.

## Uso do diagnóstico na reengenharia

Os achados não são todos exclusivamente arquiteturais. Há decisões de estrutura e de dados, falhas funcionais, aspectos de segurança e uma lacuna de verificação. O plano deve indicar quais mudanças alteram responsabilidades e dependências e quais correções acompanham essa transformação.

Para manter o trabalho verificável, o documento do projeto deve registrar a estrutura anterior, os problemas escolhidos, a arquitetura proposta e as evidências da implementação. Criar mais pastas ou diminuir arquivos não substitui essa comparação.

Nesta etapa não foram aplicadas correções funcionais nem enviados commits ao GitHub. Os hashes dos 125 arquivos inventariados foram comparados ao final da revisão e permaneceram iguais.
