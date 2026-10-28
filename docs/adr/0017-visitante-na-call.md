# 0017. Convidar visitante para uma call com acesso escopado ao canal de voz, sem virar membro

- Status: aceito
- Data: 2026-10-28

## Contexto

A issue #347 pede que quem está numa call de canal de voz convide alguém de
fora do servidor, por um link, só para aquela call: a pessoa entra direto, não
vê chats nem outros canais, ajusta o volume de cada um e assiste às
transmissões; quem gera o link escolhe por quanto tempo (2 h, 6 h, 12 h ou 1
dia) e o que mais ela pode (falar, câmera, tela). Se um moderador a mover, o
canal novo passa a valer; se ela sair, volta pelo mesmo link enquanto o prazo
durar.

Forças:

- **Hoje todo acesso é de membro.** O token de acesso abre todas as rotas e o
  WebSocket; as permissões do canal saem do snapshot de cargos, que só conhece
  membros. Um visitante não pode cair em nada disso por acidente.
- **A chamada já tem uma fonte de permissão única** (`requireConnect`,
  `GrantFor`, revalidação) e o LiveKit já recebe o grant por participante.
- `call_participants.user_id` referencia `users`: quem entra na chamada
  precisa de um usuário.
- O visitante sem conta tem que entrar pelo app web, sem instalar nada.
- Sem dependência nova; não engordar `call/service.go` nem as god stores.

## Opções consideradas

1. **Membro temporário, como o "temporary membership" do Discord.** O link
   entra no servidor e a pessoa é expulsa ao desconectar (sem cargo). Prós:
   nada novo no cálculo de permissões. Contras: é exatamente o que o dono não
   quer (a pessoa veria canais e chats enquanto está lá; o @everyone decide o
   que ela vê) e não tem prazo.
2. **Token escopado à sala, como nos links de convidado de Jitsi/JaaS e nos
   tokens do LiveKit** (o token diz a sala e o que pode publicar). Um token de
   tipo próprio que só abre a call, e um acesso no banco que diz qual canal e
   até quando. Prós: o servidor recusa tudo por padrão (lista do que abre, não
   do que fecha); o prazo vira a validade do token; o grant do LiveKit já sai
   por participante. Contras: precisa de um usuário efêmero para o visitante
   sem conta e de um ponto em que a chamada pergunte "é visitante?".
3. **Sessão de convidado sem usuário (só no LiveKit).** O visitante falaria
   direto com o LiveKit, fora do backend. Contras: some da lista da call, do
   mover e do expulsar; o estado da call deixa de ser a fonte da verdade.

## Decisão

Opção 2, no padrão de domínio do repo (`internal/guest`, ligado em
`cmd/wire_guests.go`):

- **Link:** token aleatório de 256 bits (base64url); no banco só o SHA-256
  (`call_guest_invites`). Vale até `expires_at` (o prazo escolhido) ou até ser
  revogado; até 10 pessoas por link.
- **Acesso:** `call_guest_passes` (quem entrou, por qual link, em qual canal
  agora). O prazo do acesso é o do link. Um índice em memória responde às
  consultas da chamada; o banco recarrega o índice na subida.
- **Visitante sem conta:** usuário efêmero (`users.is_guest`, @
  `visitante-<hex>` que o cadastro não aceita, senha inválida), fora da busca e
  dos pedidos de amizade, apagado uma hora depois do fim do acesso. A sessão é
  um JWT de tipo `guest` com validade = fim do acesso. O `AuthMiddleware`
  recusa esse tipo com **403** `guest_forbidden` (não 401, para o app não
  tentar renovar); só as rotas da call (`MemberOrGuestMiddleware`: entrar,
  estado, token da mídia, miniatura da tela) e o WebSocket o aceitam. As salas
  do WebSocket já exigem ser membro/participante: o visitante só entra na do
  próprio usuário e na `call:` em que está.
- **Visitante com conta:** entra com a própria conta, sem virar membro (membro
  é mandado para o canal; banido do servidor não entra).
- **Na chamada:** `call.Service` ganhou um `GuestAccess` (interface pequena
  declarada em `call/guest.go`). Quem não é membro e tem acesso ao canal recebe
  `VIEW_CHANNEL | CONNECT` + o que o convite deu (`SPEAK`, `STREAM`) em
  `requireConnect`, no grant do LiveKit e na revalidação (mudar cargos não tira
  o visitante). Mover um visitante troca o canal permitido. O selo vem em
  `UserInfo.guest_of` (servidor de que a pessoa é visitante).
