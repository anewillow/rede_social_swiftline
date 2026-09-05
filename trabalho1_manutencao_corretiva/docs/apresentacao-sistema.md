# Etapa 1 — Apresentação do Sistema



## Descrição breve do sistema



O Swiftline é uma aplicação web de rede social voltada para fãs de Taylor Swift, inspirada na estrutura e nas interações do X. O sistema permite cadastrar e autenticar usuários, editar perfis, publicar textos de até 280 caracteres com imagens e visualizar publicações nas abas “Para você” e “Seguindo”.



A plataforma também permite curtir, comentar, repostar, salvar e compartilhar publicações. Além disso, oferece busca de usuários e posts, gerenciamento de seguidores, notificações, mensagens privadas, contagem de visualizações e acesso a notícias relacionadas à artista.



## Arquitetura resumida



O sistema utiliza uma arquitetura web em camadas. O frontend foi desenvolvido com React, TypeScript e Vite. O backend utiliza Node.js e Express para disponibilizar uma API REST, aplicar as regras de negócio, realizar a autenticação com JWT e processar o envio de imagens. A persistência dos dados é feita no MySQL por meio do Sequelize.



```mermaid

architecture-beta

    group presentation(cloud)[Camada de apresentação]

    group application(server)[Camada de aplicação]

    group persistence(database)[Camada de persistência]

    group integrations(internet)[Integrações externas]



    service browser(internet)[Navegador] in presentation

    service frontend(server)[React + TypeScript + Vite] in presentation



    service api(server)[API REST Node.js + Express] in application

    service auth(server)[Autenticação JWT] in application

    service orm(server)[Sequelize ORM] in application



    service mysql(database)[Banco de dados MySQL] in persistence

    service uploads(disk)[Imagens public/uploads] in persistence



    service trends(internet)[Wikimedia Pageviews] in integrations

    service news(internet)[Bing Notícias] in integrations



    browser:R --> L:frontend

    frontend:R --> L:api

    api:B --> T:auth

    api:B --> T:orm

    orm:B --> T:mysql

    api:B --> T:uploads

    api:R --> L:trends

    api:R --> L:news

```



Na camada de apresentação, o navegador carrega a interface React construída pelo Vite. A interface envia requisições para a API REST, que concentra as rotas, a autenticação e as regras do sistema. O Sequelize realiza a comunicação com o MySQL, enquanto as imagens são armazenadas em `public/uploads`. A API também consulta os serviços externos Wikimedia Pageviews e Bing Notícias.



## Como executar o sistema

Para testar o Swiftline  primeiro se o Node.js (com npm), o MySQL e o Git estão instalados. Depois, é necessário  seguir os passos abaixo:

### 1. Baixe o projeto

Abra o terminal, clone o repositório e entre na pasta criada:

```bash
git clone https://github.com/anewillow/rede_social_swiftline.git
cd rede_social_swiftline/sistema
```

### 2. Instale as dependências

Já dentro da pasta do projeto, instale os pacotes necessários:

```bash
npm install
```

### 3. Prepare o banco de dados

Com o MySQL em execução, crie o banco que será usado pela aplicação:

```sql
CREATE DATABASE swiftline
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

### 4. Configure a conexão

Dentro da pasta `sistema`, crie um arquivo chamado `.env` e informe os dados do seu MySQL:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha_do_mysql
DB_NAME=swiftline
PORT=3000
JWT_SECRET=substitua_por_uma_chave_secreta
```

Troque a senha e a chave secreta pelos valores que pretende usar.

### 5. Rode o Swiftline

Iniciar o projeto:

```bash
npm run dev
```

Quando o servidor estiver pronto, abra [http://localhost:3000](http://localhost:3000) no navegador.

### 6. Confira a compilação

Para confirmar que o projeto está compilando sem erros, execute:

```bash
npm run build
```

Além de verificar o código TypeScript, esse comando gera a versão final do frontend na pasta `client-dist/`.

