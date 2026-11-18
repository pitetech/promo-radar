# 🛒 promo-radar

**Monitora páginas públicas de Facebook e Instagram de supermercados e casas de carne e manda os folhetos de promoção, assim que são postados, para um grupo de WhatsApp.**

> 🇬🇧 *English summary:* a small Node.js automation that watches **public** Facebook/Instagram pages of local supermarkets, detects new promo flyers, and forwards the image (with the post link) to a WhatsApp group or number. Everything is free (no paid APIs), runs on your own machine, and is fully configurable through `config.json`. See [English notes](#-english-notes) at the end.

Nasceu de uma dor real: conferir, todo dia, o perfil de cada mercado da cidade para descobrir se saiu promoção. Agora o robô confere a cada 20 minutos e avisa a família.

```
 ┌───────────────┐   ┌────────────────┐   ┌──────────────────┐   ┌──────────────┐
 │ Facebook /    │──▶│ Playwright     │──▶│ Detecta posts    │──▶│ WhatsApp     │
 │ Instagram     │   │ (Chrome        │   │ novos (state.json│   │ (Baileys)    │
 │ páginas       │   │  headless)     │   │  evita repetir)  │   │ imagem+link  │
 │ públicas      │   │ sem login      │   │                  │   │              │
 └───────────────┘   └────────────────┘   └──────────────────┘   └──────────────┘
        ▲                                                               │
        └──────────── agendador (Windows Task Scheduler / cron) ◀───────┘
                              a cada 20 min
```

## ✨ O que ele faz

- Lê o perfil/página de cada fonte **sem login** (só conteúdo público).
- Descobre o **link exato do post** e baixa a **imagem em tamanho completo** do folheto.
- Só envia o que é **novo**: guarda o que já foi enviado e, ao adicionar uma fonte nova, apenas registra os posts antigos (sem inundar o grupo).
- Posts do Facebook com várias fotos saem juntos, com **um único link**.
- Legenda configurável (`{source}`, `{channel}`, `{date}`, `{url}`).
- Modo `--dry-run` para testar sem enviar nada nem alterar o estado.
- 100% gratuito: Playwright + Baileys, sem APIs pagas.

## ⚙️ Requisitos

| Item | Detalhe |
|---|---|
| Node.js | 20 ou superior |
| Google Chrome | instalado na máquina (ou use o Chromium do Playwright, veja abaixo) |
| WhatsApp | um número para ser o **remetente** (de preferência um chip secundário, veja [Riscos](#-riscos-e-limites)) |
| PC ligado | o robô roda na sua máquina; sem o PC ligado, a checagem espera e retoma depois |

## 🚀 Instalação

```bash
git clone https://github.com/pitetechai/promo-radar.git
cd promo-radar
npm install
cp config.example.json config.json     # Windows: copy config.example.json config.json
```

> Sem Google Chrome? Rode `npx playwright install chromium` e coloque `"browser": { "channel": null }` no `config.json`.

## 🔧 Configuração (`config.json`)

Todos os parâmetros ficam abertos para você ajustar. O arquivo `config.json` **não vai para o Git** (ele tem o seu número/grupo).

```jsonc
{
  "destination": "5511999999999",          // número com DDI+DDD, ou id de grupo "1203...@g.us"
  "timezone": "America/Sao_Paulo",        // fuso usado para formatar as datas
  "browser": { "channel": "chrome",       // "chrome" = Chrome instalado | null = Chromium do Playwright
               "locale": "pt-BR" },
  "postsPerSource": { "facebook": 6,      // quantos posts recentes ler por fonte a cada execução
                      "instagram": 4 },
  "caption": {                            // texto enviado junto da imagem
    "first": "🛒 {source} · {channel}\n{date}\n{url}",
    "continuation": "🛒 {source} (continuação)"   // fotos extras do mesmo post
  },
  "sources": [
    { "id": "mercado-fb", "name": "Mercado Exemplo", "type": "facebook",  "url": "https://www.facebook.com/mercadoexemplo" },
    { "id": "mercado-ig", "name": "Mercado Exemplo", "type": "instagram", "url": "https://www.instagram.com/mercadoexemplo/" }
  ]
}
```

| Campo | Obrigatório | Descrição |
|---|---|---|
| `destination` | sim (para enviar) | Número (`5511999999999`) ou id de grupo. Para achar o id do grupo, veja o passo 3 abaixo. |
| `sources[].id` | sim | Identificador único (letras, números, `-`, `_`). Vira o prefixo dos ids no estado. |
| `sources[].name` | não | Nome que aparece na legenda. |
| `sources[].type` | sim | `facebook` ou `instagram`. |
| `sources[].url` | sim | Endereço `https://` da página/perfil **público**. |
| `postsPerSource` | não | Mais posts = leitura mais lenta. |
| `caption` | não | Modelos de legenda com os marcadores `{source}`, `{channel}`, `{date}`, `{url}`. |
| `dataDir` | não | Pasta de dados (padrão `data/`). |

Variáveis de ambiente: `PROMO_CONFIG` (caminho de outro config), `PAIR_PHONE` (usa código de pareamento em vez de QR), `WA_LOG` (nível de log do Baileys, ex. `debug`).

## ▶️ Como usar (passo a passo)

**1. Teste a leitura das páginas** (não envia nada):

```bash
npm run collect
```

Você deve ver a lista de posts de cada fonte, com data, link e a legenda que seria enviada.

**2. Pareie o WhatsApp** (uma vez só). O número que parear será o **remetente**:

```bash
npm run pair
```

Escaneie o QR no WhatsApp do celular (*Aparelhos conectados → Conectar um aparelho*). Se o QR expirar antes de você escanear, use o **código de pareamento**: informe o número do remetente e digite o código de 8 caracteres em *Conectar com número de telefone*:

```bash
# Linux/macOS
PAIR_PHONE=5511999999999 npm run pair
# Windows (PowerShell)
$env:PAIR_PHONE='5511999999999'; npm run pair
```

> Aguarde a mensagem `Session saved.` antes de fechar. A sessão fica em `data/wa-auth/` (**trate como uma senha**).

**3. Descubra o id do grupo** (o remetente precisa estar no grupo):

```bash
npm run find-group -- "parte do nome do grupo" --save
```

Isso lista os grupos que combinam com o nome e, com `--save`, grava o id em `config.json`.

**4. Valide com o seu próprio número** antes de apontar para o grupo: coloque seu número em `destination` e rode

```bash
npm run send-latest
```

Ele envia o post mais recente de cada fonte. Se chegou certinho, volte o `destination` para o grupo.

**5. Rode de verdade:**

```bash
npm start            # envia só o que é novo
npm run dry-run      # mostra o que enviaria, sem enviar nem gravar estado
```

A **primeira execução de cada fonte só registra** os posts existentes (baseline), para o grupo não receber posts antigos. Dali em diante, só chega o que é novo.

**6. Agende para rodar sozinho:**

- **Windows:** `powershell -ExecutionPolicy Bypass -File scripts\schedule-windows.ps1 -Minutes 20`
  (cria a tarefa `PromoRadar`; para remover: `schtasks /Delete /TN PromoRadar /F`). A tarefa roda enquanto você estiver com a sessão do Windows aberta.
- **Linux/macOS:** `crontab -e` e adicione `*/20 * * * * /caminho/promo-radar/scripts/run.sh`

O histórico das execuções agendadas fica em `data/run.log`.

## 🧰 Comandos

| Comando | O que faz |
|---|---|
| `npm start` (`run`) | Envia só os posts novos desde a última execução. |
| `npm run dry-run` | Igual ao `run`, mas sem enviar e sem alterar o estado. |
| `npm run collect` | Só lê e mostra o que cada fonte retorna. |
| `npm run pair` | Vincula o número do WhatsApp (QR ou `PAIR_PHONE`). |
| `npm run find-group -- "nome" [--save]` | Lista grupos pelo nome; `--save` grava o id. |
| `npm run send-latest` | Envia o post mais recente de cada fonte. |
| `node src/cli.mjs send-post id:codigo …` | Envia posts específicos do Instagram (ex.: `mercado-ig:Df234ARl8m_`). |
| `npm test` | Roda os testes unitários. |

## 🗂️ Estrutura

```
src/
  cli.mjs            entrada: interpreta comando e flags
  commands.mjs       os comandos (run, collect, pair, find-group, send-*)
  config.mjs         carrega/valida config.json e o estado (state.json)
  pipeline.mjs       lógica pura: o que enviar, baseline, legenda  ← testada
  collect.mjs        abre o navegador e lê todas as fontes
  sources/
    facebook.mjs     leitor de páginas públicas do Facebook
    instagram.mjs    leitor de perfis públicos do Instagram
  deliver.mjs        baixa a imagem e envia (um link por post)
  whatsapp.mjs       sessão e envio via Baileys
scripts/             agendamento (Windows / cron)
test/                testes unitários (node:test)
```

## 🧠 Decisões de projeto

- **Por que não usar as APIs oficiais?** A API do Instagram/Facebook só lê contas *suas*. Para perfis de terceiros não há API gratuita, então o robô lê as páginas públicas com um navegador automatizado.
- **Por que enviar a imagem em vez de ler o preço (OCR)?** Os encartes são imagens, e interpretá-las exige OCR/visão (custo e erros). Repassar a imagem original resolve a dor da família, é gratuito e não erra preço.
- **Imagem completa:** o `og:image` do Instagram é uma miniatura cortada ao centro; o robô usa a maior imagem da página do post (1080×1350).
- **Link exato do post (Facebook):** o HTML da página da foto traz o `post_id` do post de origem, e o permalink é montado a partir dele.
- **Baseline por fonte:** evita inundar o grupo ao ligar uma fonte nova.
- **Falhas isoladas:** se uma fonte falhar, ela é registrada no log e as demais continuam.
- **Lógica pura testada:** `pipeline.mjs` não faz I/O, então as regras de "o que enviar" têm testes automatizados.

## ⚠️ Riscos e limites

- **WhatsApp não oficial.** O Baileys usa o protocolo do WhatsApp Web. Existe risco de o número ser **bloqueado**; use um **chip secundário** e poucos envios. Não use para spam.
- **Perfis que exigem login** (restrição de idade, bebidas alcoólicas etc.) **não são lidos**. Tentar logar a conta pessoal em navegador automatizado não funcionou e pode levar a bloqueio.
- **Layouts mudam.** Se o Facebook/Instagram mudarem o HTML, a leitura pode falhar; o erro aparece em `data/run.log`.
- **Reels e stories** não são enviados; em posts do Instagram com várias imagens, só a primeira.
- **Termos de uso.** Raspar páginas pode contrariar os termos das plataformas. Este projeto é **educacional**, lê apenas conteúdo público, em baixa frequência e para uso pessoal. Use por sua conta e risco, respeite os termos e a privacidade dos outros.
- **Segredos:** `data/` (sessão do WhatsApp) e `config.json` estão no `.gitignore`. **Nunca** os publique.

## 🛠️ Solução de problemas

| Sintoma | Causa provável / o que fazer |
|---|---|
| `Executable doesn't exist ... chrome` | Instale o Google Chrome ou use `"channel": null` + `npx playwright install chromium`. |
| `No WhatsApp session` | Rode `npm run pair`. |
| `Logged out` | O WhatsApp desconectou o aparelho; rode `npm run pair` de novo. |
| `creds.json` vazio / `Unexpected end of JSON` | O programa foi encerrado durante o pareamento. Apague `data/wa-auth/` e pareie de novo, esperando `Session saved.` |
| Fonte não retorna posts | Perfil privado/restrito, @ errado, ou o layout mudou. Teste com `npm run collect`. |
| Nada chega no grupo | Confirme `destination` (`npm run find-group`), se o remetente está no grupo e veja `data/run.log`. |
| Chegou tudo de uma vez ao adicionar fonte | Não deveria: a 1ª leitura só registra. Verifique se o `id` da fonte é único. |

## 🇬🇧 English notes

**What it does:** reads *public* Facebook/Instagram pages (Playwright + Chrome, no login), detects new posts, downloads the full-size flyer image, and sends it with the exact post link to WhatsApp (Baileys). State is kept in `data/state.json` so nothing is sent twice; adding a new source only registers its existing posts.

**Quick start**

```bash
git clone https://github.com/pitetechai/promo-radar.git && cd promo-radar
npm install
cp config.example.json config.json   # edit sources + destination
npm run collect                      # read-only test
npm run pair                         # link the WhatsApp sender (QR or PAIR_PHONE)
npm run find-group -- "group name" --save
npm start                            # send only what is new (--dry-run to preview)
```

**Notes:** unofficial WhatsApp protocol (ban risk — use a secondary number), login-only profiles are unsupported, scraping may violate platform terms — educational, personal use only.

## 📄 Licença

[MIT](LICENSE)