- **O que o visitante não faz:** um filtro na frente do roteador de call do
  WebSocket (`guest.CallGate`) recusa trancar a sala, aceitar quem bate, abrir
  atividade e tocar a mesa de áudio de quem está numa call como visitante.
  Chat, canais e o resto já são recusados pelas regras de membro.
- **Fim do acesso:** a cada 30 s o sweep encerra os vencidos; revogar o link
  e expulsar encerram na hora. Encerrar grava o fim, tira das calls do
  servidor (LiveKit + chamada) e manda `guest:ended` ao visitante.
- **Permissão de cargo:** "Convidar visitantes" (`INVITE_GUESTS`, bit 25),
  por canal, **fora do @everyone** (Criar convite vem ligado para todos e
  trazer gente de fora para a call é mais sensível). Dono e Administrador
  sempre podem. Gerenciar (listar, revogar, expulsar): Convidar visitantes ou
  Desconectar membros no canal.
- **Câmera e tela juntas:** o app trata câmera e tela como uma permissão só
  (`STREAM`, "Transmitir"); o modal oferece "Falar" e "Câmera e tela" em vez de
  três opções.
- **Front:** feature `features/guests`. O link abre `/visitante/<token>` (fora
  do `RequireAuth`): prévia, nome (ou "Entrar como …") e a tela do visitante,
  que reaproveita o palco da call (`CallStage`) com controles próprios e um
  painel de volume por pessoa. No desktop, clicar num link de visitante dentro
  do app abre a mesma tela; não há protocolo `salinha://` próprio (o visitante
  sem conta usa o navegador).

## Modelo de ameaça (resumo)

| Ameaça | Mitigação |
|---|---|
| Adivinhar links | 256 bits; prévia (60/10 min) e entrada (10/10 min) limitadas por IP; formato conferido antes do banco. |
| Vazamento do banco expõe links | Só o hash do token fica salvo. |
| Visitante sair do escopo (chat, outros canais, DMs, perfis) | Token `guest` recusado em toda rota fora da call (lista do que abre); WebSocket só nas salas próprias; a chamada só aceita o canal do acesso. |
| Visitante criar coisas ou moderar | Sem permissões de membro; `CallGate` recusa trancar/aceitar/atividade/mesa de áudio; não gera convites (exige ser membro). |
| Link vazado continua valendo | Prazo máximo de 1 dia, revogação a qualquer momento, limite de 10 pessoas; revogar e expulsar tiram da mídia na hora. |
| Banido entrar como visitante | Conta banida não entra; visitante sem conta expulso não volta pelo mesmo acesso (para barrar o link, revogue). |
| Nome para se passar por alguém | 2–32 caracteres, sem controle nem caracteres invisíveis/de direção; selo "Visitante" na call e na lista do canal. |

## Consequências

- Fica fácil: outros escopos de convidado (ex.: só assistir) são outro conjunto
  de bits no convite; a chamada não muda.
- O visitante sem conta não carrega avatares (a mídia exige token de mídia de
  conta) e vê as iniciais.
- O app do visitante sem conta faz, ao conectar o WebSocket, três leituras de
  conta que o servidor recusa com 403 (conversas, nível, notificações): sem
  efeito, mas aparecem no console.
- Sala trancada continua exigindo que alguém de dentro aceite (o visitante vê
  a mensagem de sala trancada).
- Fica para depois: deep link `salinha://visitante/…` no desktop e avatar para
  o visitante sem conta.

## Fontes

- Discord, "Temporary membership" nos convites (expulsa ao desconectar sem
  cargo): https://support.discord.com/hc/en-us/community/posts/360049778293-Ability-for-Temporary-Server-Joining
- 8x8 JaaS, "The Jitsi JSON Web Token (JWT)" (token por sala, moderador no
  token): https://developer.8x8.com/jaas/docs/api-keys-jwt
- LiveKit, "Tokens & grants" (`room`, `canPublish`, `canPublishSources`,
  `canSubscribe`): https://docs.livekit.io/frontends/reference/tokens-grants/
