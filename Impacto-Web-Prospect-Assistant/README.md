# Impacto Web Prospect Assistant 2.0

Extensao Chromium Manifest V3 para encontrar potenciais clientes dentro da audiencia de perfis famosos, identificar dores digitais e gerar abordagens comerciais personalizadas para a Impacto Web.

## Principais recursos

- Mineracao de uma amostra dos seguidores visiveis de uma conta-semente.
- Analise aprofundada dos seguidores selecionados; a conta famosa nao vira lead.
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

A extensao solicita acesso apenas a `https://www.instagram.com/*`. Informe o `@` de um famoso, influenciador ou perfil de referencia. A extensao abre a lista de seguidores visivel, coleta uma amostra configuravel, seleciona perfis distribuidos ao longo dessa lista e analisa os sinais publicos de cada seguidor.

A conta-semente serve apenas como origem. Ela nao e adicionada ao funil.

O Instagram normalmente exige que o usuario esteja conectado no navegador para abrir a lista de seguidores. A extensao nao automatiza login, nao usa endpoints privados e nao contorna bloqueios. A quantidade coletada pode variar por carregamento, privacidade e limites da plataforma.

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
npm run dev
```

Os testes cobrem qualificacao, leitura de dados do Instagram, geracao de mensagens, importacao e exportacao segura de CSV.
