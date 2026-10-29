# 0016. Dar nível ao servidor pelo que acontece nele, com teto diário por pessoa e só contas reais

- Status: aceito
- Data: 2026-10-28

## Contexto

Issue #371: hoje só a pessoa tem nível. O servidor passa a ter um, que sobe
com o uso dele (membros novos, mensagens, figurinhas, sons, tempo em call,
lives e quem assiste) e nunca pelo nível de quem entrou. Forças:

- **Anti-farm**: o XP de usuário e os badges já têm regras (conta real = e-mail
  confirmado, sem prazo de idade, ver 000170; mensagem repetida em < 1 h não conta; apagada
  em ≤ 2 min desconta; AFK de 10 min; "mais alguém ouvindo"). Duplicá-las
  geraria divergência.
- **Uma pessoa não pode explodir o nível** de um servidor sozinha.
- **Tempo real**: aviso discreto de subida para quem está online, sem chat.
- **Retroativo**: o servidor já nasce com o que o histórico mostra, sem
  avisos falsos de subida.

## Opções consideradas

1. **Recalcular sob demanda** (`COUNT` sobre mensagens, figurinhas etc. a cada
   leitura). Sem estado novo, mas tempo de call não tem histórico, o teto
   diário fica caro de calcular e a subida de nível não tem quando ser avisada.
2. **Tudo em Go por eventos** (hooks em mensagem, figurinha, som, entrada).
   Precisaria reimplementar em Go a assinatura de repetição das mensagens, que
   hoje é SQL (000113) e depende dos anexos ligados depois do INSERT.
3. **Seguir o padrão do repo (badge/level)**: o que o banco já vê é contado
   por trigger, reaproveitando as funções do badge Mensagens
   (`badge_message_repeats`); o tempo de call é somado em memória sobre as
   fotos sem AFK (`call.AFK.CallSnapshots`, as mesmas do XP e dos badges) e
   gravado a cada minuto. Toda soma passa por uma função só,
   `server_level_add`, que aplica conta real e teto diário.

## Decisão

Opção 3, num pacote novo `internal/serverlevel` (fora de `internal/level`).

| Fonte (`source`) | Como conta | XP | Teto por pessoa/dia |
|---|---|---|---|
| `membros` | membro conta real, uma vez por pessoa por servidor (sair e voltar não dá de novo; quem vira conta real depois conta então). Varredura a cada 5 min | 50 | 50 |
| `mensagens` | mensagem em canal do servidor, regras do badge Mensagens; bot e sistema não contam | 2 | 100 |
| `figurinhas` | figurinha enviada ao servidor; apagada em até 24 h desconta | 10 | 50 |
| `sons` | som enviado à mesa de áudio; apagado em até 24 h desconta | 10 | 50 |
| `voz` | minuto em call de servidor elegível ao XP de voz (sem mute/surdo, mais alguém ouvindo, sem AFK) | 1/min | 120 |
| `live` | minuto transmitindo com mais alguém ouvindo, sem AFK (Streamer) | 1/min | 60 |
| `espectador` | minuto assistindo à live de outra pessoa sem estar surdo, sem AFK (Espectador) | 1/min | 60 |
| `presenca` | call cheia: com 3+ contas reais ouvindo e sem AFK, cada uma rende 1/min (Festeiro) | 1/min | 60 |

- **Todas as fontes só contam contas reais** (não bot, e-mail confirmado,
  conta com 7+ dias), checado no banco em toda soma e, para a call cheia, no
  cache de contas reais do badge (`badge.RealAccountCache`, exportado para
  isso). Conta fake não soma nem completa a call cheia.
- **Teto diário** por pessoa, servidor e fonte (dia de Brasília, tabela
  `server_level_daily`, que também dá o detalhamento dos últimos 7 dias).
  Máximo de uma pessoa por dia num servidor: 500 XP.
- **Nível dos membros não soma nada**: membro parado não gera XP.
- **Curva própria**: passar do nível L custa 250·L² (nível 2 = 250, 5 = 7.500,
  10 = 71.250, 20 = 617.500). Um servidor de 5 pessoas ativas (~800 XP/dia)
  chega ao 5 em ~10 dias e ao 10 em ~3 meses.
- **Persistência**: `server_levels (xp, level, updated_at)`; `level` é o último
  nível visto e anunciado. A cada minuto o backend grava o tempo de call e
  relê os servidores que mudaram (5 min de janela); subiu → `server:level:up`
  na sala `server:<id>` (o app mostra um toast); mudou o XP →
  `server:level:update`. O retroativo grava `level = NULL`, que o backend
  acerta em silêncio.
- **Retroativo** (migration 000150): membros reais atuais, mensagens que
  ainda existem sem as repetições seguidas, figurinhas e sons atuais, com o
  mesmo teto no dia em que aconteceram. Tempo em call e live começa do zero.
- **Exibição**: nível e barra no menu do nome do servidor (com um chip "Nv."
  no cabeçalho) e detalhamento num modal aberto pelo menu (qualquer membro) e
  na aba "Nível" das configurações. Sem selo no ícone do rail: ele já mostra
  menções e não-lidos, e um número a mais polui o ícone de 48 px.

## Consequências

- As regras de anti-spam de mensagem continuam num lugar só (SQL do badge).
- Descontar só mexe em linhas que existem (UPDATE): apagar servidor ou
  usuário em cascata não quebra. Desconto num dia diferente do envio (enviada
  23:59, apagada 00:01) não desconta; e apagar algo que tinha batido no teto
  desconta mesmo assim (a favor do anti-farm).
- Quem ainda não confirmou o e-mail não faz o servidor subir até confirmar;
  o XP de membro novo vem quando confirmar.
- O prazo da conta real caiu de 7 dias para 24 horas (migration 000165) e depois
  foi removido (000170): conta real é quem confirmou o e-mail. Com 7 dias o
  Salinha, novo, não tinha nenhuma conta real e o nível ficava em 0. Sem
  retroativo: o XP que ficou de fora não volta, a regra nova vale daqui para a frente.
- Até 1 min de tempo de call pode se perder num desligamento que não grave a
  tempo (o desligamento espera, como os badges).

## Fontes

- MEE6 / Discord Server Boost levels (curva quadrática e níveis de servidor): https://wiki.mee6.xyz/plugins/levels
- PostgreSQL, constraint triggers adiados: https://www.postgresql.org/docs/current/sql-createtrigger.html
- Padrão do repo: `internal/level` (curva e XP de voz), `internal/badge`
  (tracker e contas reais), ADR 0010 (AFK).
