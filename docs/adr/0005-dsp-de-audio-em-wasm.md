# 0005. Rodar o DSP do voice mod em Rust/WASM, com o .wasm commitado

- Status: aceito
- Data: 2026-10-27

## Contexto

Em chamada de voz o microfone passa por três AudioWorklets na thread de áudio
em tempo real: o RNNoise (já WASM, `@sapphi-red/web-noise-suppressor`), o voice
mod (`voiceModDsp.ts`: pitch shift granular, vibrato, modulação de amplitude) e
a detecção de fala com o portão (`voiceActivityGate.ts`). Os dois últimos eram
JS puro, rodando 375 vezes por segundo, o voice mod inclusive no preset Normal
(o nó fica sempre no grafo; só os ganhos zeram). O dono do projeto pediu para
portar esse processamento para Rust compilado para WebAssembly, dentro dos
mesmos worklets, mas só onde os números justificassem.

Forças:

- O som tem de ser o mesmo (em todo preset) e o app não pode ficar sem voice
  mod se o WASM falhar.
- Nada de dependência nova no `package.json` nem no Cargo; o build do frontend
  e o do Windows (electron-builder em Docker) não podem passar a exigir Rust.
- Os worklets não têm `fetch` útil (o app roda em `file://`) nem `TextDecoder`
  garantido: cola gerada (wasm-bindgen, Emscripten) é peso e risco.
- Medido antes e depois (`scripts/bench-dsp.mjs`, `scripts/bench-dsp-chromium.mjs`
  e o trace do app em call, `scripts/perf-bench.mjs` cenário d): ver
  [docs/PERFORMANCE.md](../PERFORMANCE.md#dsp-de-áudio-js--wasm).

## Opções consideradas

1. **Ficar no JS, só otimizando o laço** (um seno por amostra em vez de dois,
   sem `%` no buffer circular). Sem risco de build e é metade do ganho: no
   Chromium o voice mod Normal cai de 10,9 para 7,0 µs por quantum; o WASM com
   o mesmo algoritmo, para 5,9 µs.
2. **AssemblyScript**: exige dependência npm nova (compilador) e runtime
   próprio; ganha pouco sobre a opção 4.
3. **Rust com wasm-bindgen / wasm-pack**: dependência Cargo e cola JS gerada,
   pensada para a página, não para o AudioWorkletGlobalScope.
4. **Rust sem dependências, exports `extern "C"` sobre a memória linear**:
   estado e buffers estáticos (zerados no .bss, nada alocado por quantum), o JS
   só copia 128 floats para dentro e para fora. Módulo sem imports, ~33 KB.
5. Compilar o `.wasm` no build do frontend/CI em vez de commitá-lo: todo build
   (dev no Windows, `build-win.sh`, `release-*.sh`) passaria a precisar de
   Rust + alvo wasm32.

## Decisão

Opção 4 para o **voice mod**, com o `.wasm` commitado (opção 5 rejeitada), e a
opção 1 junto: o JS de fallback ganhou as mesmas otimizações do laço, então o
app fica mais leve mesmo se o WASM não carregar. O ganho absoluto é pequeno
(no app, o worklet do voice mod caiu de ~7,4 para ~4,8 ms de CPU por segundo,
~0,26 % de um núcleo) — o DSP em JS nunca foi o gargalo — mas o WASM ainda é
1,2–1,5× mais rápido que o JS otimizado e não tem JIT/GC na thread de áudio.

O crate fica em `native/concord-dsp/` (`cargo test` no host testa o algoritmo)
e é compilado por `scripts/build-dsp-wasm.sh` dentro do Docker, na imagem
oficial do Rust fixada pelo digest (rustc 1.99.1) mais `rustup target add
wasm32-unknown-unknown` — nada instalado na máquina, e o mesmo fonte gera o
mesmo binário (conferido com `--check` a partir de um `target/` limpo). O
resultado vai para `frontend/src/renderer/src/features/call/lib/concordDsp.wasm`
com o manifesto `concordDsp.wasm.json` (sha256 do fonte normalizado e do `.wasm`).

A página compila o módulo uma vez (`dspModule.ts`) e o entrega já compilado ao
worklet em `processorOptions.dspModule` (o Electron 44 clona o
`WebAssembly.Module` para o AudioWorkletGlobalScope); cada processador
instancia o seu. Sem módulo, ou se ele não instanciar, o worklet usa o
`VoiceModDsp` em JS, que continua sendo a referência: `voiceModWasm.test.ts`
compara a saída dos dois para os mesmos sinais, em todo preset.

Não foram portados:

- **Detecção de fala/portão**: chegou a ser portada, mas o laço custa ~1–2 µs
  por quantum e o resto é o custo fixo de o motor chamar o `process()`. No
  Chromium caiu só de 5,9 para 5,2 µs; no trace do app ficou igual (4,3 → 4,9
  ms/s, dentro do ruído). Ficou só a otimização do `%` no JS.
- `pcmRing.ts`/`screenAudioWorklet.ts`: cópia de 128 quadros estéreo, ~1 µs
  por quantum e só ao compartilhar janela com som.
- `voiceModCurves.ts`: roda uma vez por preset/microfone, fora da thread de
  áudio (impulso do reverb 3,5 ms, curvas < 0,5 ms).
- O RNNoise já é WASM SIMD, um worklet por microfone e o binário decodificado
  uma vez por app; não mudou.

## Consequências

- Mexeu em `native/concord-dsp/`: rode `scripts/build-dsp-wasm.sh` e commite o
  `.wasm` e o manifesto. O `scripts/dsp-wasm.test.mjs` (que o
  `affected-tests` roda quando o crate ou o `.wasm` mudam) falha se o fonte
  mudou sem rebuild ou se o `.wasm` não é o do manifesto;
  `scripts/build-dsp-wasm.sh --check` recompila e compara byte a byte.
- Mudança no algoritmo vale para os dois lados: o JS é o fallback e a
  referência do teste de equivalência.
- O CI continua sem Rust; quem só mexe no frontend não precisa de Docker.

## Fontes

- WebAssembly no AudioWorklet (padrão de passar o módulo ao worklet):
  <https://developer.chrome.com/blog/audio-worklet-design-pattern>
- Rust e `wasm32-unknown-unknown` sem wasm-bindgen:
  <https://doc.rust-lang.org/rustc/platform-support/wasm32-unknown-unknown.html>
- `@sapphi-red/web-noise-suppressor` (como o RNNoise é carregado hoje).
