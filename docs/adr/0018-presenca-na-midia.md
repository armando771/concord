# 0018. Quem está na call segue a sala de mídia (LiveKit), não só o WebSocket

- Status: aceito
- Data: 2026-10-28

## Contexto

Issue #374: o backend decide "está na call" pela conexão do WebSocket mais a
tolerância de queda (`disconnectGrace`, 15 s). Quando o app reabre
(atualização, crash, reinício) e reconecta o WS dentro do prazo, mas não volta
à call (retomada cancelada, falhou ou nem existia), nada tira a pessoa: ela
fica na lista, com mudo e LIVE, sem estar na mídia. Vale para qualquer queda
em que o WS volta e a call não.

Forças:

- A mídia vai direto para o LiveKit; o backend só sabe da sala pela API de
  administração (`ListParticipants`), que ele já usa para o badge de câmera.
- Queda curta de quem continua na call não pode fazer a pessoa piscar/sair
  (o LiveKit aguenta a reconexão da mídia sozinho).
- Pode haver mais de um aparelho da mesma pessoa aberto; o LiveKit só aceita
  uma conexão por identidade, então a sala é o árbitro.
- Clientes antigos (sem nada novo) e travados também precisam ser cobertos.
- Sem dependência nova; não engordar `call/service.go`.

## Opções consideradas

1. **Webhook do LiveKit (`participant_left`).** Exato e imediato, mas exige
   configurar o webhook no LiveKit da VPS e do PC de casa, e evento perdido
   (backend reiniciando no deploy) vira fantasma para sempre. Descartada.
2. **Só o aviso do cliente** (`call:presence {call_id|null}` a cada conexão).
   Resolve o caso normal em segundos, mas não cobre clientes antigos nem
   travados, e um "não estou" de outro aparelho tiraria quem está na call.
3. **Conciliação periódica com a sala do LiveKit** (padrão de "reconcile loop"
   de controladores: compara o estado desejado com o real a cada intervalo)
   **mais o aviso do cliente como atalho.** Escolhida.

## Decisão

`internal/call/media_presence.go` (`MediaPresence`):

- **Varredura** a cada 20 s: para cada call ativa, lista a sala do LiveKit.
  Quem faltou em **duas conferências seguidas** sai da call pelo caminho normal
  de saída (o mesmo da queda do WS: `call:left`, LIVE desligado, listas do
  servidor; sala trancada deixa voltar sem bater). Quem acabou de aparecer na
  call tem 30 s para conectar à mídia. LiveKit sem resposta: ninguém sai. Sala
  desconhecida pelo LiveKit: ninguém está nela.
- **Aviso do app**: a cada conexão do WS (e quando muda), o app manda
  `call:presence {call_id}` ou `{call_id: null}`. O null só sai depois que a
  retomada da atualização decidiu (voltou, desistiu ou não havia). Com null, o
  servidor confere a sala na hora e tira quem não está nela (exceto quem entrou
  há menos de 30 s: outro aparelho conectando); se a sessão antiga ainda
  aparece na sala (crash, o LiveKit demora a soltar), a primeira ausência na
  varredura já tira. O aviso roda na fila do WS de quem mandou, então uma
  entrada logo depois não é desfeita.
- O bot de música entra no LiveKit como `bot-music:<canal>` e não é
  participante da call: não é afetado. Visitantes entram com o próprio id e
  seguem a mesma regra.

Pior caso: ~1 min (o LiveKit solta a sessão de um crash + duas varreduras);
caso normal do app novo: segundos.

## Consequências

- Uma chamada `ListParticipants` por call ativa a cada 20 s (local, barata).
- Quem fica na call sem conseguir conectar à mídia (firewall) sai dela depois
  de ~1 min, em vez de aparecer como presente sem estar.
- Fontes: LiveKit Server API (RoomService `ListParticipants`), docs de
  webhooks do LiveKit; o padrão de reconciliação dos controladores do
  Kubernetes.
