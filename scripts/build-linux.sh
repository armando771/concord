#!/usr/bin/env bash
# Gera AppImage x64 + latest-linux.yml, sem dependências/node_modules do host.
# Uso: scripts/build-linux.sh https://endereco-publico
set -euo pipefail

SERVER_URL="${1:-}"
if [[ ! "$SERVER_URL" =~ ^https?:// ]]; then
  echo "uso: $0 http(s)://endereco-publico" >&2
  exit 1
fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$ROOT/frontend/dist"

docker run --rm --platform linux/amd64 \
  -v "$ROOT/frontend:/src:ro" \
  -v "$ROOT/frontend/dist:/out" \
  -v concord-builder-linux-cache:/root/.cache \
  -e VITE_SERVER_URL="$SERVER_URL" \
  -e CONCORD_UPDATE_URL="${SERVER_URL%/}/updates/" \
  -e CONCORD_UPDATE_PUBKEY="${CONCORD_UPDATE_PUBKEY:-}" \
  -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
  electronuserland/builder:22 \
  bash -euo pipefail -c '
    mkdir -p /work && cd /src
    tar --exclude=./node_modules --exclude=./out --exclude=./dist -cf - . | tar -xf - -C /work
    cd /work
    yarn install --frozen-lockfile --ignore-scripts
    yarn build
    yarn electron-builder --linux AppImage --x64 --publish never
    cp dist/*.AppImage dist/latest-linux.yml /out/
    chown "$HOST_UID:$HOST_GID" /out/*.AppImage /out/latest-linux.yml
  '

echo "AppImage gerado em frontend/dist (servidor: $SERVER_URL)"
