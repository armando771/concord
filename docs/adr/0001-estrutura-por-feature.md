# 0001. Organizar o código por feature e infraestrutura em platform/

- Status: aceito
- Data: 2026-10-26

## Contexto

O renderer estava organizado por camada técnica: `lib/` com 280 arquivos
soltos, `store/` com 87, `components/` com 68 no topo e algumas subpastas por
domínio. Uma feature (ex.: voice mod) ficava espalhada em `lib/voiceMod*.ts`,
`store/voiceModStore.ts` e `components/call/VoiceModPanel.tsx`. O processo main
do Electron tinha 70 arquivos soltos. No backend, os domínios já seguiam
`model/repository/service/handler/routes`, mas pacotes de infraestrutura
(`database`, `websocket`, `livekit`...) ficavam misturados com eles e o
`cmd/main.go` tinha um `main()` de ~470 linhas montando tudo.

Agentes de IA (e pessoas) decidem onde criar arquivos olhando a estrutura
existente. Uma pasta plana com 280 arquivos não ensina nada, e o resultado é mais
arquivo solto e mais god file.

## Opções consideradas

1. **Manter por camada** (`components/`, `store/`, `lib/`): nenhum custo de
   migração, mas não escala e é o que gerou o problema.
2. **Feature-Sliced Design completo** (app/processes/pages/widgets/features/
   entities/shared): bem definido, mas com camadas demais para o tamanho do app e
   regras de import rígidas que exigiriam reescrever muito código.
3. **Por feature, no estilo bulletproof-react**: `app/`, `features/<domínio>/`
   com as camadas dentro, `shared/` para o genérico. Migração mecânica (mover e
   reescrever imports) e fácil de explicar.

No backend: manter `internal/<domínio>` (já é monólito modular) e separar a
infraestrutura em `internal/platform/`.

## Decisão

Opção 3 no frontend e `internal/platform/` no backend. O `cmd/` foi dividido por
área (`wire_<área>.go`, cada uma registra as próprias rotas), com a mesma ordem
de montagem de antes. A estrutura é verificada por `scripts/check-structure.mjs`.
A migração foi feita de uma vez, só com movimentação e reescrita de imports
(typecheck, os 2533 testes do front, build web/Electron e testes Go passando).

## Consequências

- Cada feature tem um lugar óbvio; arquivo novo solto é barrado pelo check.
- Branches abertas antes da migração vão ter conflito de caminho: rebase e mova
  os arquivos novos para a pasta da feature.
- Imports entre features continuam permitidos (ex.: call usa chat). Restringir
  isso fica para um ADR futuro, se virar problema.

## Fontes

- bulletproof-react, project structure: https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
- Feature-Sliced Design: https://feature-sliced.design/
- Go, organizing a Go module: https://go.dev/doc/modules/layout
