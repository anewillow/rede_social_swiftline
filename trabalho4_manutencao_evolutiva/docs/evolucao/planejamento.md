# Planejamento da Manutenção Evolutiva

**Equipe:** Dayane Rodrigues, Lucas Marinho e Victória Caroline Alves
**Professor:** Andrey Rodrigues

## Objetivo

Esta etapa dará continuidade ao Swiftline com duas novas funcionalidades e uma
melhoria de acessibilidade. As mudanças foram escolhidas por terem relação direta
com o uso de uma rede social.

## Mudanças escolhidas

| Nº | Tipo | Mudança | Justificativa | Status |
| ---: | --- | --- | --- | --- |
| 1 | Funcionalidade | Busca de pessoas nas mensagens | Facilita encontrar uma conversa quando há muitos usuários cadastrados. | Implementada |
| 2 | Funcionalidade | Enquetes nas publicações | Permite criar perguntas, votar e acompanhar os resultados dentro do feed. | Implementada |
| 3 | Acessibilidade | Modo de alto contraste | Facilita a leitura para pessoas com baixa visão ou dificuldade para diferenciar cores. | Implementada |

## 1. Busca de pessoas nas mensagens

### Problema

A tela de mensagens mostra uma lista limitada de pessoas e não possui uma busca
própria. Isso dificulta encontrar alguém quando há muitos usuários cadastrados.

### O que será feito

- Adicionar um campo de busca na lista de conversas.
- Procurar usuários pelo nome enquanto a pessoa digita.
- Permitir abrir a conversa a partir do resultado.
- Informar quando nenhum usuário for encontrado.

### Critérios de conclusão

- [x] A busca aparece na tela de mensagens.
- [x] A pesquisa aceita parte do nome.
- [x] Os resultados podem ser selecionados.
- [x] A tela informa quando não há resultados.

## 2. Enquetes nas publicações

### Problema

O botão de enquete aparece na área de publicação, mas a função ainda não está
disponível. As publicações permitem apenas texto e imagem.

### O que será feito

- Permitir criar uma enquete com duas a quatro opções.
- Impedir opções vazias ou repetidas.
- Permitir apenas um voto por usuário em cada enquete.
- Mostrar a quantidade de votos após a escolha.

### Critérios de conclusão

- [x] O botão de enquete abre os campos das opções.
- [x] A publicação aceita de duas a quatro opções válidas.
- [x] Cada usuário consegue votar apenas uma vez.
- [x] O resultado é atualizado depois do voto.

## 3. Modo de alto contraste

### Problema identificado

Alguns textos, bordas e ícones usam tons claros sobre fundos também claros. Essa
combinação pode dificultar a leitura para pessoas com baixa visão ou dificuldade
para diferenciar cores.

### Público beneficiado

Pessoas com baixa visão, daltonismo ou sensibilidade a combinações com pouco
contraste.

### O que será feito

- Adicionar a opção **Alto contraste** nas configurações.
- Aumentar a diferença entre texto, fundo, bordas e botões.
- Destacar o foco dos elementos usados pelo teclado.
- Manter a preferência depois que a página for atualizada.

### Critérios de conclusão

- [x] A opção de alto contraste aparece nas configurações.
- [x] A mudança alcança as principais telas do sistema.
- [x] Textos, ícones, bordas e botões ficam mais fáceis de distinguir.
- [x] O foco do teclado permanece visível.
- [x] A preferência continua ativa após atualizar a página.

## Registro final

As mudanças concluídas estão no documento
[Evidências da manutenção evolutiva](./evidencias-evolucao.md).
