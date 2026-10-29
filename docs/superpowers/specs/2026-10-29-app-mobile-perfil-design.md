# App mobile, fatia 4: o cartão do perfil

Quarta fatia do [roadmap](2026-10-27-app-mobile-roadmap-design.md). Níveis, emblemas, cargos e
configurações da conta ficam para a **fatia 4b** (outra spec). Referência no desktop:
`frontend/src/renderer/src/features/profile/` (cartão, efeitos, estilo do nome) e
`features/settings/` (editor em Configurações → Perfis).

## Objetivo

1. A aba "Você" mostra o **cartão completo do próprio perfil**, como os outros o veem: banner, avatar,
   nome com o estilo escolhido, status, pronomes, bio, links, borda, fundo e o efeito animado do tema.
2. O usuário **edita tudo** que o desktop deixa editar no cartão: nome, pronomes, bio, status, links,
   avatar, banner (imagem, GIF ou cor), estilo do nome e tema do cartão, com **prévia ao vivo** e
   **recorte de imagem e de GIF animado** como no desktop.
3. Tocar em outra pessoa abre o **mesmo cartão, só leitura**. Pontos de entrada (escolha minha):
   a linha do amigo na tela Amigos, o avatar ou nome de quem escreveu no chat, e o nome no
   cabeçalho de uma DM.

Sucesso: o perfil que a pessoa montou no desktop aparece igual no celular, e o que ela editar no
celular aparece igual no desktop.

## O que o backend já tem (nada a criar)

- `GET /users/:id/profile` (cartão de qualquer usuário) e `GET /users/me`.
- `PUT /users/me/profile`: nome, pronomes, bio, status, links, cor do banner, `name_style`,
  `profile_theme` (limites e validação já no servidor).
- `POST /users/me/avatar` e `/banner` (multipart: `file` e, para GIF, `static` com o primeiro quadro),
  `DELETE` dos dois, e `GET /users/profile-media/:id[/static]`. PNG, JPEG, GIF e WebP, até 10 MB.
- `PUT /users/me/status` e o status ao vivo pelo `presenceStore` (já existe no app).

## Decisões (com o porquê)

- **Escopo = só o cartão.** Níveis, emblemas, cargos, privacidade, notificações, e-mail e senha vão
  para a 4b. Motivo: independentes do cartão, e juntos o PR não ficaria testável.
- **Som de entrada fica fora** (exige escolher e enviar áudio). Vai para a 4b ou para a fase 2 da voz.
- **Efeitos do tema com o Skia** (opção A do ADR 0024): as 9 cenas de canvas e o laço do desktop são
  copiados e adaptados; um adaptador implementa o subconjunto de contexto 2D sobre o canvas do Skia.
  Os 3 efeitos CSS do desktop (partículas, brilhos, neve) viram cenas do mesmo adaptador.
- **Nome estilizado também no Skia**: as 17 variações usam degradê, sombra e animação sobre texto, que
  não existem em React Native. Fallback: nome em texto simples na cor do tema.
- **Fontes empacotadas** (`mobile/assets/fonts/*.ttf`, licença OFL) e carregadas com o `expo-font`, que
  o app já tem. Sem 27 pacotes `@expo-google-fonts`.
- **Recorte com o Skia, sem `expo-image-manipulator`**: imagem parada é desenhada numa superfície fora
  da tela e exportada (PNG/JPEG). GIF animado: o Skia decodifica os quadros; `cropGif`, a paleta e o
  codificador de GIF (JS puro) são copiados do desktop, que já os recebe por injeção
  (`SourceFrame`, `DrawFrame`). O primeiro quadro (`static`) sai da mesma superfície.
- **Salvar segue a sequência do desktop** (`saveProfile`): avatar, banner, depois campos; cada passo
  que dá certo sai do rascunho, então tentar de novo refaz só o que faltou.
- **Desempenho**: efeitos a 30 fps, pausados quando a tela perde o foco ou o app vai ao fundo e parados
  se o sistema pedir "reduzir movimento". Falha no efeito ou na fonte nunca derruba a tela.
