# App mobile, fatia 1: Fundação

Primeira fatia do [roadmap](2026-10-27-app-mobile-roadmap-design.md). Decisão de
arquitetura: [ADR 0021](../../adr/0021-app-mobile-expo.md). Worktree:
`concord-app-mobile`, branch `feat/app-mobile`, a partir da `develop`.

## Objetivo

Um app Android que abre, deixa criar conta, entrar, recuperar a senha e manter a
sessão, com a casca de navegação do Discord (4 abas vazias) e a conexão
WebSocket pronta para as próximas fatias. Gera um APK instalável, por build local.

## Decisões (com o porquê)

- **Tokens no `expo-secure-store`** (Keystore do Android), não em `AsyncStorage`:
  são credenciais.
- **Guarda de rota única** no `app/_layout.tsx`: nenhuma tela decide sozinha se
  há sessão.
- **Refresh de token e backoff do WebSocket portados do desktop** (`authRefresh`,
  `wsReconnect`) com os testes: a lógica já é pura e testada. Trocam-se só o
  armazenamento e a config. O lock entre abas (`runExclusive`/`REFRESH_LOCK`) sai,
  pois o app tem um único processo.
- **Jest com `jest-expo`** (o Vitest do desktop não roda o runtime do RN).
- **`package id` e keystore fixos desde já**: trocar depois quebra atualizações e
  as credenciais do FCM.

## Arquitetura (arquivos e pastas)

```
mobile/
  app.config.ts            nome "Salinha", package id, EXPO_PUBLIC_SERVER_URL
  eas.json                 perfis development e preview (alternativa ao build local)
  app/                     rotas finas do Expo Router
    _layout.tsx            providers, ErrorBoundary, guarda de autenticação
    (auth)/login.tsx cadastro.tsx recuperar-senha.tsx
    (app)/(tabs)/_layout.tsx inicio.tsx mensagens.tsx notificacoes.tsx voce.tsx
  src/
    features/auth/{api,components,hooks,lib,store}
    shared/
      api/client.ts ws.ts  portados do desktop
      ui/                  Button, Input, Avatar, Modal, OfflineBanner...
      theme/tokens.ts      cores, tipografia e espaçamento do main.css
      lib/config.ts        lê EXPO_PUBLIC_SERVER_URL
scripts/mobile-build.mjs   prebuild + Gradle assembleRelease (APK local)
```

Estrutura por feature como no desktop; `shared/` não importa de `features/`;
teste ao lado do arquivo. Rotas em `app/` só montam telas de `src/`.
Scripts `scripts/crap.mjs`, `check-structure.mjs` e `affected-tests.mjs`
passam a cobrir `mobile/` (inclui a regra "nenhum arquivo solto em `mobile/src`").

## Fluxo de dados

**Sessão.** Login/cadastro chamam a API de auth existente e guardam
`access_token` e `refresh_token` no `expo-secure-store`. Na abertura, o splash
fica visível enquanto o `authStore` lê os tokens e valida a sessão; com sessão
vai para `(app)`, sem sessão para `(auth)/login`.

**Refresh.** Resposta 401: renova uma vez e repete a chamada; chamadas
simultâneas esperam a mesma renovação. Rejeição definitiva do servidor limpa a
sessão e volta ao login com o aviso "Sua sessão expirou". Falha só de rede mantém
a sessão e mostra o estado offline.

**WebSocket.** Conecta depois da sessão validada; desconecta no logout.
Reconecta com o backoff do `wsReconnect`, ao voltar do segundo plano
(`AppState`) e ao voltar a rede (`NetInfo`). Expõe `on(type, handler)`; sem
consumidores nesta fatia.

**Recuperar senha e confirmar e-mail.** Os e-mails apontam para o app web
(`APP_URL` + `/reset-password?token=…` e `/verify-email?token=…`). No celular, a
tela "Recuperar senha" só pede o e-mail (`POST /auth/forgot-password`) e avisa
para abrir o link recebido; redefinir e confirmar acontecem no navegador. Deep
link para dentro do app fica para depois.

## Erros

- Sem rede: faixa "Sem conexão" no topo e botões de envio desativados.
- Formulários: erro do `ApiError` (`code`/`message`) sob o campo.
- Timeout de 15 s, como no desktop (`ApiError(0)`).
- Erro inesperado: `ErrorBoundary` raiz com "Tentar de novo".

## Responsivo

Vale de 360 a 768 px. Toque com alvo mínimo de 44 px; teclado não cobre o campo
focado (`KeyboardAvoidingView`); telas de auth centralizadas com largura máxima
em 768 px. Layout de várias colunas fica para o chat.

## Textos aprovados

Reaproveitados do desktop: login, cadastro, recuperação de senha e erros de
formulário. Novos, aprovados pelo dono: **"Sem conexão"**, **"Sua sessão
expirou"**, **"Tentar de novo"** e **"Em breve"** (abas vazias).

## Testes

TDD; só o que importa.

- Portados com os testes: `authRefresh`, `wsReconnect`.
- `authStore`: login, logout, restaurar sessão, sessão expirada.
- `client.ts`: um único refresh para várias chamadas 401 simultâneas; falha de
  rede mantém a sessão; timeout vira `ApiError(0)`.
- `ws.ts`: reconecta ao voltar do segundo plano; não reconecta após logout;
  entrega eventos ao handler.
- Telas de auth: erro sob o campo; botão desativado durante o envio.
- Guarda de rota: sem sessão → login; com sessão → abas.
- Não testa navegação do Expo Router nem tema (configuração).
- CRAP ≤ 15 em toda função tocada.

## Fora de escopo

Servidores, canais, mensagens, DMs, amigos, push, kanban, perfil, níveis, voz e
iOS. Nada de mudança no `frontend/` nem no backend.

## Verificação de ponta a ponta

1. `node scripts/affected-tests.mjs pr` verde, com a saída no PR.
2. Backend local no ar (`scripts/server-up.sh`) e o app no emulador Android (ou
   aparelho, via Dev Client): cadastro → logout → login → fechar e reabrir
   (sessão persiste) → derrubar o backend e voltar (faixa "Sem conexão" e
   reconexão do WebSocket) → invalidar o refresh token no banco (volta ao login
   com "Sua sessão expirou").
3. Largura 360 px (emulador pequeno) e 768 px (emulador de tablet): o login
   centraliza e nada corta.
4. Build local: `scripts/mobile-build.mjs` roda `expo prebuild --platform android`
   e `gradlew assembleRelease` em `mobile/` e gera o APK, que instala e abre em
   aparelho real. `EXPO_PUBLIC_SERVER_URL` entra como variável de ambiente no
   build (servidor hospedado no release, IP local no desenvolvimento).

## Build e assinatura

- **Local é o caminho principal** (decisão do dono): sem conta Expo. O
  `eas build --local` não roda no Windows, então o script usa `expo prebuild` +
  Gradle. A pasta `mobile/android/` é gerada e fica no `.gitignore`.
- **Keystore de release**: gerado uma vez com `keytool`, fora do repo (nunca
  commitado, regra 9). Caminho e senhas vêm de variáveis de ambiente lidas pelo
  Gradle. Guardar backup: perder o keystore impede atualizar o APK instalado.
- **EAS Build** (perfis em `eas.json`) fica como alternativa para quem não tiver
  o Android SDK; exige conta Expo, e não faz parte do critério de pronto.

## Pendências do dono

JDK 17 e Android SDK (command-line tools) instalados nesta máquina, para o build
local. Se o setup der muito trabalho, usamos o EAS (conta Expo gratuita; ninguém
cria conta nem faz login por ele).
