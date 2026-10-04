# Trabalho 4 - Manutenção Evolutiva - Avaliação- Heuristica

**Equipe:** Dayane Rodrigues, Lucas Marinho e Victória Caroline Alves
**Professor:** Andrey Rodrigues

## Contexto

A análise foi baseada nas 10 heurísticas de Nielsen para identificar problemas de usabilidade e
definir as mudanças do redesign.

## Escala de gravidade

| Nota | Significado |
| ---: | --- |
| 0 | Nenhum problema encontrado. |
| 1 | Problema pequeno ou apenas visual. |
| 2 | Problema que dificulta um pouco o uso. |
| 3 | Problema que atrapalha bastante o uso. |
| 4 | Problema que impede uma tarefa. |

## Avaliação das 10 heurísticas

| Nº | Heurística e significado | Situação encontrada | Resultado | Nota |
| ---: | --- | --- | --- | ---: |
| 1 | **Visibilidade do estado:** mostrar o andamento das ações. | Publicações e mensagens eram enviadas sem aviso de espera. | Adicionamos **Publicando...** e **Enviando...**. | 3 |
| 2 | **Correspondência com o mundo real:** usar nomes conhecidos. | Termos como **Postar**, **Curtir** e **Seguir** já são claros. | Sem mudança. | 0 |
| 3 | **Controle e liberdade:** permitir voltar ou cancelar. | Já é possível cancelar edições, remover imagens e confirmar exclusões. | Sem mudança. | 0 |
| 4 | **Consistência e padrões:** manter informações parecidas no mesmo formato. | Na lista de mensagens, o nome e a bio apareciam juntos. | Separamos o nome e a bio. | 2 |
| 5 | **Prevenção de erros:** evitar o problema antes da ação. | O limite da imagem não era informado nem verificado. | Mostramos o limite de 3 MB e bloqueamos arquivos inválidos. | 2 |
| 6 | **Reconhecimento em vez de memorização:** deixar as funções fáceis de identificar. | As ferramentas da publicação apareciam apenas como ícones. | Adicionamos o nome de cada função ao passar o mouse. | 2 |
| 7 | **Flexibilidade e eficiência:** facilitar tarefas quando há muitos dados. | Mensagens mostra até 30 pessoas e não possui busca por nome. | A busca ficará para a manutenção evolutiva. | 2 |
| 8 | **Design estético e minimalista:** organizar a tela sem excessos. | As telas já mantêm o mesmo padrão de cores e organização. | Sem mudança. | 0 |
| 9 | **Reconhecimento e recuperação de erros:** explicar a falha e permitir nova tentativa. | Uma falha na publicação não era explicada com clareza. | Adicionamos a mensagem de erro e **Tentar novamente**, mantendo o texto. | 3 |
| 10 | **Ajuda e documentação:** oferecer orientação quando houver dúvida. | O sistema não possuía uma área de ajuda. | Criamos uma área com pesquisa, instruções e atalhos. | 2 |

## Evidências do redesign

Antes e depois de cada mudança estão no documento
[Evidências do redesign](./evidencias-redesign.md).

## Conclusão

A avaliação resultou em seis mudanças: avisos durante as ações, organização das
mensagens, validação de imagens, identificação dos ícones, recuperação de erros e
uma área de ajuda.
