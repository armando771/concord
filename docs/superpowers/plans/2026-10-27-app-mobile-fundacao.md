# Plano: App mobile, fatia 1 (Fundação)

Spec: [2026-10-27-app-mobile-fundacao-design.md](../specs/2026-10-27-app-mobile-fundacao-design.md).
ADR: [0021](../../adr/0021-app-mobile-expo.md). Branch `feat/app-mobile`
(worktree `concord-app-mobile`). Cada tarefa: teste primeiro (falhando pelo
motivo certo) → código mínimo → verde → `node scripts/affected-tests.mjs loop`.
Código novo, então o baseline de CRAP é "nenhum arquivo existente tocado" nas
tarefas do `mobile/`; as tarefas 1 e 2 mexem em scripts existentes e medem antes.

## Commits estruturais (antes de qualquer comportamento)

### T1. Os scripts do repo passam a enxergar `mobile/`
- Medir antes: `node scripts/crap.mjs --files scripts/affected-tests.mjs scripts/lib/structure.mjs`.
- `scripts/lib/structure.mjs`: regra "nenhum arquivo solto em `mobile/src`" e
  `mobile/` como pasta de nível raiz permitida. Teste ao lado (`structure.test.mjs`).
- `scripts/lib/affected.mjs` (`classify`): arquivos `mobile/**/*.ts(x)` viram o
  grupo `mobile`; teste em `affected.test.mjs`.
- `scripts/affected-tests.mjs`: `loop` roda `npx jest --findRelatedTests` em
  `mobile/`; `checks` roda `npm run typecheck` em `mobile/`; `full` roda
  `npx jest`. `scripts/crap.mjs` lê a cobertura do Jest (lcov) de `mobile/`.
- Commit: `refactor(scripts): affected-tests, crap e estrutura cobrem mobile/`.

## Comportamento

### T2. Projeto Expo
- `mobile/` com `package.json` (Yarn 1, como o repo), `app.config.ts` (nome
  "Salinha", `android.package` fixo, `scheme`, `extra`), `tsconfig.json` (strict),
  `babel.config.js`, `jest.config.js` (preset `jest-expo`), `.gitignore`
  (`android/`, `ios/`, `.expo/`, `*.keystore`), `eas.json`.
- Dependências do ADR 0021. Teste: `config.test.ts` falha sem
  `EXPO_PUBLIC_SERVER_URL` e vira verde com `lib/config.ts`.
- `src/shared/lib/config.ts`: `API_BASE_URL` e `WS_URL` a partir de
  `EXPO_PUBLIC_SERVER_URL` (reaproveita a lógica de `serverUrl.ts` do desktop).

### T3. Lógica pura portada (com os testes do desktop)
- `src/features/auth/lib/authRefresh.ts` sem `REFRESH_LOCK`/`runExclusive`;
  `AUTH_STORAGE_KEY` vira chave do secure-store.
- `src/shared/lib/wsReconnect.ts` igual.
- `authForms.ts`, `loginError.ts`, `loginIdentifier.ts`, `password.ts` (mensagens
  em PT-BR aprovadas do desktop). Cada um com o teste copiado.

### T4. Sessão
- `src/features/auth/lib/secureTokens.ts`: ler/gravar/limpar tokens no
  `expo-secure-store` (mock no teste).
- `src/features/auth/store/authStore.ts` (Zustand): `status`
  `loading|signedIn|signedOut`, `restore()`, `signIn()`, `signOut()`,
  `expire()` ("Sua sessão expirou"). Testes: restaurar, logout, expirada.

### T5. Cliente REST
- `src/shared/api/client.ts`: `request`/`rawRequest`, timeout 15 s, `ApiError`,
  401 → um único refresh compartilhado (`planRefresh*`), repete a chamada; só
  401/403 do refresh encerram a sessão. Testes: N chamadas 401 simultâneas
  fazem 1 refresh; falha de rede mantém a sessão; timeout vira `ApiError(0)`.
- `src/features/auth/api/auth.ts`: login, register, forgotPassword, logout, me.

### T6. WebSocket
- `src/shared/api/ws.ts`: conecta com token, `on(type, handler)`, backoff do
  `wsReconnect`, reconecta no `AppState` ativo e no `NetInfo` voltando.
  Testes: reconecta ao voltar do segundo plano; não reconecta após logout;
  entrega evento ao handler.
- `src/shared/lib/networkStatus.ts` (+ store mínimo): online/offline para a
  faixa "Sem conexão".

### T7. Tema e componentes base
- `src/shared/theme/tokens.ts` (cores/tipografia/espaçamento do `main.css`).
- `src/shared/ui/`: `Button`, `Input` (com erro), `Avatar`, `Screen` (safe area,
  largura máx. 768 px centralizada), `OfflineBanner`, `ErrorBoundary`.
  Testes de `Button` (desativado ao enviar) e `Input` (mostra o erro).

### T8. Telas de auth
- `src/features/auth/components/`: `LoginForm`, `RegisterForm`,
  `ForgotPasswordForm`; `app/(auth)/{login,cadastro,recuperar-senha}.tsx`
  finas. Testes: erro sob o campo; botão desativado durante o envio; sucesso
  chama `signIn`.

### T9. Casca de navegação e guarda
- `app/_layout.tsx` (providers, `ErrorBoundary`, splash até `restore()`),
  guarda: sem sessão → `(auth)/login`, com sessão → `(app)/(tabs)`.
- `app/(app)/(tabs)/`: Início, Mensagens, Notificações, Você, cada uma com
  "Em breve" (Você tem o botão Sair). `OfflineBanner` no topo.
  Teste da guarda (função pura `routeFor(status)`).

### T10. Build local e documentação
- `scripts/mobile-build.mjs`: valida JDK 17 e `ANDROID_HOME`, roda `expo prebuild
  --platform android` e `gradlew assembleRelease` com o keystore das variáveis
  de ambiente; imprime o caminho do APK. Teste da validação de ambiente.
- Atualizar `AGENTS.md` (comandos e arquitetura), `docs/ai/arquitetura.md`
  (seção Mobile) e o índice de `docs/adr/README.md`.

### T11. Pré-PR e revisão
- `node scripts/affected-tests.mjs pr` verde; verificação de ponta a ponta da
  spec (emulador, 360/768 px, APK em aparelho); revisão em subagente contra a
  spec; **confirmar com o dono antes de push e PR** (base `develop`).

## Riscos
- JDK: o do sistema é 25; o build precisa de 17 (instalar via `winget`, sem mexer
  no `JAVA_HOME` global; o script aponta para ele).
- `cmdline-tools` ausente: pode faltar aceitar licenças/baixar a plataforma do
  Expo; resolver na T10 pelo SDK Manager.
- Cobertura do Jest no CRAP (T1) pode exigir ajuste no leitor de lcov.
