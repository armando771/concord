# Imagem para compilar o DSP para WebAssembly (scripts/build-dsp-wasm.sh).
# A imagem base vai fixada pelo digest (rustc 1.99.1): o mesmo fonte gera o
# mesmo .wasm, byte a byte, em qualquer máquina com Docker.
FROM rust:1-bookworm@sha256:48b7f435b8fc6378ce43b44f15e3a47fd8919b2825f835c39bd4bd3da50af5b8
RUN rustup target add wasm32-unknown-unknown
