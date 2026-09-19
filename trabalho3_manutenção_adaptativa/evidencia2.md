# TP3 - Manutenção Adaptativa

## Estratégia 2 — Mudança de regulamentação

**Equipe:** Dayane Rodrigues, Lucas Marinho e Victória Caroline Alves  
**Professor:** Andrey Rodrigues

---

## Problema

O Swiftline possuia dois problemas. O primeiro permitia a criação de contas sem o aceite dos Termos de Uso e da Política de Privacidade. O segundo não oferecia uma opção para que o usuário excluísse sua conta.  Dessa forma adequamos essas duas funcionalidades.

---

## Funcionalidade 1 — Aceite dos Termos de Uso e da Política de Privacidade

Adicionamos uma caixa de seleção obrigatória à tela de cadastro.  Incluímos os links dos Termos de Uso e da Política de Privacidade, que abrem o conteúdo para leitura na própria página.

Além da validação na tela, adicionamos uma verificação no servidor. Dessa forma, o cadastro somente é concluído quando o usuário informa que aceitou os dois documentos.

### Código alterado

- `client/App.tsx`: inclusão da caixa de aceite e das janelas com os documentos.
- `client/styles.css`: aparência da caixa de aceite e das janelas.
- `src/app.ts`: validação do campo `acceptedTerms` no cadastro.

---

## Funcionalidade 2 — Exclusão da própria conta

Criamos uma tela de configurações separada da edição do perfil. Nessa tela, adicionamos a opção **Excluir minha conta**.

Antes da exclusão, solicitamos a senha do usuário e exibimos uma confirmação informando que a ação não poderá ser desfeita. Após a confirmação, o servidor valida a senha, remove a conta e seus dados relacionados e encerra o acesso do usuário. Ao final, mostramos a mensagem **Conta excluída com sucesso!** com uma animação de despedida e retornamos para a tela de login.

### Código alterado

- `client/App.tsx`: criação da tela de configurações, confirmação por senha e mensagem de sucesso.
- `client/styles.css`: aparência da tela, da confirmação e da animação de despedida.
- `src/app.ts`: criação da rota `DELETE /api/auth/delete` e exclusão dos dados da conta.

---

## Evidência

[Assistir ao vídeo da estratégia 2](https://github.com/user-attachments/assets/922b148b-88f3-4cb6-9b28-f8066e9bd6d7)

Em um único vídeo, mostramos o antes e o depois da estratégia:

1. o cadastro antes da adaptação;
2. o cadastro com o aceite obrigatório dos Termos de Uso e da Política de Privacidade;
3. o código responsável por validar o aceite;
4. a tela anterior, que possuía apenas a edição do perfil;
5. a nova tela de configurações com a opção de excluir a conta;
6. a confirmação por senha;
7. o código responsável pela exclusão;
8. a mensagem de conta excluída e o retorno para o login.

---

## Resultado

Concluímos as duas adaptações planejadas. O Swiftline passou a exigir o aceite dos documentos no cadastro e passou a permitir que o usuário exclua sua própria conta de forma confirmada e segura.
