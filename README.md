<!-- FILE: README.md -->
# Impacto Web Prospect Assistant

Extensão Chromium (Manifest V3) que auxilia o time comercial da **Impacto Web** a transformar listas de leads exportadas (CSV/JSON) em **mensagens de prospecção personalizadas**, com fluxo manual de cópia + abertura do WhatsApp.

> **Não envia nada automaticamente.** O envio é sempre feito por um humano, colando a mensagem no WhatsApp.

## Fluxo principal

## Recursos

- **Importação robusta** de `.csv` e `.json` com detecção automática de separador (`,` `;` `\t` `|`), suporte a BOM, aspas, acentos e quebras de linha dentro de campos.
- **Sistema de aliases** de colunas (`Nome`/`empresa`/`name`, `Avaliações`/`reviews`, etc.).
- **Motor de personalização 100% local** baseado em regras + templates editáveis. Nenhuma chamada de rede.
- **4 tons de copy**: Curta, Profissional, Curiosidade, Direta. Dois canais: WhatsApp e Instagram DM.
- **Modo prévia pronta** (quando a prévia do site já foi preparada pelo time).
- **Persistência em IndexedDB** — os dados sobrevivem ao fechamento do navegador.
- **Deduplicação inteligente** por `place_id` → URL do Maps → telefone → nome+endereço. Nunca sobrescreve mensagem editada, status, observação ou follow-up.
- **Paginação** (50/página) e renderização por lotes para suportar milhares de leads.
- **Status comercial** + **status de mensagem** + **observação interna** + **follow-up**.
- **Backup e restore** completos em JSON.

## Instalação

1. Baixe/clone o diretório da extensão.
2. Abra `chrome://extensions` (ou `edge://extensions`, `brave://extensions`).
3. Ative **Modo desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e selecione a pasta da extensão.
5. Clique no ícone da extensão → **Abrir Painel Completo** (ou acesse o dashboard em uma aba).

### Ícones (opcional)

Nenhum ícone está referenciado no `manifest.json`, o que permite a instalação imediata sem assets binários. Se quiser um ícone personalizado, crie `icons/16.png`, `icons/48.png`, `icons/128.png` e adicione ao `manifest.json`:

```json
"icons": { "16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png" },
"action": {
  "default_title": "Impacto Web Prospect Assistant",
  "default_popup": "popup.html",
  "default_icon": { "16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png" }
}

```

Compatível com **Chrome 102+**, **Edge**, **Brave**. `minimum_chrome_version` já está declarado.

## 5. Testes sugeridos

| # | Teste | Resultado esperado |
|---|---|---|
| 1 | Importar CSV 100 leads | Toast "100 leads importados" |
| 2 | Importar JSON 100 leads | Toast "100 leads importados" |
| 3 | Importar 5.000 leads | Importação conclui (lotes de 50 em IndexedDB) |
| 4 | Lead sem nome | Mensagem começa em "Olá, tudo bem?" |
| 5 | Lead com nota + avaliações, sem site | Observação cita "X avaliações e nota Y" |
| 6 | Lead só com Instagram, sem site | Observação cita Instagram |
| 7 | Lead só com WhatsApp, sem site | Observação cita WhatsApp |
| 8 | Lead com ≥200 avaliações | Observação cita "mais de N avaliações" |
| 9 | Lead com nota ≥4.5 | Observação cita a nota |
| 10 | Telefone `(11) 91234-5678` | `Abrir WhatsApp` gera `https://wa.me/5511912345678` |
| 11 | Telefone `+1 415 555 2671` | `Abrir WhatsApp` gera `https://wa.me/14155552671` |
| 12 | Marcar como "copiada" | Badge verde "Copiada" na tabela |
| 13 | Duplicado por `place_id` | Lead atualizado sem perder mensagem/status |
| 14 | Gerar todas (filtradas) com 800 leads | Toast progressivo "Gerando... N de 800" |
| 15 | Fechar aba e reabrir dashboard | Todos os leads e mensagens persistem |
| 16 | Copiar + Abrir WhatsApp | Mensagem no clipboard + aba `wa.me` aberta |
| 17 | Botão `Restaurar padrão` (templates) | Volta aos templates originais |
| 18 | Exportar backup → limpar banco → importar backup | Dados 100% restaurados |
| 19 | CSV com `;` e vírgula em campo entre aspas | Importa corretamente |
| 20 | CSV com BOM (Excel) | Cabeçalho `\uFEFF` é ignorado |

## 6. Limitações explícitas

- **Sem envio automático**: a extensão não simula cliques no WhatsApp, não dispara mensagens em massa e não contorna limites do WhatsApp.
- **Sem IA externa na v1**: a personalização é baseada em regras e templates. A função `generateMessageWithTemplates` já retorna `Promise`-compatível (síncrona, mas pode ser trocada por versão assíncrona sem impacto no restante do código).
- **CSV com `\n` dentro de campo sem aspas** é ambíguo — comportamento padrão da RFC 4180 respeitado.
- **Sem ícones inclusos** (instruções para adicionar estão no README).
- **Deduplicação não cobre alterações de telefone**: se a empresa trocar de telefone e não tiver `place_id`/`maps`, poderá gerar duplicata (cenário raro e contornável editando o lead original).
- **Sem sincronização entre dispositivos** — por design (100% local, privacidade por padrão).

## 7. Observações finais

- **Nenhum `eval`, `new Function` ou CDN** é utilizado. `innerHTML` só recebe dados do usuário após `escapeHtml()`.
- **Manifest V3**, CSP padrão (`script-src 'self'; object-src 'self'`), permissões mínimas (`storage`).
- **Anti-spam**: botão `Abrir WhatsApp` apenas abre `wa.me/<número>` sem pré-preenchimento. A decisão de enviar é sempre humana.
- **Privacidade**: 100% local, sem chamadas de rede.
- Para suportar **IA opcional no futuro**, basta alterar `generateMessageWithTemplates()` para retornar `Promise<string>` — os pontos de uso já fazem `await`/`then` quando necessário.