- **Dependências novas** (ADR 0024): `@shopify/react-native-skia` (biblioteca oficial do Expo SDK 58) e
  `expo-image-picker` (galeria e câmera). Exige **APK de dev novo** (módulo nativo).

## Abordagens consideradas (efeitos animados)

- **A. Skia + adaptador de contexto 2D (escolhida).** Reaproveita as cenas do desktop, desenha na GPU,
  visual igual. Custo: dependência nativa e o adaptador (`shadowBlur`, composição).
- **B. Reanimated + Views.** Sem dependência nova, mas são 9 reescritas e vários efeitos ficariam
  diferentes do desktop ou caros demais.
- **C. WebView com o canvas do desktop.** Reaproveita 100%, mas também é dependência nativa, pesa em
  memória e mistura dois mundos para testar.

## Arquitetura (arquivos e pastas)

```
mobile/app/(app)/
  conta.tsx                     (já existe) aba "Você": cartão + Editar perfil + Sair
  perfil/editar.tsx             editor (rota fina)
  perfil/[id].tsx               cartão de outro usuário, só leitura
mobile/assets/fonts/            .ttf das fontes do estilo do nome
mobile/src/features/profile/
  lib/                          portado do desktop, com os testes: profileValidation, profileTheme,
                                profileThemeExtras, profilePresets, nameStyle, profileLinks, profileMedia,
                                effects/ (cenas + loop), imageCrop, gifCrop, gifEncoder, gifQuantize,
                                gifDelta, saveProfile
  skia/                         ctx2d (adaptador), EffectCanvas, StyledName, gifFrames (decodifica quadros),
                                cropSurface (recorte e exportação)
  store/                        profileDraftStore (rascunho do editor), profileCardStore (outros usuários)
  api/                          users.ts (updateProfile, uploadImage, removeImage, getProfile)
  hooks/                        useProfileCard, useReduceMotion, useAppFocusPause
  components/card/              ProfileCard, CardBanner, CardAvatar, CardNames, CardLinks
  components/edit/              EditProfileScreen, BasicSection, ImagesSection, NameSection, ThemeSection,
                                LivePreview, UnsavedChangesDialog
docs/adr/0024-skia-e-midia-no-perfil-mobile.md
```

`UserPanel` (`features/profile/components`) passa a abrir o cartão. A lógica nova vive em `lib/` e nas
stores; nenhum arquivo concentra duas responsabilidades. Nada vai para `callStore`, `chatStore` ou
`serverStore`.

## Fluxo de dados

- O usuário da sessão (`authStore`) é o que está salvo. O editor trabalha num rascunho separado
  (`draftFromProfile`); a prévia do topo desenha o rascunho.
- Salvar: `saveProfile` (avatar → banner → campos). O usuário devolvido pelo servidor é gravado na
  sessão e o rascunho se refaz a partir dele.
- Cartão de outro usuário: `GET /users/:id/profile`. O `profileCardStore` guarda o último cartão visto
  só durante a sessão: abre na hora com ele e recarrega em seguida (escolha minha); status ao vivo vem
  do `presenceStore`.
- O visual que o desktop descreve em CSS (`profileThemeLook`, `nameStyleCss`: degradês, bordas, sombras)
  é traduzido para o Skia e para estilos do React Native dentro de `skia/` e `components/card/`; a
  tradução de cada efeito do nome fica a cargo de quem implementa, com o desktop como referência.

## Erros

- Validação inline com os limites do backend: nome 32, pronomes 40, bio 190, status 128, links
  (`MAX_LINKS`, `linkError`), imagem até 10 MB e só PNG, JPEG, GIF ou WebP.
- Falha de rede ou do servidor ao salvar: o rascunho é mantido e a mensagem oferece tentar de novo.
- GIF com mais de 300 quadros ou ilegível: recusado com mensagem.
- Galeria ou câmera sem permissão: aviso com atalho para os ajustes do sistema.
- Efeito, nome estilizado ou fonte que falham: cartão sem o efeito, nome simples, fonte padrão.

