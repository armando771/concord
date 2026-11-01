# 0021. Criar o app mobile em `mobile/` com Expo, Expo Router e Zustand

- Status: proposto
- Data: 2026-10-27

## Contexto

A Salinha só existe no desktop (Electron) e na web. Queremos um app Android com o
produto completo (chat, amigos, kanban/propostas, perfil, níveis; voz depois), com
a cara do app mobile do Discord.

Forças: o app é grande demais para um PR só (precisa de specs em fatias); a UI
do desktop é DOM + Tailwind e não roda em React Native; o `frontend/` não pode
regredir; a lógica pura (`lib/`) e o cliente REST/WS são TypeScript quase puro;
há tempo real (WebSocket) e o Android derruba sockets em segundo plano; push
precisa de credencial FCM; distribuição é por APK próprio, sem loja.

## Opções consideradas

1. **`mobile/` independente (Expo + Expo Router + Zustand), lógica pura
   portada por cópia adaptada.** Prós: zero risco para o desktop, PRs pequenos,
   mesmo padrão de estado do repo (Zustand por responsabilidade, `fetch`
   próprio). Contras: duplica um pouco de lógica pura (menções, formatação,
   permissões).
2. **Pacote compartilhado (`packages/core`) em workspace.** Prós: sem
   duplicação. Contras: obriga a refatorar o desktop e a sair do Yarn 1 antes de
   entregar qualquer tela do app; PR grande e arriscado.
3. **React Navigation (rotas em código) em vez de Expo Router.** Prós: mais
   controle de deep link e de restauração de estado. Contras: mais configuração
   sem ganho claro na primeira versão. Expo Router é a camada de arquivos sobre
   o React Navigation, então migrar depois é possível.
4. **TanStack Query para dados do servidor.** Prós: cache e refetch prontos.
   Contras: dependência a mais e um jeito de buscar dados diferente do desktop;
   no React Native exige ligar `onlineManager`/`focusManager` à mão.

## Decisão

Opção 1, com Expo Router e Zustand. O padrão do repo vence o empate: a mesma
estrutura por feature (`api/ components/ hooks/ lib/ store/`) em
`mobile/src/features/`, rotas finas em `mobile/app/`. A lógica pura é portada
por cópia adaptada, com os testes. Se a duplicação doer, extrair um pacote
compartilhado das partes que de fato repetiram, num novo ADR que substitui este.

Dependências novas (regra 7): `expo`, `expo-router`, `expo-secure-store`,
`expo-constants`, `expo-linking`, `expo-status-bar`, `expo-splash-screen`,
`expo-font`, `@expo/vector-icons`, `expo-notifications` (spec do chat),
`@react-native-community/netinfo`, `react-native-gesture-handler`,
`react-native-reanimated`, `react-native-worklets`, `react-native-screens`,
`react-native-safe-area-context`, `zustand`; de desenvolvimento: `jest`,
`jest-expo`, `@react-native/jest-preset`, `@testing-library/react-native`. Tokens e refresh token ficam no
`expo-secure-store` (Keystore do Android), nunca em `AsyncStorage`.

## Consequências

- Mais fácil: entregar o app em fatias independentes; testar a lógica no Jest
  sem emulador; o desktop não muda.
- Mais difícil: duas cópias de `authRefresh`/`wsReconnect` e afins para manter
  em sincronia até existir pacote compartilhado.
- Depois: `scripts/crap.mjs`, `check-structure.mjs` e `affected-tests.mjs`
  passam a cobrir `mobile/`; o `package id` Android e o keystore ficam fixos
  desde a Fundação (trocar quebra as atualizações e as credenciais do FCM);
  o push (Expo Push + FCM V1) ganha ADR próprio na spec do chat; a voz
  (LiveKit) exige development build e vira spec própria.

## Fontes

- [Nesting tabs and drawers with Expo](https://expo.dev/blog/nesting-tabs-and-drawers-with-expo)
- [React Navigation: from Expo Router](https://reactnavigation.org/docs/from-expo-router)
- [TanStack Query no React Native](https://tanstack.com/query/v3/docs/framework/react/react-native)
- [Expo: configurar push notifications](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Expo: credenciais gerenciadas](https://docs.expo.dev/app-signing/managed-credentials/)
