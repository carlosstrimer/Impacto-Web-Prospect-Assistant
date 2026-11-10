# Relatorio de QA

## Resumo

Os testes automatizados de qualificacao, amostragem, importacao, exportacao e mensagens passaram. A coleta real depende de uma sessao autenticada do Instagram e permanece como validacao manual.

## Ambiente testado

- Data: 2026-11-09
- Versao: 2.0.0
- Runtime: Node.js, extensao Manifest V3

## Casos executados

- 16 testes automatizados aprovados.
- Smoke test de navegador aprovado em 45 verificacoes de controles e fluxos com o lead de exemplo.
- Sintaxe JavaScript aprovada por `npm run check`.
- Responsividade aprovada em 360, 390, 430, 768, 820, 1024, 1280, 1440 e 1920 px, sem overflow da pagina.
- Conta-semente excluida da amostra.
- Amostra distribuida validada com dez candidatos.
- Perfil privado mantido como analisavel.
- CSV protegido contra formulas.
- Mensagens pela dor sem placeholders pendentes.
- Botoes de abas, filtros, importacao, exportacao, mensagens, painel, funil, templates, configuracoes, backup e acoes em lote exercitados no Chrome headless.

## Nao executado e motivo

- Coleta real da lista de seguidores: exige login do usuario no Instagram e pode sofrer limitacao da plataforma.
- Envio de mensagens: nao faz parte do produto.

