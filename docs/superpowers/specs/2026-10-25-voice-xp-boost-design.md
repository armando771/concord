# Buff de XP por quantidade de pessoas na call de voz

## Objetivo

Quanto mais pessoas elegíveis numa call de voz, maior o multiplicador de XP de
voz de todos que estão ganhando XP nela. O buff precisa ser indicado na UI do
chat de voz, com animação.

## Regra

Conta só quem está elegível (call ativa, sem mute, sem surdo, com mais alguém
ouvindo — `call.eligibleVoiceUsers`).

| Elegíveis | Multiplicador |
|-----------|---------------|
| 0–3       | x1.0 (sem buff) |
| 4         | x1.25 |
| 5         | x1.5  |
| 6         | x1.75 |
| 7+        | x2.0 (teto) |

Implementação em inteiros: `boostPercent(eligible int) int` devolve 100, 125,
150, 175 ou 200. O XP creditado é `minutes * XPPerMinute * percent / 100`.
O multiplicador vale no instante em que o minuto fecha (sem média retroativa).

## Backend (`backend/internal/level`)

- `boost.go`: `boostPercent` (função pura).
- `accrue`/`tick`: agrupa `ActiveVoiceUsers()` por `CallID`; o número de
  usuários elegíveis distintos da call define o percentual de cada `grant`
  (novo campo `percent`).
- `give`: aplica o percentual ao XP.
- Evento `voice:boost` via `BroadcastToCall` com payload
  `{call_id, percent, eligible}`. Enviado só quando o percentual da call muda
  (estado `lastBoost map[callID]int` no service), inclusive a volta para 100
  (fim do buff). Calls que deixam de existir são removidas do mapa.
- Quem entra numa call com buff já ativo recebe o estado atual no tick
  seguinte (reenvio por usuário novo na call via `SendToUser`).
- `level:update` e `level:up` não mudam.

## Frontend (`frontend/src/renderer/src`)

- Store (`boostStore` ou campo em `levelStore`): `percent` e `eligible` da call
  atual, alimentado pelo evento `voice:boost`; zera ao sair da call.
- Helper em `lib/levels.ts`: rótulo (`x1.25`) e degrau visual (cor/intensidade)
  a partir do percentual.
- `VoiceXPBar`: badge "⚡ XP x1.25" quando percent > 100; barra com shimmer
  animado enquanto o buff está ativo; apagado quando "XP pausado (mutado)".
- `VoiceChannelView`: mesmo badge no cabeçalho.
- Ao ativar ou subir de degrau: pulso único no badge e toast curto
  ("Buff de XP x1.5 ativado — 5 pessoas na call").
- `prefers-reduced-motion` desliga shimmer e pulso.

## Testes

- Go: tabela de degraus de `boostPercent`; `accrue` com várias calls e
  mutados/surdos que não contam; XP creditado multiplicado; `voice:boost`
  emitido só na mudança de degrau e no fim do buff.
- Frontend: store e helper de rótulo/degrau.

## Fora de escopo

Texto de buff em perfil/ranking, migração de banco (nada é persistido),
buff por servidor ou por cargo.
