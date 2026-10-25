# Buff de XP por quantidade de pessoas na call de voz

## Objetivo

Quanto mais pessoas elegíveis numa call de voz, maior o multiplicador de XP de
voz de todos que estão ganhando XP nela. O buff precisa ser indicado na UI do
chat de voz, com animação.

## Regra

Conta só quem está elegível (call ativa, sem mute, sem surdo, com mais alguém
ouvindo — `call.eligibleVoiceUsers`).

Os degraus seguem o ranking de estilo de Devil May Cry (só homenagem em texto
e letra; sem fonte, logo ou arte do jogo).

| Elegíveis | Multiplicador | Rank | Texto |
|-----------|---------------|------|-------|
| 0–3       | x1.0 (sem buff) | — | — |
| 4–5       | x1.25 | A   | Alright! |
| 6–7       | x1.5  | S   | Sweet! |
| 8–9       | x1.75 | SS  | Showtime! |
| 10+       | x2.0 (teto) | SSS | Smokin' Sexy Style! |

Implementação em inteiros: `boostPercent(eligible int) int` devolve 100, 125,
150, 175 ou 200. O XP é calculado em centésimos: `minutes * XPPerMinute * percent`
 mais o resto carregado do usuário; credita-se `total / 100` e guarda-se
 `total % 100` (a fração não se perde: 12,5 vira 12 e 13 em minutos alternados,
 e a média paga bate com o rótulo). O resto é descartado quando a pessoa deixa
 de ser elegível.
O multiplicador vale no instante em que o minuto fecha (sem média retroativa).

## Backend (`backend/internal/level`)

- `boost.go`: `boostPercent` (função pura).
- `accrue`/`tick`: agrupa `ActiveVoiceUsers()` por `CallID`; o número de
  usuários elegíveis distintos da call define o percentual de cada `grant`
  (novo campo `percent`).
- `give`: aplica o percentual ao XP.
- Evento `voice:boost` via `BroadcastToCall` com payload
  `{call_id, percent, eligible}`. Enviado a cada tick (10 s) enquanto a call
  está com buff (heartbeat: quem entra depois recebe o estado no tick
  seguinte, sem estado por usuário) e uma última vez com `percent: 100` quando
  o buff acaba ou a call some (estado `lastBoost map[callID]int` guarda as
  calls com buff). Calls sem buff nunca recebem o evento.
- O cliente descarta o buff de uma call se ficar 25 s sem heartbeat.
- `level:update` e `level:up` não mudam.

## Frontend (`frontend/src/renderer/src`)

- Store (`boostStore` ou campo em `levelStore`): `percent` e `eligible` da call
  atual, alimentado pelo evento `voice:boost`; zera ao sair da call.
- Helper em `lib/levels.ts`: `boostRank(percent)` devolve rank, texto, rótulo
  (`x1.25`) e a paleta/intensidade do degrau.
- Componente `StyleRank` (letra do rank + texto + badge de multiplicador),
  reutilizado em `VoiceXPBar` e no cabeçalho de `VoiceChannelView`. Só aparece
  de A para cima. Apagado em cinza quando "XP pausado (mutado)".
- Visual: letra grande em itálico pesado com contorno estilo grafite/stencil;
  cores A vermelho escuro, S vermelho vivo, SS laranja/dourado, SSS dourado
  brilhante.
- Banner de ativação (substitui o toast simples): faixa angular com corte
  diagonal, letra gigante e texto, ex.: "S — Sweet! · XP x1.5 · 6 pessoas".

### Escalada de animação (qualidade proporcional à grandeza)

| Rank | Entrada (ao ativar/subir) | Contínua |
|------|---------------------------|----------|
| A   | Letra entra com slam curto (scale + leve tremida), banner rápido (~1,2 s) | Shimmer suave na barra de XP |
| S   | Slam mais forte, tremida maior, texto "Sweet!" em itálico com swipe, flash vermelho de borda | Shimmer mais rápido, pulso do badge |
| SS  | Slam com onda de choque (anel expansivo), faíscas/partículas, banner maior (~2 s) | Brilho laranja/dourado pulsante, partículas sutis subindo da barra |
| SSS | Entrada cinematográfica: flash de tela dourado, slam com tremida na view inteira, letras rachando/glitch, partículas e raios, banner de ~2,5 s | Aura dourada pulsante no cabeçalho da view, glitch periódico na letra, faíscas contínuas na barra |

- Tudo em CSS/SVG (transform e opacity, sem libs novas) para não pesar; as
  partículas são poucos elementos animados por keyframes.
- Quem está mutado/surdo não ganha o buff, então o banner de ativação não
  toca para essa pessoa (o badge cinza continua). Descer de rank não dispara
  banner; só atualiza o visual. Se o buff acaba,
  a letra sai com fade curto.
- `prefers-reduced-motion` desliga slam, tremida, flash, partículas, glitch e
  pulso; mantém só o badge estático e o banner sem movimento.

## Testes

- Go: tabela de degraus de `boostPercent`; `accrue` com várias calls e
  mutados/surdos que não contam; XP creditado multiplicado; `voice:boost`
  emitido a cada tick enquanto há buff (batimento, antes das gravações de XP)
  e uma vez com `percent: 100` no fim; resto fracionário de XP carregado por
  usuário.
- Frontend: store e `boostRank` (rank/texto/rótulo por percentual); banner só
  dispara ao ativar ou subir de rank e o buff zera ao sair da call.

## Fora de escopo

Texto de buff em perfil/ranking, migração de banco (nada é persistido),
buff por servidor ou por cargo.
