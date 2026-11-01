# App mobile, fatia 5: voz (PR A) — plano

Spec: [2026-10-28-app-mobile-voz-design.md](../specs/2026-10-28-app-mobile-voz-design.md) · ADR:
[0023](../../adr/0023-voz-no-app-mobile.md). Branch `feat/app-mobile-voz` (de `origin/develop`).
Cada tarefa começa por teste que falha pelo motivo certo; nada de LiveKit no Jest.

## Tarefas (PR A, tudo com mídia falsa)

1. **Dependências e config**: `livekit-client`, `@livekit/react-native`, `@livekit/react-native-webrtc` e os dois
   plugins; permissões de áudio no `app.config.ts` (sem câmera nem captura de tela). Teste: `tests/appConfig.test.ts`.
2. **Tipos e stores pequenas**: sessão, participantes, falantes, chamada recebida, aviso. Teste: `callStores.test.ts`.
3. **Regras puras**: `voiceState` (mudo local + imposto por moderador), `callErrors`, `callLayout`, `callPresence`
   (ADR 0018), `callResync`, `voiceRoster`, `callInviteTap`.
4. **Eventos `call:*`** → stores (`callEvents`), ignorando outra chamada e evento desconhecido.
5. **Porta `CallMedia` + `callController`** (entrar, ligar, atender, recusar, sair, reconexão, permissão negada,
   seguir movimento de moderador) com API/WS/mídia injetados; `livekitMedia.ts` é o único arquivo com o SDK.
6. **Hooks**: `useCallEvents`, `useCallPresence` (novo `onRealtimeOpen`), `useCallLifecycle`,
   `useIncomingCallRoute`, `useVoiceRoster`.
7. **Telas**: `ParticipantTile`, `CallScreen`, `CallBar`, `IncomingCallScreen`, `CallNotice`; rotas `chamada` e
   `chamada-recebida`; `ChannelList` entra na chamada e lista quem está no canal; `HomeScreen` com barra e aviso;
   `AccountPanel` sai da chamada antes de encerrar a sessão.
8. **Backend**: `StartDM` deixa ligar para offline com push (`SetOfflineRinger`, em `call/ring.go`), limite de toque
   de 45 s, gancho `OnDMInvite`; `push.Notifier.OnCallInvite` (canal `chamadas`); `fcm.Message.Channel`;
   `wirePushCalls`. **Mudança de comportamento do desktop** (ligar para amigo offline com o app no celular).
9. **Push no app**: canal `chamadas`, toque em `call_invite` consulta `GET /calls/active?scope=dm` e abre a tela de
   atender ou mostra "Chamada perdida de {nome}".

## PR B (fora deste PR, depois, no aparelho)

Build nativo, serviço em primeiro plano com tipo `microphone`, notificação "Em chamada em {canal}", foco de áudio,
Bluetooth, e a verificação ponta a ponta da spec.
