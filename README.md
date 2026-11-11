# Impacto Web Prospect Assistant 2.0

Extensao Chromium Manifest V3 para encontrar potenciais clientes dentro da audiencia de perfis famosos, identificar dores digitais e gerar abordagens comerciais personalizadas para a Impacto Web.

## Principais recursos

- Triagem economica de ate 10 mil seguidores visiveis de uma conta-semente.
- Salvamento incremental em lotes de 100 registros para reduzir uso de memoria.
- Analise aprofundada configuravel, processada em uma unica aba temporaria por vez.
- Pausa e cancelamento com preservacao dos dados ja salvos.
- Priorizacao de sinais comerciais, extremos e amostra distribuida; a conta famosa nao vira lead.
- Qualificacao explicavel de 1 a 5.
- Identificacao de dor, oportunidade e proximo passo.
- Nove estrategias de mensagem, incluindo dor especifica, consultiva, oportunidade, autoridade, follow-up e reativacao.
- Tres variacoes de mensagem por lead.
- Importacao CSV/JSON e exportacao CSV/JSON.
- Funil comercial, observacoes e follow-up.
- Persistencia local em IndexedDB.
- Backup e restauracao completos.

## Instalacao

1. Extraia o arquivo ZIP.
2. Abra `chrome://extensions`, `edge://extensions` ou `brave://extensions`.
3. Ative o modo desenvolvedor.
4. Clique em **Carregar sem compactacao**.
5. Selecione a pasta extraida.
6. Abra a extensao e clique em **Abrir dashboard completa**.

## Mineracao de audiencia no Instagram

A extensao solicita acesso apenas a `https://www.instagram.com/*`. Informe o `@` de um famoso, influenciador ou perfil de referencia. A extensao abre a lista de seguidores visivel e pode fazer triagem local de ate 10 mil perfis. Em seguida, aprofunda somente a quantidade escolhida, um perfil por vez.

O fluxo recomendado para computadores com ate 16 GB de RAM e:

1. selecionar a quantidade total para triagem;
2. aprofundar uma parcela menor, por exemplo 50 de 500 ou 100 de 10 mil;
3. filtrar por nota e por nivel de analise antes da abordagem;
4. aumentar a profundidade em uma nova execucao apenas quando necessario.

Os perfis de triagem recebem menor confianca e ficam identificados como **Triagem leve**. Perfis visitados individualmente ficam identificados como **Analise profunda**.

A conta-semente serve apenas como origem. Ela nao e adicionada ao funil.

O Instagram normalmente exige que o usuario esteja conectado no navegador para abrir a lista de seguidores. A extensao nao automatiza login, nao usa endpoints privados e nao contorna bloqueios. A quantidade coletada pode variar por carregamento, privacidade e limites da plataforma. Coletas grandes podem levar varios minutos; aprofundar milhares de perfis pode levar horas e sofrer limitacao da plataforma.

A dashboard e responsiva, mas a execucao da extensao depende de um navegador Chromium que aceite extensoes. O Chrome padrao do Android nao permite instalar extensoes.

O score considera:

- necessidade digital;
- tracao e prova social;
- facilidade de contato;
- aderencia aos servicos da Impacto Web;
- maturidade da operacao digital atual.

O modelo nao garante fechamento. Ele organiza prioridades comerciais com base nos dados disponiveis.

## Privacidade

- Sem servidor proprio.
- Sem API externa de IA.
- Sem envio automatico de mensagens.
- Leads, mensagens e configuracoes permanecem no navegador.

## Desenvolvimento

```bash
npm test
npm run check
npm run smoke
npm run layout
npm run dev
```

Os testes cobrem qualificacao, escala de 10 mil, processamento economico, leitura de dados do Instagram, geracao de mensagens, importacao, exportacao segura de CSV, botoes da dashboard/popup e responsividade.
