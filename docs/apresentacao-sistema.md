\# Etapa 1 — Apresentação do Sistema



\## Descrição breve do sistema



O Swiftline é uma aplicação web de rede social voltada para fãs de Taylor Swift, inspirada na estrutura e nas interações do X. O sistema permite cadastrar e autenticar usuários, editar perfis, publicar textos de até 280 caracteres com imagens e visualizar publicações nas abas “Para você” e “Seguindo”.



A plataforma também permite curtir, comentar, repostar, salvar e compartilhar publicações. Além disso, oferece busca de usuários e posts, gerenciamento de seguidores, notificações, mensagens privadas, contagem de visualizações e acesso a notícias relacionadas à artista.



\## Arquitetura resumida



O sistema utiliza uma arquitetura web em camadas. O frontend foi desenvolvido com React, TypeScript e Vite. O backend utiliza Node.js e Express para disponibilizar uma API REST, aplicar as regras de negócio, realizar a autenticação com JWT e processar o envio de imagens. A persistência dos dados é feita no MySQL por meio do Sequelize.



```mermaid

architecture-beta

&#x20;   group presentation(cloud)\[Camada de apresentação]

&#x20;   group application(server)\[Camada de aplicação]

&#x20;   group persistence(database)\[Camada de persistência]

&#x20;   group integrations(internet)\[Integrações externas]



&#x20;   service browser(internet)\[Navegador] in presentation

&#x20;   service frontend(server)\[React + TypeScript + Vite] in presentation



&#x20;   service api(server)\[API REST Node.js + Express] in application

&#x20;   service auth(server)\[Autenticação JWT] in application

&#x20;   service orm(server)\[Sequelize ORM] in application



&#x20;   service mysql(database)\[Banco de dados MySQL] in persistence

&#x20;   service uploads(disk)\[Imagens public/uploads] in persistence



&#x20;   service trends(internet)\[Wikimedia Pageviews] in integrations

&#x20;   service news(internet)\[Bing Notícias] in integrations



&#x20;   browser:R --> L:frontend

&#x20;   frontend:R --> L:api

&#x20;   api:B --> T:auth

&#x20;   api:B --> T:orm

&#x20;   orm:B --> T:mysql

&#x20;   api:B --> T:uploads

&#x20;   api:R --> L:trends

&#x20;   api:R --> L:news

```



Na camada de apresentação, o navegador carrega a interface React construída pelo Vite. A interface envia requisições para a API REST, que concentra as rotas, a autenticação e as regras do sistema. O Sequelize realiza a comunicação com o MySQL, enquanto as imagens são armazenadas em `public/uploads`. A API também consulta os serviços externos Wikimedia Pageviews e Bing Notícias.



\## Como executar o sistema



\### Pré-requisitos



\- Node.js e npm instalados;

\- MySQL instalado e em execução;

\- Git instalado.



\### 1. Clonar o repositório



```bash

git clone https://github.com/anewillow/rede\_social\_swiftline.git

cd rede\_social\_swiftline

```



\### 2. Instalar as dependências



```bash

npm install

```



\### 3. Criar o banco de dados



No MySQL, execute:



```sql

CREATE DATABASE swiftline

CHARACTER SET utf8mb4

COLLATE utf8mb4\_unicode\_ci;

```



\### 4. Configurar as variáveis de ambiente



Crie um arquivo `.env` na raiz do projeto:



```env

DB\_HOST=localhost

DB\_USER=root

DB\_PASSWORD=sua\_senha\_do\_mysql

DB\_NAME=swiftline

PORT=3000

JWT\_SECRET=substitua\_por\_uma\_chave\_secreta\_forte

```



O arquivo `.env` contém informações privadas e não deve ser enviado ao GitHub.



\### 5. Iniciar o sistema



```bash

npm run dev

```



A aplicação ficará disponível em:



```text

http://localhost:3000

```



\### 6. Verificar a compilação



```bash

npm run build

```



Esse comando verifica o código TypeScript e gera a versão compilada do frontend no diretório `client-dist/`.

