# Relatorio de Seguranca

## Resumo

O fluxo usa somente dados publicos visiveis no Instagram e armazena os resultados localmente. Nao foram adicionados backend, credenciais, APIs privadas ou envio automatico.
O scanner oficial analisou o projeto e nao encontrou possiveis segredos.

## Escopo testado

- Permissoes do Manifest V3.
- Tratamento de dados vindos do DOM.
- Escape de HTML na dashboard.
- Neutralizacao de formulas em CSV.
- Ausencia de automacao de login e mensagens.

## Falhas criticas

Nenhuma identificada.

## Falhas altas

Nenhuma identificada.

## Falhas medias

Nenhuma identificada.

## Falhas baixas

- O DOM do Instagram pode mudar e interromper a coleta sem aviso previo.
- Consultas extensas podem acionar limites da plataforma.

## Riscos restantes

- O usuario deve respeitar as regras da plataforma e a legislacao aplicavel ao uso comercial de dados publicos.
- Os scores sao heuristicas de priorizacao, nao garantia de interesse ou fechamento.

