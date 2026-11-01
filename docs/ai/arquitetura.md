# Arquitetura e estrutura de pastas

A base é um **monólito modular** (backend) e um **front organizado por feature**.
`node scripts/check-structure.mjs` confere a estrutura de pastas em todo PR
(etapa `pr` do `affected-tests`). Decisões que fogem disto precisam de ADR
([docs/adr/](../adr/README.md)).

## Backend (`backend/`)

```
cmd/                        raiz de composição: main.go orquestra; wire_<área>.go monta
                            uma área e registra as rotas dela; router.go = middlewares
internal/<domínio>/         auth, call, channel, message, server, user, ...
  model.go                  tipos do domínio
  repository.go             SQL (pgx); nada de regra de negócio
  service.go                regra de negócio; depende de interfaces pequenas
  handler.go                HTTP: valida entrada, chama o service, traduz erros
  routes.go                 registra as rotas do domínio
  <assunto>.go              cada responsabilidade extra num arquivo próprio
                            (ex.: call/screen_draw.go, message/poll_service.go)
internal/platform/<infra>/  o que não é domínio: database, websocket, livekit,
                            media, mailer, ratelimit, httplog, clientip, health,
                            lifecycle
tools/                      ferramentas de desenvolvimento (ex.: tools/crap)
migrations/                 golang-migrate, NNNNNN_nome.up/down.sql
```

Regras:

- Dependência só para dentro: `handler → service → repository → banco`.
- Domínio não importa domínio por tipo concreto quando dá para evitar: declare
  uma **interface pequena no pacote que consome** (`type CallLookup interface{...}`).
- Infra nova vai em `internal/platform/`, nunca solta em `internal/`.
- Um domínio novo é ligado em `cmd/` num `wire_<área>.go` (ou no da área dele),
  que monta e registra as rotas. Não engorde o `main.go`.

## Frontend (`frontend/src/`)

```
main/                       processo main do Electron, por responsabilidade:
  index.ts                  entrada
  activity/ app/ overlay/ perf/ screen/ server/ updates/ window/
preload/                    ponte window.api (contextBridge)
renderer/src/
  main.tsx                  entrada do app
  app/                      casca: App, router, AppShell, bridges globais
  features/<domínio>/       auth, call, chat, friends, servers, profile, levels,
                            music, proposals, notifications, settings, updates,
                            activity, overlay
    components/             UI do domínio (.tsx)
    hooks/                  useAlgo.ts
    store/                  Zustand, um store por responsabilidade
    lib/                    lógica pura e testável (sem React)
    api/                    cliente REST do domínio
    pages/                  rotas
  shared/                   o que não pertence a um domínio
    ui/                     Button, Modal, Input, icons, skeleton...
    lib/ hooks/ store/      utilitários genéricos (retry, platform, toast...)
    api/                    client.ts (REST + refresh de token), ws.ts
  assets/                   CSS, tokens (@theme em main.css), imagens
  overlay/                  entrada da janela de overlay
```

Regras:

- Arquivo novo vai na feature dele. Se servir a duas features, ou ele é de uma
  delas (importe de lá) ou é genérico de verdade (vai para `shared/`).
- `shared/` não importa de `features/`.
- Lógica em `lib/` (pura, testada). Componente não faz `fetch` nem regra de
  negócio: usa hook/store.
- Teste fica ao lado do arquivo testado (`x.ts` + `x.test.ts`).

### Ruim × bom: onde colocar

| Arquivo | ❌ Ruim | ✅ Bom |
|---|---|---|
| regra de quem pode fixar mensagem | `shared/lib/utils.ts` | `features/chat/lib/pinPermissions.ts` |
| hook de volume do Maestro | `features/call/hooks/useMusicVolume.ts` | `features/music/hooks/useMusicVolume.ts` |
| botão genérico com ícone | `features/chat/components/IconButton.tsx` | `shared/ui/IconButton.tsx` |
| novo store de "modo foco" | campo novo no `callStore.ts` (god) | `features/call/store/focusModeStore.ts` |
| detector de jogo novo (main) | `src/main/steamDeckDetector.ts` | `src/main/activity/steamDeckDetector.ts` |
| cache de convites (Go) | `internal/inviteCache.go` | `internal/server/invite_cache.go` |
| cliente S3 (Go) | `internal/s3/` | `internal/platform/s3/` |

## Mobile (`mobile/`)

App Android em Expo, independente do `frontend/` ([ADR 0021](../adr/0021-app-mobile-expo.md)).

```
mobile/
  app/                      rotas finas do Expo Router: só montam telas de src/
    _layout.tsx             providers, ErrorBoundary, guarda de sessão
    (auth)/ (app)/(tabs)/   grupos de rotas por estado de sessão
  src/
    features/<domínio>/     components/ hooks/ store/ lib/ api/ (mesmas camadas do desktop)
    shared/                 ui/ lib/ hooks/ store/ api/ theme/ (não importa de features/)
  app.config.ts eas.json jest.config.js
```

Regras: as do front do desktop (lógica em `lib/`, teste ao lado, `shared/` não
importa de `features/`). O `check-structure.mjs` confere `mobile/src`. O que
precisa de `features/` em `shared/` entra por uma porta (ex.: `shared/api/session.ts`,
ligada por `features/auth` no boot).

## Escolhendo a arquitetura de uma feature

Em `/ideia` e `/feature`, antes de planejar:

1. **Descreva o problema em forças**: o que muda junto, o que precisa escalar,
   o que precisa ser testável isolado, consistência × latência, tempo real?
2. **Pesquise 2–3 padrões na internet** que resolvem esse tipo de problema (ex.:
   máquina de estados para fluxo de chamada, strategy/registry para comandos do
   bot, outbox para eventos que não podem se perder, CQRS leve para leitura
   pesada, compound components no React). Prefira fontes primárias (docs
   oficiais, artigos de quem mantém a ferramenta, livros de referência).
3. **Compare com o que o repo já faz.** O padrão do repo vence empate:
   consistência vale mais que elegância local.
4. **Escolha o mais simples que resolve as forças** (YAGNI) e registre num ADR
   curto em `docs/adr/NNNN-titulo.md` ([modelo](../adr/README.md)), com as
   alternativas descartadas e as fontes.
5. Feature que só segue o padrão existente não precisa de ADR. Basta dizer isso
   no plano.
