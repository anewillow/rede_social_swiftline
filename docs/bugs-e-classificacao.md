# Etapa 2 — Identificação e Classificação de Bugs

Nesta etapa, o código do sistema foi revisado para identificar três bugs reais. Cada problema foi classificado de acordo com as categorias indicadas no enunciado do trabalho.

## 2.1 Classificação dos bugs

### Bug 1 — Vulnerabilidade de negação de serviço no Multer

**Tipo:** Dependência vulnerável  
**Local:** `package.json`, `package-lock.json` e uso do Multer em `src/app.ts`  
**Ferramenta utilizada:** Dependabot alerts — alerta #14

**Descrição:** O projeto utiliza o Multer na versão `2.0.2`, que foi indicada pelo Dependabot como vulnerável a um ataque de negação de serviço por recursão descontrolada. Uma requisição multipart malformada pode causar estouro de pilha e deixar o servidor indisponível.

### Bug 2 — Ausência de limitação de requisições na rota de upload

**Tipo:** Segurança  
**Local:** `src/app.ts`, linha 254  
**Ferramenta utilizada:** CodeQL e inspeção do código-fonte

**Descrição:** A rota `POST /api/posts` permite o envio de imagens, mas não limita a quantidade de requisições feitas por um usuário em determinado período. Como cada requisição processa um arquivo e registra uma publicação no banco de dados, vários envios em sequência podem consumir os recursos do servidor e prejudicar o funcionamento da aplicação.

### Bug 3 — Foto de perfil e imagem de capa não permanecem salvas

**Tipo:** Lógica  
**Local:** `client/App.tsx`, linhas 129–140; `src/app.ts`, linhas 190–200; e `src/models/User.ts`  
**Ferramenta utilizada:** Teste funcional manual e inspeção do código-fonte

**Descrição:** Durante o teste da edição de perfil, foi possível selecionar uma foto e uma imagem de capa, e as duas apareceram normalmente na tela. Porém, depois de sair do perfil e voltar, as imagens desapareceram. O problema foi classificado como um bug de lógica porque a interface mostra a alteração, mas o sistema não salva os dados de forma compatível. O frontend envia as imagens nos campos `avatar` e `cover`, enquanto o backend aceita somente um avatar em formato de URL HTTP(S) e não possui um campo para armazenar a capa.

## 2.2 Uso de ferramenta de apoio

O Dependabot foi ativado no repositório para verificar as dependências do projeto. A ferramenta analisou o `package-lock.json` e gerou um alerta para a versão do Multer utilizada pelo sistema. Esse alerta foi usado para identificar o Bug 1.

![Alerta do Dependabot para a versão vulnerável do Multer](./images/dependabot-multer-alerta.png)

O alerta não foi considerado um falso positivo. A versão `2.0.2` está registrada no `package-lock.json`, e o Multer é usado diretamente na rota de criação de publicações para processar o upload de imagens. Portanto, a dependência vulnerável faz parte do funcionamento real do sistema.

O CodeQL também foi utilizado como ferramenta complementar e ajudou a identificar o Bug 2. Esse alerta também não foi considerado um falso positivo, pois a rota indicada realmente não possui um mecanismo para limitar a quantidade de requisições. O terceiro bug foi encontrado por meio de um teste funcional manual.

## Situação nesta etapa

Nesta etapa, os bugs foram somente identificados e classificados. Os passos para reprodução, resultados obtidos e esperados, evidências detalhadas e severidade serão registrados nas Issues durante as etapas seguintes, conforme o enunciado do trabalho.
