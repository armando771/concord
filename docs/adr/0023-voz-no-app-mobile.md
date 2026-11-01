# 0023. Voz no app mobile com o SDK do LiveKit, atrás de uma porta `CallMedia`

- Status: proposto
- Data: 2026-10-28

## Contexto

O app Android ([ADR 0021](0021-app-mobile-expo.md)) precisa de canais de voz e chamadas de DM. A mídia vai
direto para o LiveKit; o backend só emite o token (`POST /calls/:id/token`) e mantém o estado pelos eventos
`call:*`. O desktop já separa as duas coisas: `lib/livekit.ts` (`CallMedia`) fala com o SDK e o `callStore`
guarda o estado. A presença na call segue a sala de mídia ([ADR 0018](0018-presenca-na-midia.md)).

Forças:

- LiveKit não roda no Expo Go: exige build de desenvolvimento (já temos) e módulo nativo (WebRTC).
- Teste no Jest não pode depender do módulo nativo.
- Sem dependência nova sem ADR (este).
- `call/service.go` é god service: nada de método novo nele.

## Opções consideradas

1. **Componentes e hooks do `@livekit/react-native`** (`LiveKitRoom`, `useParticipants`). Menos código no
   começo, mas o estado fica nos componentes, amarra as telas ao SDK, dificulta o Jest e não casa com os
   eventos `call:*` do nosso backend. Descartada.
2. **Fork `expo-livekit`.** Menos configuração nativa, mas é terceiro fora do LiveKit oficial e pode ficar
   para trás do Expo SDK 58. Descartada.
3. **Porta `CallMedia` + stores pequenas, com `livekit-client` por baixo** (padrão do desktop). Escolhida.

## Decisão

- Dependências (todas oficiais do LiveKit ou do ecossistema Expo/WebRTC): `livekit-client`,
  `@livekit/react-native`, `@livekit/react-native-webrtc`, `@livekit/react-native-expo-plugin` e
  `@config-plugins/react-native-webrtc`. `registerGlobals()` uma vez, no topo de `app/_layout.tsx`.
- Interface `CallMedia` em `mobile/src/features/call/lib/callMedia.ts`; só `livekitMedia.ts` importa o SDK
  e fica fora da cobertura. O resto é testado com uma mídia falsa.
- Estado em stores pequenas (sessão, participantes, falantes, chamada recebida); `voiceControlsStore`
  continua dono de mudo e fone.
- Primeira entrega só com áudio: permissões `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `FOREGROUND_SERVICE` e
  `FOREGROUND_SERVICE_MICROPHONE`. Câmera e `mediaProjection` ficam para outra decisão.
- O app envia `call:presence` como o desktop (ADR 0018).
- Chamada de DM com o app fechado: push comum pelo FCM ([ADR 0022](0022-push-direto-pelo-fcm.md)).

## Consequências

- O APK cresce com o WebRTC nativo; o build de desenvolvimento precisa ser refeito uma vez.
- A mídia só se prova no aparelho: o Jest cobre a lógica, não o áudio.
- Dá para trocar o SDK mexendo em um arquivo (`livekitMedia.ts`).
- Riscos a confirmar no aparelho: tipo `microphone` do serviço em primeiro plano, Bluetooth e interrupções
  de áudio, eco no alto-falante.

Fontes: documentação do LiveKit para Expo e React Native
(`docs.livekit.io/transport/sdk-platforms/expo.md`) e o repositório `livekit/client-sdk-react-native`.
