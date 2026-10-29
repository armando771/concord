# App mobile, perfil, PR 1 (base e cartão estático) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A aba "Você" mostra o cartão completo do próprio perfil e tocar em outra pessoa abre o mesmo cartão, só leitura, sem efeitos animados.

**Architecture:** A lógica pura do desktop (tema, estilo do nome, links, mídia) é copiada e adaptada para `mobile/src/features/profile/lib/` com os testes que ela já tem. O cartão é feito de componentes React Native comuns; o que o desktop faz com CSS (degradê, neon, texto estilizado) cai num fallback simples (primeira cor, nome sólido) até o PR 2 trazer o Skia.

**Tech Stack:** Expo SDK 58, React Native 0.88, Expo Router, Zustand, Jest + React Native Testing Library v14 (tudo assíncrono: `await render`, `await fireEvent`, `await renderHook`). **Sem dependência nova neste PR.**

**Spec:** `docs/superpowers/specs/2026-10-29-app-mobile-perfil-design.md` (PR 1 de 4). Desvio da spec: `@shopify/react-native-skia` entra no PR 2 e `expo-image-picker` no PR 4, que são os que usam; o ADR 0024 já está no repo.

## Global Constraints

- CRAP ≤ 15 em toda função tocada (`node scripts/crap.mjs --files ...` antes e depois); arquivo tocado acima de 400 linhas sai menor; nada de campo novo em `callStore`, `chatStore`, `serverStore`.
- Código, comentários, UI e commits em português; commits convencionais (`feat(mobile):`, `refactor(mobile):`); sem `Co-Authored-By` nem atribuição de IA.
- Sem dependência nova no `package.json`.
- Textos aprovados na spec: **Sobre mim**, **Links**, **Voltar**, "Não foi possível abrir esse perfil.". Qualquer outro texto novo de interface precisa de aprovação: reaproveite os que o app já tem (ex.: o rótulo de tentar de novo já usado em `ChatScreen`).
- Responsivo 360/768/1280 px: cartão em largura total até 480 px, centrado acima disso; alvos de toque ≥ 48 dp.
- Falha de fonte, tema ou imagem nunca derruba a tela.
- Jest: `jest.mock` só referencia variáveis `mock*`; no mobile tudo é `await`.
- Lógica portada fica em `lib/` com comentário curto dizendo de onde veio.
- `.expo/types/router.d.ts` é gitignorado: se o `typecheck` reclamar da rota nova `/perfil/[id]`, adicione-a à mão nesse arquivo, como já foi feito para `/chamada`.

## Review Focus

1. Perfil de usuário que não existe ou deu 404: o cartão mostra "Não foi possível abrir esse perfil." e o botão Voltar, sem travar (Task 5).
2. Tema ou estilo de nome vindos do servidor com ID desconhecido, cor fora de `#rrggbb` ou número de cores errado: voltam ao padrão sem lançar erro (Task 1).
3. Perfil sem avatar, sem banner, sem bio, com nome longo ou só emoji: o cartão aparece inteiro, com iniciais e cor de banner padrão (Tasks 3 e 4).
4. Avatar ou banner GIF animado (`a_<uuid>`): no cartão anima; na lista continua parado via `/static` (Task 2).
5. Rede cai ao abrir o cartão de outra pessoa: mostra o último cartão em cache se existir, senão o erro com a opção de tentar de novo (Task 5).

---

## File Structure

```
mobile/src/features/profile/
  lib/
    profileInk.ts  profilePride.ts  readableColor.ts      portados (cor do texto sobre o fundo)
    profileThemeExtras.ts  profileTheme.ts                 portados (sem as partes CSS)
    nameStyle.ts                                           portado (listas e resolveNameStyle)
    profileLinks.ts                                        portado
    profileMedia.ts                                        adaptado (usa shared/lib/mediaUrl)
    profileTypes.ts                                        ProfileData (o que /users/:id/profile devolve)
    cardLook.ts                                            tema -> estilos do React Native
  api/users.ts                                             getProfile(id)
  store/profileCardStore.ts                                cache dos cartões vistos
  hooks/useProfileCard.ts
  components/card/ CardBanner.tsx CardAvatar.tsx CardNames.tsx CardLinks.tsx ProfileCard.tsx
  components/ProfileScreen.tsx                             cartão de outro usuário (loading/erro/voltar)
mobile/app/(app)/perfil/[id].tsx                           rota fina
mobile/app/(app)/conta.tsx                                 (existe) passa a mostrar o cartão
```

Referência de layout do desktop: `frontend/src/renderer/src/features/profile/components/ProfileCardBody.tsx` e `card/*`. Referência dos testes a portar: `frontend/.../profile/lib/*.test.ts`.

---

### Task 1: Portar tema, estilo do nome e cor do texto

