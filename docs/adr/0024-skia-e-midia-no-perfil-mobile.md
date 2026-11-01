# 0024. Desenhar efeitos e recortar imagens do perfil no app mobile com o Skia

- Status: proposto
- Data: 2026-10-29

## Contexto

O cartão do perfil do desktop ([spec](../superpowers/specs/2026-10-29-app-mobile-perfil-design.md)) tem
efeitos animados desenhados em canvas 2D (9 cenas), nome com 17 efeitos de texto feitos em CSS (degradê,
neon, glitch...) e recorte de avatar e banner, inclusive de GIF animado (decodifica quadros, recorta e
codifica de novo em JS). React Native não tem canvas 2D nem CSS; as cenas do desktop já são "estado +
passo de matemática pura + desenho num subconjunto de contexto 2D" ([`effects/types.ts`]), e `cropGif`
recebe os quadros e a função de desenho por injeção.

Forças:

- Visual igual ao do desktop é o critério de sucesso.
- Um cartão por tela, então o custo por efeito não se multiplica.
- Sem dependência nova sem ADR (este); módulo nativo exige APK de dev novo.
- O Skia é biblioteca oficial do [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/skia/).

## Opções consideradas

1. **Skia com um adaptador de contexto 2D** (cenas copiadas do desktop). Fidelidade e GPU; custo é a
   dependência nativa e o adaptador.
2. **Reanimated e Views.** Sem dependência nova, mas 9 reescritas e vários efeitos muito diferentes ou
   caros demais.
3. **WebView com o canvas do desktop.** Reaproveita o código, mas é dependência nativa do mesmo jeito,
   pesa em memória e mistura dois mundos para testar.

## Decisão

Opção 1. Duas dependências novas no `mobile/package.json`:

- `@shopify/react-native-skia`: efeitos do tema, nome estilizado, recorte (superfície fora da tela) e
  leitura de quadros de GIF.
- `expo-image-picker`: galeria e câmera. O recorte em si não usa `expo-image-manipulator`.

As fontes do estilo do nome são empacotadas como `.ttf` (licença OFL) em `mobile/assets/fonts/` e
carregadas com o `expo-font`, que o app já tem; nenhum pacote `@expo-google-fonts`.

O Skia fica atrás de módulos próprios (`features/profile/skia/`), como o SDK de voz fica atrás de
`CallMedia` ([ADR 0023](0023-voz-no-app-mobile.md)): a lógica (cenas, rascunho, GIF) é JS puro e roda no
Jest sem módulo nativo.

## Consequências

- Mais fácil: visual igual ao desktop, lógica portada por cópia com os testes que ela já tem.
- Mais difícil: APK de dev novo; o adaptador precisa cobrir `shadowBlur` e modos de composição; o
  tamanho do APK cresce (Skia e as fontes).
- Risco aberto, resolvido por um **spike antes dos PRs 2 e 4**: o Skia precisa rodar o adaptador sem
  travar e decodificar quadros de GIF no Android. Se falhar, este ADR é revisto.
- Reversível: o resto do app não importa o Skia.

## Referências

- [Skia no Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/skia/)
- [ADR 0021](0021-app-mobile-expo.md), [ADR 0023](0023-voz-no-app-mobile.md)
