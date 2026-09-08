# Relatório Final — Manutenção Preventiva do Swiftline

**Disciplina:** Manutenção e Integração de Software  
**Sistema:** Swiftline  
**Equipe:** Dayane Rodrigues, Victória Caroline Alves e Lucas Marinho  
**Professor:** Andrey Rodrigues

## 1. Situação encontrada

Durante a análise do Swiftline, encontramos a mesma regra de permissão em quatro pontos diferentes do sistema. No servidor, essa regra aparecia nas ações de excluir uma publicação, editar um comentário e excluir um comentário. Na tela, havia outra verificação para decidir quando os botões **Editar** e **Excluir** deveriam aparecer.

Em todos esses pontos, a decisão era baseada na mesma ideia: somente o autor poderia realizar a ação. Apesar de representarem a mesma regra, as verificações estavam escritas de maneira separada. Dessa forma, uma alteração feita em um ponto não modificava as outras partes.

O sistema não apresentava um erro de funcionamento. O problema estava na dificuldade que essa organização poderia causar durante uma mudança futura.

## 2. Mudança futura considerada

Consideramos a futura criação do papel de moderador. O moderador seria uma pessoa responsável por acompanhar os conteúdos publicados e excluir posts ou comentários que desrespeitassem as regras da plataforma. Esse usuário poderia excluir conteúdos de outras pessoas, mas não poderia editar os comentários delas, preservando a autoria do que foi publicado.

Na organização anterior, essa mudança exigiria a revisão dos quatro pontos encontrados. Se algum deles fosse esquecido, partes do sistema poderiam seguir permissões diferentes. Por exemplo, o moderador poderia conseguir excluir um comentário, mas não uma publicação, ou a tela poderia mostrar também o botão **Editar**, mesmo que essa ação não fosse permitida.

O moderador não foi criado neste trabalho. Ele foi utilizado apenas como referência para demonstrar a dificuldade que poderia surgir futuramente.

## 3. Justificativa da intervenção

Decidimos realizar a intervenção porque a repetição da regra aumentava a quantidade de lugares que precisariam ser revisados durante uma mudança.

A proposta foi preparar o sistema antes da criação do moderador, reduzindo o risco de esquecimentos e de diferenças entre as permissões aplicadas no servidor e os botões apresentados na tela.

A solução está relacionada ao conceito de **ocultamento de informação**, apresentado no capítulo 4 do livro *Fundamentos de Manutenção de Software*, de Marco Tulio Valente. Esse conceito orienta que uma decisão que pode mudar deve permanecer concentrada em um local, enquanto as outras partes do sistema apenas consultam o resultado.

## 4. Solução implementada

Criamos um local central para reunir as decisões de permissão. Esse local informa se uma pessoa pode:

- excluir uma publicação;
- editar um comentário;
- excluir um comentário.

As três ações do servidor passaram a consultar essas respostas, em vez de repetirem a comparação entre o autor e o usuário conectado.

A tela também deixou de usar uma única condição para mostrar os dois botões. Agora, ela recebe uma resposta para a edição e outra para a exclusão. Assim, será possível permitir futuramente que um moderador visualize o botão **Excluir**, sem apresentar o botão **Editar**.

Embora a organização tenha sido alterada, mantivemos o comportamento atual: somente o autor pode editar ou excluir seu próprio conteúdo.

## 5. Resultado obtido

A principal diferença entre os dois estados pode ser observada na comparação abaixo:

| Antes da intervenção | Depois da intervenção |
| --- | --- |
| A mesma regra aparecia em três ações do servidor e em um ponto da tela. | As decisões de permissão estão reunidas em um módulo central. |
| Cada ponto fazia sua própria verificação. | As ações consultam as respostas fornecidas pelo local central. |
| Os botões **Editar** e **Excluir** eram mostrados pela mesma condição. | Cada botão possui uma permissão separada. |
| A futura inclusão do moderador exigiria revisar quatro pontos. | A parte principal da mudança nas permissões ficará concentrada no local central. |

