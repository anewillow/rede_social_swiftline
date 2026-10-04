# Issue 04 — Validação da imagem

## Heurística relacionada

**5 — Prevenção de erros**

## Problema

O sistema não informava o limite da imagem e aceitava o arquivo sem verificar o
tamanho.

## Mudança

Mostrar o limite de 3 MB e os formatos aceitos. Recusar arquivos inválidos no
momento da escolha e explicar o problema.

## Critérios de conclusão

- [x] O limite aparece antes da escolha da imagem.
- [x] Imagens válidas mostram uma prévia.
- [x] Arquivos maiores que 3 MB são recusados.
- [x] Formatos não aceitos mostram uma mensagem.

## Evidências

- Vídeo: [adicionar link]
- Trecho: `00:00–00:00`

## Status

Concluída.