## Responsivo (360 / 768 / 1280 px)

- Cartão em largura total até 480 px; em telas mais largas fica centrado com 480 px.
- Editor em coluna única; a prévia fixa no topo encolhe quando o teclado abre (360 px não comporta
  prévia e campo juntos).
- Alvos de toque de pelo menos 48 dp; tudo navegável por teclado externo.

## PRs empilhados

1. **Base e cartão estático:** lógica portada, `ProfileCard` sem efeitos, aba "Você" com o cartão,
   rota `perfil/[id]`, ADR 0024 e dependências.
2. **Skia:** adaptador, efeitos do tema e nome estilizado, fontes.
3. **Editor:** as quatro seções, rascunho, prévia ao vivo, salvar e descartar.
4. **Imagem e GIF:** seleção (galeria e câmera), recorte e `cropGif` com a superfície do Skia.

Antes do plano do PR 2 e do PR 4, um **spike curto** prova que o Skia (a) roda o adaptador com o efeito
Fogo sem ficar abaixo de 24 fps de forma sustentada e (b) decodifica os quadros de um GIF no Android.
Roda no emulador e, para o desempenho, também no celular físico (o emulador sem GPU não mede fps de
verdade). Se falhar, voltamos a esta spec.

## Textos para aprovar (o que o usuário final lê)

Reaproveitam os do desktop (rótulos de fontes, efeitos, bordas, fundos, presets e `NAME_CHARS_MESSAGE`).
Novos para o celular:

- Aba "Você": botão **Editar perfil**; título do cartão de outro usuário: o nome dele.
- Editor: título **Editar perfil**; seções **Básico**, **Imagens**, **Nome**, **Tema do cartão**;
  botões **Salvar** e **Voltar**.
- Campos: **Nome de exibição**, **Pronomes**, **Sobre mim**, **Status**, **Links**, **Adicionar link**.
- Imagens: **Avatar**, **Banner**, **Escolher da galeria**, **Tirar foto**, **Remover**, **Usar uma cor**.
- Recorte: **Ajustar imagem**, **Usar**, **Cancelar**.
- Descartar: **Descartar alterações?**, "Você tem mudanças que não foram salvas.",
  **Continuar editando**, **Descartar**.
- Mensagens: "Perfil salvo."; "Não foi possível salvar o perfil. Tente de novo."; "Não foi possível
  abrir esse perfil."; "A imagem passa de 10 MB."; "Use PNG, JPEG, GIF ou WebP."; "Esse GIF tem quadros
  demais (o máximo é 300)."; "Não foi possível ler os quadros desse GIF."; "Permita o acesso à galeria
  nos ajustes para escolher uma imagem."; "Permita o acesso à câmera nos ajustes para tirar uma foto."

## Fora de escopo

Níveis, emblemas, cargos, privacidade, notificações, e-mail, senha e aniversário (4b); som de entrada;
perfis salvos; preview de live; menu de contexto de usuário; edição do perfil de servidor (apelido por
servidor); seletor de presença (online, ausente, não perturbe); iOS.

## Verificação de ponta a ponta

1. `node scripts/affected-tests.mjs pr` verde em cada PR (CRAP ≤ 15 nas funções tocadas, catraca anti-god).
2. APK de dev novo no emulador com o backend local: conta com tema, efeito e nome estilizado feitos no
   desktop aparece igual no celular (captura lado a lado).
3. Editar nome, avatar (galeria) e banner GIF no celular, salvar, e ver o resultado no desktop.
4. GIF de exemplo recortado no celular continua animado e com os mesmos tempos de quadro.
5. Efeito animado a 30 fps no emulador, pausando ao ir para o fundo e com "reduzir movimento".
6. Capturas em 360 e 768 px; fluxo "Descartar alterações?" com mudança não salva.
