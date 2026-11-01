# App mobile da Salinha: roadmap e decisões

Spec-guarda-chuva. Só guarda as decisões comuns e a ordem das fatias; cada
fatia tem a sua spec e o seu PR. A primeira é a
[Fundação](2026-10-27-app-mobile-fundacao-design.md).

## Objetivo

Um app Android da Salinha com o produto completo, com a cara do app mobile do
Discord, incluindo o kanban/propostas (referência: app do ClickUp).

## Decisões (com o porquê)

| Decisão | Por quê |
|---|---|
| React Native com Expo, Android apenas | pedido do dono; iOS exigiria conta Apple (US$ 99/ano), fica para depois |
| Distribuição por APK, como o `.exe`, com build local (`expo prebuild` + Gradle); EAS Build só como alternativa | sem loja, sem revisão e sem conta Expo; o `eas build --local` não roda no Windows |
| Voz e vídeo (LiveKit) **fora** da primeira versão | LiveKit não roda no Expo Go e exige development build; vira spec própria depois |
| `mobile/` independente, lógica pura portada por cópia adaptada | não mexe no desktop; extrair pacote compartilhado só se a duplicação doer (novo ADR) |
| Expo Router + Zustand + cliente REST/WS portado | padrão do repo vence o empate ([ADR 0021](../../adr/0021-app-mobile-expo.md)) |
| Navegação em coluna única, como o app web/desktop ([ADR 0007](../../adr/0007-navegacao-mobile-uma-coluna.md)): trilho de servidores + lista de canais/DMs + painel do usuário (com mic, fone e engrenagem); tocar abre o chat com voltar. **Sem barra de abas** (decidido em 2026-10-28, substitui as 4 abas da Fundação) | é o layout que o dono quer, igual às capturas do desktop; o kanban fica dentro do servidor, ao lado dos canais |
| Push na spec do chat, via Expo Push + FCM V1 | chat sem push perde mensagem com o app fechado |
| Textos do desktop reaproveitados; só os textos novos precisam de aprovação | já foram aprovados |

## Fatias (cada uma: `/ideia` → spec → `/feature` → PR)

1. **Fundação** (esta spec detalhada): projeto Expo, tema, navegação, auth,
   sessão, WebSocket, build APK.
2. **Chat**: servidores, canais, mensagens, DMs, amigos, menções, push (backend:
   tabela de tokens de dispositivo e serviço de envio quando o usuário não está
   no WebSocket; ADR próprio).
3. **Kanban/Propostas**: quadro, cartões, comentários, votação.
4. **Perfil, níveis, cargos e configurações.**
5. **Voz e vídeo (LiveKit)**, depois da primeira versão.

Cada fatia depende da anterior. Os textos novos de cada uma passam pela
aprovação do dono antes de entrar na respectiva spec.

## Fora de escopo (do roadmap inteiro, por ora)

iOS; publicação em loja; modo tablet com layout de várias colunas (a Fundação
só garante que nada quebra em 768 px); chamadas, atividade/overlay e tudo que
depende de Electron (atalhos globais, áudio de janela, captura de tela).
