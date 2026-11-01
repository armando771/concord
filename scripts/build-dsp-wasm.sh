#!/usr/bin/env bash
# Compila native/concord-dsp (Rust) para WebAssembly e grava o .wasm que o app
# usa nos AudioWorklets, com o manifesto que amarra o .wasm ao fonte.
#
#   scripts/build-dsp-wasm.sh          # testa (cargo test), compila e grava
#   scripts/build-dsp-wasm.sh --check  # recompila e confere que o .wasm commitado é o mesmo
#
# Roda dentro do Docker (imagem rust oficial fixada pelo digest + o alvo
# wasm32-unknown-unknown): nada é instalado na máquina, e o frontend/CI não
# precisa de Rust (o .wasm vai commitado). Ver docs/adr/0005-dsp-de-audio-em-wasm.md.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRATE="$ROOT/native/concord-dsp"
WASM="$ROOT/frontend/src/renderer/src/features/call/lib/concordDsp.wasm"
MODE="${1:-build}"

docker build -q -t concord-rust-wasm "$CRATE" >/dev/null
docker run --rm \
  -v "$CRATE:/src" \
  -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
  -w /src concord-rust-wasm \
  bash -euo pipefail -c '
    cargo test --release --quiet
    cargo build --release --locked --target wasm32-unknown-unknown
    chown -R "$HOST_UID:$HOST_GID" target Cargo.lock
  '
BUILT="$CRATE/target/wasm32-unknown-unknown/release/concord_dsp.wasm"

if [[ "$MODE" == "--check" ]]; then
  if ! cmp -s "$BUILT" "$WASM"; then
    echo "❌ o .wasm commitado não é o que o fonte gera: rode scripts/build-dsp-wasm.sh" >&2
    exit 1
  fi
  node "$ROOT/scripts/dsp-wasm.mjs" check
  echo "✅ concordDsp.wasm confere com o fonte."
  exit 0
fi

cp "$BUILT" "$WASM"
node "$ROOT/scripts/dsp-wasm.mjs" write
ls -l "$WASM"
