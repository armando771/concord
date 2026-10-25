#!/usr/bin/env bash
# Publica AppImage x64 assinado. Passe a mesma versão do release Windows.
# Uso: scripts/release-linux.sh [versão] (padrão: versão do package.json)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/backend/.env"
KEY="$ROOT/backend/.release-key"
env_value() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true; }
SERVER_URL="${PUBLIC_URL:-$(env_value PUBLIC_URL)}"
SERVER_URL="${SERVER_URL%/}"
if [[ ! "$SERVER_URL" =~ ^https?:// ]]; then
  echo "defina PUBLIC_URL com o endereço http(s) público do backend" >&2
  exit 1
fi
UPDATES_DIR="${UPDATES_DIR:-$(env_value UPDATES_DIR)}"
UPDATES_DIR="$ROOT/backend/${UPDATES_DIR:-updates}"

if [[ ! -f "$KEY" ]]; then
  if [[ -n "${CI:-}" ]]; then
    echo "chave de assinatura ausente em $KEY (secret RELEASE_KEY)" >&2
    exit 1
  fi
  echo "Gerando chave de assinatura em $KEY (guarde um backup!)"
  openssl genpkey -algorithm ed25519 -out "$KEY"
  chmod 600 "$KEY"
fi
PUBKEY="$(openssl pkey -in "$KEY" -pubout)"
cd "$ROOT/frontend"
VERSION="${1:-$(node -p "require('./package.json').version")}"
node -e '
  const fs = require("fs")
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"))
  pkg.version = process.argv[1]
  fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n")
' "$VERSION"

rm -f dist/latest-linux.yml "dist/Salinha-$VERSION-x64.AppImage"
CONCORD_UPDATE_PUBKEY="$PUBKEY" "$ROOT/scripts/build-linux.sh" "$SERVER_URL"
IMAGE="dist/Salinha-$VERSION-x64.AppImage"
test -f "$IMAGE"
test -f dist/latest-linux.yml
openssl pkeyutl -sign -inkey "$KEY" -rawin -in "$IMAGE" | base64 -w0 > "$IMAGE.sig"
mkdir -p "$UPDATES_DIR"
cp "$IMAGE" "$IMAGE.sig" "$UPDATES_DIR/"
# O manifesto só fica visível quando o artefato e a assinatura estão prontos.
cp dist/latest-linux.yml "$UPDATES_DIR/latest-linux.yml"
echo "Publicado: Salinha $VERSION (Linux x64) em $SERVER_URL/updates/"