**Files:**
- Create: `mobile/src/features/profile/lib/{profileInk,profilePride,readableColor,profileThemeExtras,profileTheme,nameStyle}.ts` e os `.test.ts` correspondentes (copiados do desktop)
- Create (se não existir no mobile): `mobile/src/shared/lib/contrast.ts` + teste, copiado de `frontend/src/renderer/src/shared/lib/contrast.ts`

**Interfaces:**
- Produces: `ProfileTheme`, `DEFAULT_PROFILE_THEME`, `PROFILE_BORDERS`, `PROFILE_BACKGROUNDS`, `PROFILE_EFFECTS`, `effectDef(id)`, `resolveProfileTheme(raw?: Partial<ProfileTheme> | null): ProfileTheme`, `sameTheme`, `withBorder`, `withBackground`; `ProfileThemeExtras`, `DEFAULT_EXTRAS`, `resolveExtras`; `NameStyle`, `DEFAULT_NAME_STYLE`, `NAME_FONTS`, `NAME_EFFECTS`, `defaultColorsFor`, `resolveNameStyle(raw?: Partial<NameStyle> | null): NameStyle`; `pickInk`, `Ink`, `DARK_INK`, `LIGHT_INK`, `PRIDE_PALETTE`.

- [ ] **Step 1: Copiar os testes do desktop** (`profileTheme.test.ts`, `profileThemeExtras.test.ts`, `nameStyle.test.ts`, `profileInk.test.ts`, `profilePride.test.ts`, `readableColor.test.ts`) para `mobile/.../lib/`, trocando `vitest` por Jest (`describe/it/expect` globais; sem `import { ... } from 'vitest'`). Testes que conferem as listas contra o backend continuam (`internal/profiletheme`, `internal/namestyle`).
- [ ] **Step 2: Rodar e ver falhar** — `cd mobile && yarn jest src/features/profile/lib` → falha por módulo inexistente.
- [ ] **Step 3: Copiar as libs** removendo o que é CSS/DOM: em `profileTheme.ts` tire `CARD_BG` e os imports de `effects/types` (as funções `effectParams`, `extrasVars`, `extrasClasses` de `profileThemeExtras.ts` também saem; elas voltam no PR 2); em `nameStyle.ts` tire `nameStyleCss`, `NameStyleCss`, `nameEndPadding`, o import de `CSSProperties` e `nameGraphemes` se só o CSS usa. Mantenha todas as listas e as funções `resolve*`.
- [ ] **Step 4: Rodar** → verde. Acrescente os testes de Review Focus 2: `resolveProfileTheme({ border: 'neon', border_colors: ['vermelho'] })` devolve `border: 'none'`; `resolveNameStyle({ effect: 'gradient', colors: ['#fff'] })` cai em `solid`; `resolveProfileTheme(null)` e `resolveNameStyle(undefined)` devolvem o padrão.
- [ ] **Step 5: Commit** — `git commit -m "feat(mobile): lógica de tema e estilo de nome do perfil (portada do desktop)"`

---

### Task 2: Portar links e mídia do perfil

**Files:**
- Create: `lib/profileLinks.ts`, `lib/profileLinks.test.ts` (cópia), `lib/profileMedia.ts`, `lib/profileMedia.test.ts`

**Interfaces:**
- Produces: `linkLabel(url): string`, `detectProvider(url)`, `normalizeLink`, `splitLinks(text): TextPart[]`, `MAX_LINKS`; `isAnimatedMedia(url): boolean`; `profileMediaSrc(url: string | null | undefined, opts?: { animate?: boolean }): string | null` (usa `mediaSrc` de `shared/lib/mediaUrl`; `animate: false` num GIF `a_` acrescenta `/static`).

- [ ] **Step 1: Teste de `profileMedia`** (falhando): `profileMediaSrc('/api/profile-media/a_123')` termina em `/api/profile-media/a_123`; com `{ animate: false }` termina em `/a_123/static`; imagem que não anima (`/api/profile-media/abc`) fica igual nos dois modos; `null` devolve `null`; URL `blob:`/`data:` volta como está; `isAnimatedMedia` só é verdadeiro para o prefixo `a_`.
- [ ] **Step 2: Rodar, ver falhar; implementar `profileMedia.ts`** a partir do desktop, trocando `apiBase`/`origin` por `mediaSrc`.
- [ ] **Step 3: Copiar `profileLinks.ts` e seu teste** (se `LinkProvider` importar ícone/React, deixe só `id`, `label` e o padrão de URL). Rodar → verde.
- [ ] **Step 4: Commit** — `feat(mobile): links e mídia do perfil (portados do desktop)`

---

### Task 3: Tipos do perfil e API

