# Arquitetura 2.0

## Fluxo

1. O usuario informa uma conta-semente, por exemplo `@renato_cariani`.
2. A extensao abre o perfil em segundo plano usando a sessao normal do navegador.
3. Um script isolado abre a lista de seguidores e coleta somente os perfis visiveis no DOM.
4. Uma amostra distribuida evita analisar apenas o inicio da lista.
5. Cada seguidor selecionado e aberto individualmente para leitura dos sinais publicos.
6. O motor local calcula score de 1 a 5, dor, oportunidade e abordagem.
7. Apenas os seguidores entram no funil. A conta-semente fica registrada como origem.

## Limites tecnicos

- O Instagram pode exigir login, alterar o DOM, virtualizar a lista ou limitar consultas.
- A extensao nao promete ler todos os seguidores de contas grandes.
- Os limites de coleta e analise sao configuraveis para reduzir bloqueios.
- Nenhum endpoint privado, token de sessao ou credencial e lido ou armazenado.

## Permissoes

- `storage`: configuracoes locais.
- `tabs`: abrir e fechar perfis em segundo plano.
- `scripting`: executar os coletores nas paginas do Instagram.
- Host: somente `https://www.instagram.com/*`.