Com essa organização, a futura criação do moderador passou a ser mais simples e segura. Ainda vai ser necessário criar e identificar esse tipo de usuário, mas as decisões sobre o que ele poderá fazer estarão concentradas, diminuindo o risco de uma operação ser esquecida.

## 6. Verificação do funcionamento

Executamos o teste específico das permissões, que apresentou o seguinte resultado:

- três testes executados;
- três testes aprovados;
- nenhuma falha.

Cada teste representa uma situação diferente:

1. o autor consegue editar ou excluir o conteúdo que ele mesmo criou;
2. uma pessoa conectada não consegue editar ou excluir o conteúdo criado por outra pessoa;
3. uma pessoa que não está conectada também não recebe permissão para realizar essas ações.

Também verificamos a compilação do projeto, que foi concluída com sucesso. Isso confirma que as alterações não impediram a construção do sistema.

O segundo vídeo mostra o novo local das permissões, as consultas realizadas pelo servidor, a separação dos botões na tela e os resultados apresentados no terminal.

## 7. Evidências e links

- [Repositório do Swiftline](https://github.com/anewillow/rede_social_swiftline)
- [Diagnóstico da manutenção preventiva](https://github.com/anewillow/rede_social_swiftline/blob/main/trabalho2_manutencao_preventiva/docs/diagnostico-manutencao-preventiva.md)
- [Issue nº 7 — proposta da manutenção](https://github.com/anewillow/rede_social_swiftline/issues/7)
- [Branch da manutenção preventiva](https://github.com/anewillow/rede_social_swiftline/tree/manutencao-preventiva-permissoes)
- [Pull Request nº 8](https://github.com/anewillow/rede_social_swiftline/pull/8)
- [Lista completa de commits](https://github.com/anewillow/rede_social_swiftline/pull/8/commits)
- [Vídeo 1 — situação anterior](https://github.com/user-attachments/assets/2681f28b-af07-43ec-89d5-e8aa16a6d6f1)
- [Vídeo 2 — situação após a intervenção](https://github.com/user-attachments/assets/22b25a26-5c55-42d3-983c-c4048a1b41bf)
- [Código que reúne as permissões](https://github.com/anewillow/rede_social_swiftline/blob/76ffa4722d88f31fec5eff8fdd921a705e416d89/sistema/src/permissions.ts)
- [Testes das permissões](https://github.com/anewillow/rede_social_swiftline/blob/76ffa4722d88f31fec5eff8fdd921a705e416d89/sistema/tests/permissions.test.ts)
- [Resultados das verificações no GitHub](https://github.com/anewillow/rede_social_swiftline/pull/8/checks)

### Principais commits da intervenção

- [Centralizamos as regras de permissão](https://github.com/anewillow/rede_social_swiftline/commit/693592a9cec8b0671ca3a7f907fcce5121479534)
- [Passamos a usar as permissões no servidor](https://github.com/anewillow/rede_social_swiftline/commit/4a0c5697091686a6019ef94cf0cdc9b89cb1d8eb)
- [Passamos a controlar os botões pelas permissões](https://github.com/anewillow/rede_social_swiftline/commit/c632450e973248aedf1bd18af572a01fc79867de)

## 8. Conclusão

Concluímos que a intervenção realizada caracteriza uma **manutenção preventiva** porque identificamos antecipadamente uma dificuldade que poderia afetar uma mudança futura.

Antes que o papel de moderador precisasse ser criado, percebemos que a mesma regra de permissão estava repetida em diferentes partes do sistema. Essa organização poderia provocar esquecimentos e fazer com que cada parte apresentasse um comportamento diferente.

Por isso, reorganizamos as decisões de permissão e separamos o controle das ações de editar e excluir, sem corrigir um erro existente e sem implementar o moderador. O funcionamento atual foi preservado, enquanto a dificuldade de uma futura alteração foi reduzida.

## Referência

VALENTE, Marco Tulio. *Fundamentos de Manutenção de Software*. Capítulo 4: Código Flexível a Mudanças. Disponível em: [https://manutencaosoftware.org/cap4](https://manutencaosoftware.org/cap4).