**Files:**
- Create: `lib/profileTypes.ts`, `api/users.ts`, `api/users.test.ts`
- Modify: `mobile/src/features/auth/store/authStore.ts` (interface `User`)

**Interfaces:**
- Produces: `interface ProfileData { id; username; display_name; avatar_url?: string|null; banner_url?: string|null; banner_color?: string|null; pronouns?: string; bio?: string; status_text?: string; links?: { url: string }[]; name_style?: Partial<NameStyle>|null; profile_theme?: Partial<ProfileTheme>|null; is_bot?: boolean }`; `getProfile(userId: string): Promise<ProfileData>` chama `GET /users/${encodeURIComponent(userId)}/profile`.
- `User` (auth) ganha os mesmos campos opcionais de aparência (`banner_url`, `banner_color`, `pronouns`, `bio`, `status_text`, `links`, `name_style`, `profile_theme`), sem lógica nova; `/users/me` já os devolve e `getMe` os repassa.

- [ ] **Step 1: Teste** de `getProfile` com `fetch` mockado (padrão de `friends/api/friends.test.ts`): chama o caminho certo e devolve o JSON; 404 vira `ApiError` com `status` 404.
- [ ] **Step 2: Rodar, ver falhar; implementar** `getProfile` com `request` de `shared/api/client`; declarar `ProfileData`; estender `User`.
- [ ] **Step 3: Rodar `yarn typecheck`** → sem erros novos. **Commit** — `feat(mobile): tipos e API do perfil`

---

### Task 4: Aparência do cartão (tema para estilos do React Native)

**Files:**
- Create: `lib/cardLook.ts`, `lib/cardLook.test.ts`

**Interfaces:**
- Consumes: `resolveProfileTheme`, `pickInk`, `PRIDE_PALETTE`, `colors` de `shared/theme/tokens`.
- Produces: `cardLook(theme: Partial<ProfileTheme> | null | undefined): CardLook` com `CardLook = { borderWidth: number; borderColor: string; backgroundColor: string; ink: Ink }`. Regras (fallback do PR 1, o PR 2 troca por degradê e neon de verdade): borda `none` → largura 0; `solid`/`neon`/`gradient` → cor 1 da borda; `rainbow` → primeira cor da `PRIDE_PALETTE`; largura = `border_width` do tema. Fundo `default` → o fundo flutuante do app; `solid`/`gradient` → cor 1 do fundo; `pride` → primeira cor da paleta. `ink` = `pickInk` sobre o fundo escolhido.

- [ ] **Step 1: Testes** (falhando): tema nulo → sem borda, fundo padrão; `solid` com `['#112233']` → `backgroundColor: '#112233'`; `gradient` com duas cores → primeira; borda `neon` com `border_width: 4` → `borderWidth: 4`; fundo escuro → `ink` clara e fundo claro → escura; tema inválido (`border: 'x'`) → padrão sem lançar.
- [ ] **Step 2: Rodar, ver falhar; implementar `cardLook`** (função pequena, uma por parte: `borderOf`, `backgroundOf`) para CRAP baixo.
- [ ] **Step 3: Rodar → verde. Commit** — `feat(mobile): aparência do cartão a partir do tema`

---

### Task 5: Store, hook e componentes do cartão

**Files:**
- Create: `store/profileCardStore.ts`, `hooks/useProfileCard.ts`, `components/card/{CardBanner,CardAvatar,CardNames,CardLinks,ProfileCard}.tsx`, `components/ProfileScreen.tsx` e um `.test` para cada

**Interfaces:**
- Produces: `useProfileCardStore` (`cards: Record<string, ProfileData>`, `put(profile)`, `reset()`); `useProfileCard(userId: string): { profile: ProfileData | null; status: 'loading' | 'ready' | 'error'; reload: () => void }` — se o id é o do usuário logado devolve o de `authStore` (sempre `ready`); senão devolve o cache na hora e busca `getProfile` em seguida (`status` fica `ready` com o cache enquanto recarrega; `error` só se não há cache); `ProfileCard({ profile }: { profile: ProfileData })`; `ProfileScreen({ userId, onBack })`.
- `ProfileCard` monta, de cima para baixo: `CardBanner` (imagem via `profileMediaSrc`, senão `banner_color`, senão cor padrão da marca), `CardAvatar` (com `PresenceDot` do `presenceStore`, borda na cor do fundo), `CardNames` (nome com a fonte e cor do `resolveNameStyle` quando `effect` é sólido; qualquer outro efeito cai em texto sólido na primeira cor ou na cor da tinta; `@username`, pronomes e status), seção **Sobre mim** (bio com `splitLinks`) e **Links** (`linkLabel`). Container com `cardLook` e `maxWidth: 480`, centrado. Seção vazia some.

