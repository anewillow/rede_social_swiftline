# Plano de Estratégia Adaptativa

## Manutenção e Integração de Software

**Equipe:** Dayane Rodrigues, Lucas Marinho e Victória Caroline Alves  
**Professor:** Andrey Rodrigues

---

## 1. Objetivo

Neste trabalho, aplicaremos estratégias de manutenção adaptativa no Swiftline, considerando mudanças em dependências, regulamentações e APIs externas. Nosso objetivo é adaptar o sistema a novas condições externas, mantendo seu funcionamento após cada alteração.

---

## 2. Estratégias

| Estratégia | Mudança proposta | Situação |
|---|---|---|
| Mudança de Dependência | Atualização do Express 4.21.2 para o Express 5.2.1 | Concluída |
| Mudança de Regulamentação | Adaptação do cadastro e da exclusão de conta às regras de privacidade | Concluída |
| Migração de API Externa | Migração da fonte de notícias do Bing RSS para a API GDELT | Concluída |

---

## 3. Simulação de Mudança de Dependência

### Problema

O Swiftline utilizava o Express 4.21.2 no backend. Após atualizarmos a dependência para a versão 5.2.1, encontramos uma incompatibilidade na rota curinga `app.get('*', ...)`. Essa incompatibilidade impedia a inicialização do servidor e apresentava o erro `Missing parameter name at index 1: *`.

### Adaptação Realizada

Alteramos a rota para `app.get('/{*splat}', ...)`, utilizando a sintaxe aceita pelo Express 5. Após a correção, iniciamos o servidor, criamos uma conta, realizamos o login e acessamos o feed do Swiftline normalmente.

---

## 4. Cenário de Mudança de Regulamentação

### Problema

O Swiftline possui cadastro de usuários e armazena informações pessoais, como nome e endereço de e-mail. Para adaptar o sistema às regras de privacidade e proteção de dados, escolhemos modificar duas funcionalidades.

### Adaptação Planejada

No cadastro, adicionaremos os Termos de Uso e a Política de Privacidade, que deverão ser aceitos antes da criação da conta. No perfil, adicionaremos uma opção para que o usuário possa excluir sua própria conta. Antes da exclusão, o sistema solicitará uma confirmação.

---

## 5. Migração de API Externa

### Problema

O Swiftline utiliza um feed RSS do Bing para exibir notícias sobre Taylor Swift. Como cenário de manutenção adaptativa, migraremos essa funcionalidade para a API GDELT.

### Adaptação Planejada

Testaremos as duas fontes no Postman e registraremos as requisições. Em seguida, substituiremos o feed RSS do Bing pela resposta em JSON da API GDELT. Adaptaremos os dados recebidos para continuar exibindo o título, a fonte, a data, a imagem e o link de cada notícia. Também trataremos possíveis falhas ou indisponibilidades da API.

---

## 6. Evidências

Para comprovarmos as adaptações realizadas, registraremos:

- funcionamento do sistema antes e depois das alterações;
- versões utilizadas;
- erros encontrados;
- trechos de código modificados;
- testes realizados no Postman;
- prints e vídeos das execuções.

As evidências serão apresentadas nos arquivos correspondentes a cada estratégia.

---

## 7. Resultado Esperado

Ao final do trabalho, esperamos que o Swiftline esteja funcionando com o Express 5.2.1, adaptado às novas regras de privacidade e integrado à nova API de notícias.
