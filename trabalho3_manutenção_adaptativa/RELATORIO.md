# Relatório Final — Manutenção Adaptativa do Swiftline

## Manutenção e Integração de Software

**Equipe:** Dayane Rodrigues, Lucas Marinho e Victória Caroline Alves  
**Professor:** Andrey Rodrigues

---

## 1. Introdução

Neste trabalho, realizamos três estratégias de manutenção adaptativa no Swiftline. Atualizamos uma dependência do backend, adaptamos funcionalidades relacionadas à privacidade dos usuários e migramos a fonte externa de notícias. Em cada estratégia, registramos o funcionamento anterior, o problema encontrado, o código modificado e o resultado após a adaptação.

---

## 2. Estratégia 1 — Mudança de dependência

Atualizamos o Express da versão 4.21.2 para a versão 5.2.1. Após a atualização, o servidor deixou de iniciar por causa da rota curinga `app.get('*', ...)`, que não era compatível com a nova versão.

Substituímos essa rota por `app.get('/{*splat}', ...)`, utilizando a sintaxe aceita pelo Express 5. Depois da correção, iniciamos o servidor e verificamos o funcionamento do cadastro, do login e do feed do Swiftline.

**Resultado:** concluímos a atualização da dependência e corrigimos a incompatibilidade sem comprometer o funcionamento do sistema.

---

## 3. Estratégia 2 — Mudança de regulamentação

Adaptamos duas funcionalidades relacionadas à privacidade e ao controle dos dados do usuário.

Na primeira funcionalidade, incluímos o aceite obrigatório dos Termos de Uso e da Política de Privacidade na criação da conta. Adicionamos a opção na tela de cadastro, disponibilizamos os documentos para leitura e criamos uma validação no servidor para impedir o cadastro sem o aceite.

Na segunda funcionalidade, criamos uma tela de configurações com a opção **Excluir minha conta**. Antes de excluir os dados, o sistema solicita a senha e apresenta uma confirmação. Quando a exclusão é concluída, mostramos uma mensagem de sucesso, encerramos o acesso e retornamos o usuário para a tela de login.

**Resultado:** o Swiftline passou a registrar o aceite dos documentos no cadastro e a permitir que o usuário exclua sua própria conta de forma confirmada.

---

## 4. Estratégia 3 — Migração de API externa

O Swiftline utilizava o Bing RSS para carregar notícias sobre Taylor Swift. Testamos essa fonte no Postman e verificamos que os resultados eram retornados em XML. Em seguida, testamos a API GDELT, que oferece acesso público e retorna os dados em JSON.

Substituímos a consulta ao Bing RSS pela GDELT Context 2.0. Adaptamos os dados recebidos para preservar o título, o link, a fonte, a data, a imagem e a descrição das notícias. Também filtramos os resultados pelo título, removemos repetições, organizamos as matérias pelas mais recentes e adicionamos um cache de cinco minutos.

**Resultado:** o Swiftline passou a carregar e exibir as notícias pela GDELT, mantendo a estrutura visual da funcionalidade e identificando a nova fonte na interface.

---

## 5. Código atualizado

As principais alterações foram realizadas nos seguintes arquivos:

- `package.json` e `package-lock.json`: atualização do Express;
- `src/app.ts`: compatibilidade com o Express 5, validação do aceite, exclusão da conta e integração com a GDELT;
- `client/App.tsx`: aceite dos documentos, tela de configurações, exclusão da conta e exibição da nova fonte de notícias;
- `client/styles.css`: aparência das novas funcionalidades e animação de despedida.

---

## 6. Testes e evidências

Para cada estratégia, produzimos uma evidência com o antes e o depois da adaptação. Registramos as versões utilizadas, os erros encontrados, os trechos de código modificados e o funcionamento final do Swiftline. Na migração da API, também registramos as requisições realizadas no Postman e as respostas em XML e JSON.

As evidências completas estão organizadas nos arquivos:

- [`evidencia1.md`](evidencia1.md);
- [`evidencia2.md`](evidencia2.md);
- [`evidencia3.md`](evidencia3.md).

---

## 7. Conclusão

Concluímos as três estratégias propostas e mantivemos o Swiftline funcionando após todas as alterações. A atualização do Express garantiu a compatibilidade do backend, as mudanças de privacidade ampliaram o controle do usuário sobre seus dados e a migração para a GDELT substituiu a antiga fonte de notícias. Com essas adaptações, demonstramos como a manutenção adaptativa permite que um sistema acompanhe mudanças técnicas e novas necessidades externas.