- [ ] **Step 1: Testes do store e do hook** (falhando): hook com id próprio devolve o da sessão sem chamar `getProfile`; id de outro: primeiro devolve cache, chama `getProfile` uma vez e atualiza; sem cache e com erro → `status: 'error'`; com cache e erro → continua `ready` com o cache (Review Focus 5); `reload` busca de novo.
- [ ] **Step 2: Rodar, ver falhar; implementar store e hook.**
- [ ] **Step 3: Testes dos componentes** (falhando): `ProfileCard` com perfil completo mostra nome, `@usuario`, pronomes, status, **Sobre mim**, **Links**; perfil mínimo (só id, username, display_name) mostra iniciais e não mostra as seções; nome de 1 emoji e nome longo (`numberOfLines`) não quebram; tema `solid` aplica a cor de fundo no container; `ProfileScreen` mostra `ActivityIndicator` ao carregar, "Não foi possível abrir esse perfil." + **Voltar** no erro 404 (Review Focus 1), e o cartão quando pronto; **Voltar** chama `onBack`.
- [ ] **Step 4: Rodar, ver falhar; implementar os componentes** reaproveitando `Avatar`, `Banner`, `PresenceDot`, `tokens` e `Button` existentes; cada arquivo abaixo de 120 linhas.
- [ ] **Step 5: Rodar → verde, `yarn typecheck`. Commit** — `feat(mobile): cartão do perfil estático`

---

### Task 6: Rotas e entradas do cartão

**Files:**
- Create: `mobile/app/(app)/perfil/[id].tsx`
- Modify: `mobile/app/(app)/conta.tsx`, `mobile/src/features/auth/components/AccountPanel.tsx`, `mobile/src/features/friends/components/FriendRow.tsx`, `mobile/src/features/chat/components/MessageItem.tsx`, o cabeçalho da DM (`ChatScreen.tsx`/`ChannelHeader.tsx`), `mobile/tests/routes.test.tsx` e os testes de cada um

**Interfaces:**
- Consumes: `ProfileScreen`, `ProfileCard`, `useProfileCard`.
- Produces: rota `/perfil/[id]` (`useLocalSearchParams<{ id: string }>`, `onBack = router.back`); `AccountPanel` mostra `ProfileCard` do usuário logado acima do **Sair** (rolável; sem o bloco antigo de nome); `FriendRow`, o nome/avatar de quem escreveu em `MessageItem` e o nome no cabeçalho da DM ganham `onOpenProfile?: (userId: string) => void`, ligado em `router.push({ pathname: '/perfil/[id]', params: { id } })` nas rotas/telas que os usam. `onOpenProfile` ausente = comportamento de hoje (sem toque).

- [ ] **Step 1: Testes** (falhando): `routes.test.tsx` — `/perfil/abc` renderiza `ProfileScreen` com `userId="abc"`; `AccountPanel` mostra o cartão e o botão Sair continua funcionando (testes existentes seguem verdes); `FriendRow` e `MessageItem` chamam `onOpenProfile(id)` ao tocar no avatar/nome e não chamam quando ausente; cabeçalho da DM idem. Cuidado com CRAP de `MessageItem` (hoje 8): extraia o trecho de autor para um subcomponente se passar de 12.
- [ ] **Step 2: Rodar, ver falhar; implementar** a rota, o `AccountPanel` e as três entradas; passe `onOpenProfile` a partir de `app/(app)/index.tsx`, `amigos.tsx`, `canal/` e `dm/`.
- [ ] **Step 3: Rodar `yarn typecheck`** (se a rota nova não aparecer nos tipos, adicionar `/perfil/[id]` ao `.expo/types/router.d.ts` à mão). **Commit** — `feat(mobile): aba Você com o cartão e perfil de outros usuários`

---

### Task 7: Spec, verificação e PR

**Files:**
- Modify: `docs/superpowers/specs/2026-10-29-app-mobile-perfil-design.md` (tabela de PRs: dependências nos PRs 2 e 4)

- [ ] **Step 1: Ajustar a spec** — no PR 1 retire "e dependências"; no PR 2 acrescente "`@shopify/react-native-skia`"; no PR 4 "`expo-image-picker`". **Commit** — `docs(mobile): dependências do perfil entram nos PRs que as usam`
- [ ] **Step 2: `node scripts/affected-tests.mjs pr`** → saída verde (afetados, typecheck, estrutura, CRAP). Guardar a saída do CRAP antes/depois para o PR.
- [ ] **Step 3: Conferir em aparelho** com o APK de dev atual (sem módulo nativo novo): backend local, conta com tema e nome estilizado feitos no desktop, capturas em 360 e 768 px da aba "Você" e do cartão de outro usuário. Registrar o que não foi possível provar.
- [ ] **Step 4: Revisão** (`superpowers:requesting-code-review`) e tratar o retorno. **Confirmar com o usuário antes de push e PR.**
