
# TP3 - Manutenção Adaptativa

## Estratégia 1 — Mudança de dependência

Equipe: Dayane Rodrigues, Lucas Marinho, Victória Caroline Alves
ProF: Andrey Rodrigues

---

## Problema

O Sistema utilizava Express 4.21.2. Após a atualização para Express 5.2.1, o servidor apresentou o erro Missing parameter name at index 1: *`, causado pela rota curinga app.get('*', ...)`.

---

## Adaptação realizada

A rota foi alterada para `app.get('/{*splat}', ...)`, sintaxe compatível com Express 5. Depois da correção, o servidor iniciou sem o erro.

---

## Evidência em vídeo

[Assistir ao vídeo da estratégia 1](https://github.com/user-attachments/assets/fc23a031-6cc0-4ae4-854c-918cd0e6dc17)

Em um único vídeo, mostramos o antes e o depois da estratégia:

1. A versão do Express antes e depois da atualização.
2. O erro encontrado.
3. O código antes e depois da correção.
4. O Swiftline funcionando no navegador, com criação de conta, login e acesso ao feed.

---

## Resultado

A incompatibilidade da rota foi corrigida, e o Swiftline voltou
a funcionar com Express 5.2.1.

---

## Arquivos alterados

- `package.json` e `package-lock.json`: atualização do Express.
- `src/app.ts`: correção da rota curinga.
