# Resumo dos quality gates

- Projeto: Impacto Web Prospect Assistant
- Versao: 2.0.0
- Data: 2026-11-09

| Gate | Resultado | Evidencia |
|---|---|---|
| Sintaxe JavaScript | APROVADO | `npm run check` |
| Testes unitarios | APROVADO | `npm test`: 16 aprovados, 0 falhas |
| Smoke test da dashboard | APROVADO | `npm run smoke`: 45 verificacoes aprovadas com o lead de exemplo |
| Responsividade | APROVADO | `npm run layout`: 360, 390, 430, 768, 820, 1024, 1280, 1440 e 1920 px sem overflow da pagina |
| Segredos | APROVADO | `scan-secrets.mjs`: nenhum possivel segredo encontrado |
| Coleta real autenticada | NAO EXECUTADO | Exige sessao do usuario no Instagram e pode sofrer limitacao da plataforma |
| Envio automatico | NAO APLICAVEL | O produto somente gera mensagens e abre os canais manualmente |

O runner consolidado aprovou os testes unitarios, mas falhou ao invocar o scanner por uma limitacao de aspas em caminhos do Windows com espaco. O scanner oficial foi executado diretamente e aprovado.

Resultado dos gates aplicaveis: APROVADO.
