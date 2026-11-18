# Design e lições aprendidas

## Problema

Conferir manualmente, todos os dias, o Facebook e o Instagram dos mercados da cidade para descobrir se saiu promoção. Os mercados divulgam **folhetos em imagem** nas redes sociais, e quem lê é uma família num grupo de WhatsApp.

## Metas

- Detectar post novo de promoção em poucos minutos e enviá-lo ao WhatsApp.
- **Custo zero** (MVP): sem APIs pagas, sem servidor.
- Poucos parâmetros para outra pessoa reutilizar (fontes, destino, legenda).

## Não-metas

- Ler preços/produtos dos encartes (OCR), filtrar por produto, painel web, stories e reels.

## Anti-metas (o que seria falha mesmo "funcionando")

- Reenviar o mesmo folheto.
- Inundar o grupo com posts antigos ao ligar uma fonte nova.
- Usar a conta pessoal do usuário nas redes sociais.

## Alternativas consideradas

| Opção | Por que sim / não |
|---|---|
| **A. Tudo local (escolhida)** | Grátis, a sessão do WhatsApp persiste, fácil de depurar. Exige o PC ligado. |
| B. Nuvem gratuita (ex.: GitHub Actions) | WhatsApp Web não mantém login em ambiente efêmero, e as redes bloqueiam IPs de nuvem com mais frequência. |
| C. Serviços de RSS de terceiros | Limites do plano grátis e o Instagram costuma quebrar nesses serviços. |

## Arquitetura

`agendador → Playwright (Chrome headless, sem login) → pipeline (detecta novos) → Baileys (WhatsApp)`

- `pipeline.mjs` concentra as regras (o que enviar, baseline, legenda) como **funções puras testadas**.
- Fontes são plugáveis: cada leitor devolve itens `{id, sourceId, code, source, channel, url, image, date}`.
- O estado (`data/state.json`) guarda os ids já vistos e quais fontes já tiveram o baseline registrado.

## Lições aprendidas

1. **Sem API oficial, o navegador automatizado é o caminho** — e páginas públicas do Facebook e do Instagram são legíveis sem login (com um pop-up de login por cima, que não atrapalha a leitura).
2. **Miniatura ≠ imagem.** O `og:image` do Instagram vem cortado ao centro; o folheto inteiro está na maior `<img>` da página do post.
3. **Link exato do post no Facebook:** a página da foto embute o `"post_id"` do post de origem; com ele se monta `/<pagina>/posts/<id>`.
4. **Baseline por fonte.** Sem ele, ligar uma fonte nova despeja o histórico inteiro no grupo.
5. **Sessão do WhatsApp é frágil na escrita.** Encerrar o processo logo após o pareamento corta a gravação das credenciais e deixa `creds.json` vazio: aguarde alguns segundos antes de sair.
6. **QR do WhatsApp expira em ~20 s.** O código de pareamento (`PAIR_PHONE`) é bem mais tolerante.
7. **Teste no ambiente real.** O navegador instalado em um ambiente isolado não existe no agendador do sistema; usar o Google Chrome já instalado (`channel: "chrome"`) elimina a dependência de um download extra.
8. **Logar conta pessoal em navegador automatizado não é viável** — o Instagram não deixou o login concluir, e há risco para a conta. Perfis com restrição de idade ficam fora do escopo.
9. **Falha isolada por fonte:** um perfil que falha não derruba as demais.

## Próximos passos possíveis

- Filtros por palavra-chave ("picanha", "oferta") na legenda.
- OCR/visão para extrair preços e montar um resumo.
- Reels e carrosséis (enviar todas as imagens).
- Servidor sempre ligado (VM gratuita) com o mesmo código.
