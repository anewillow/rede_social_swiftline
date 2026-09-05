# Etapa 2 — Identificação e Classificação de Bugs

## 2.1 Classificação dos bugs

### Bug 1 — Vulnerabilidade de negação de serviço no Multer

**Tipo:** Dependência vulnerável  
**Local:** `package.json` e `package-lock.json` — dependência `multer`, versão `2.0.2`  
**Descrição:** O Dependabot alertou que a versão utilizada do Multer é afetada pela vulnerabilidade **CVE-2026-3520**, de gravidade alta (8,7/10). Versões anteriores à `2.1.1` permitem que um atacante provoque uma negação de serviço (DoS) por meio do envio de solicitações malformadas, podendo causar estouro de pilha. A vulnerabilidade é corrigida na versão `2.1.1`, e o Dependabot recomenda a atualização para a versão `2.2.0` ou posterior.

### Bug 2 — Foto de perfil selecionada não permanece salva

**Tipo:** Lógica  
**Local:** `client/App.tsx`, linhas 138–140; `src/app.ts`, linhas 190–200  
**Descrição:** Ao selecionar uma foto de perfil, a imagem é exibida na tela de edição, porém não permanece salva. O frontend converte o arquivo escolhido em uma Data URL e o envia no campo `avatar`, enquanto o backend aceita nesse campo somente URLs de imagem iniciadas por `http://` ou `https://`. Dessa forma, a imagem selecionada localmente não é aceita para persistência.

### Bug 3 — Imagem de capa selecionada não permanece salva

**Tipo:** Lógica  
**Local:** `client/App.tsx`, linhas 133 e 139–140; `src/app.ts`, linhas 190–200; `src/models/User.ts`  
**Descrição:** Ao selecionar uma imagem de capa, ela é exibida na tela de edição, mas desaparece depois que o perfil é carregado novamente. O frontend envia a imagem no campo `cover`, porém o backend da atualização de perfil não recebe nem salva esse campo. Além disso, o modelo `User` não possui um atributo `cover` para armazenar a imagem.

## 2.2 Uso de ferramentas de apoio

O **Dependabot do GitHub** foi utilizado para verificar dependências do projeto com vulnerabilidades conhecidas. A ferramenta gerou o **alerta #14** para o pacote `multer`, identificando a vulnerabilidade **CVE-2026-3520**.

![Alerta do Dependabot para a versão vulnerável do Multer](./images/dependabot-multer-alerta.png)

O alerta não foi considerado um falso positivo, pois o projeto utiliza a versão `2.0.2` do Multer, enquanto o próprio Dependabot informa que todas as versões anteriores à `2.1.1` são afetadas. Além disso, a biblioteca é utilizada pelo sistema no processamento de upload de imagens.

Os Bugs 2 e 3 foram identificados por meio de teste funcional manual e confirmados pela inspeção do código-fonte.
