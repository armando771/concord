#!/usr/bin/env bash
# Gera o Concord para Windows com o endereço do servidor embutido.
#
#   scripts/build-win.sh http://SEU-ENDERECO.ply.gg:PORTA
#
# Saída em frontend/dist/: Concord-<versão>-portable.exe (é só abrir) e
# Concord-<versão>-setup.exe (instalador). Roda dentro do Docker
# (electronuserland/builder:wine) para não precisar de wine na máquina.
set -euo pipefail

SERVER_URL="${1:-}"
if [[ -z "$SERVER_URL" ]]; then
  echo "uso: $0 http://endereco-publico:porta" >&2
  exit 1
fi
if [[ ! "$SERVER_URL" =~ ^https?:// ]]; then
  echo "o endereço precisa começar com http:// ou https:// (recebido: $SERVER_URL)" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$ROOT/frontend/dist"

# O projeto é copiado para dentro do container (sem node_modules do host) e só
# o resultado volta para frontend/dist — nada criado como root no repositório.
docker run --rm \
  -v "$ROOT/frontend:/src:ro" \
  -v "$ROOT/frontend/dist:/out" \
  -v concord-builder-cache:/root/.cache \
  -e VITE_SERVER_URL="$SERVER_URL" \
  -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
  electronuserland/builder:wine \
  bash -euo pipefail -c '
    mkdir -p /work && cd /src
    tar --exclude=./node_modules --exclude=./out --exclude=./dist -cf - . | tar -xf - -C /work
    cd /work
    yarn install --frozen-lockfile --ignore-scripts
    yarn electron-vite build
    yarn electron-builder --win portable nsis --x64 --publish never
    cp dist/*.exe /out/
    chown "$HOST_UID:$HOST_GID" /out/*.exe
  '

echo
echo "Pronto. Servidor embutido: $SERVER_URL"
ls -lh "$ROOT"/frontend/dist/*.exe
