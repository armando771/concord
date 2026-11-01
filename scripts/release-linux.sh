#!/usr/bin/env bash
# Publica a Salinha para Linux x64, assinada. Passe a mesma versão do release
# Windows. Uso: scripts/release-linux.sh [versão] (padrão: versão do package.json)
#
#   Salinha-<v>-x64.AppImage (+ .sig) + latest-linux.yml
#       AppImage montado: atualiza pelo electron-updater.
#   Salinha-<v>-x64.tar.gz (+ .sig) + latest-linux-tar.yml
#       Instalação por usuário sem FUSE (site/install.sh) e AppImage extraído:
#       atualiza pelo updater próprio (frontend/src/main/updates/linuxUpdater.ts).
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

rm -f dist/latest-linux.yml dist/latest-linux-tar.yml "dist/Salinha-$VERSION-x64.AppImage" \
  "dist/Salinha-$VERSION-x64.tar.gz"
CONCORD_UPDATE_PUBKEY="$PUBKEY" "$ROOT/scripts/build-linux.sh" "$SERVER_URL"
IMAGE="dist/Salinha-$VERSION-x64.AppImage"
TARBALL="dist/Salinha-$VERSION-x64.tar.gz"
test -f "$IMAGE"
test -f "$TARBALL"
test -f dist/latest-linux.yml
for artifact in "$IMAGE" "$TARBALL"; do
  openssl pkeyutl -sign -inkey "$KEY" -rawin -in "$artifact" | base64 -w0 > "$artifact.sig"
done
# Manifesto do .tar.gz: formato fixo `chave: valor` (parseLinuxManifest no app,
# awk no site/install.sh). sha512 em hex; a assinatura fica no .sig.
{
  echo "version: $VERSION"
  echo "path: $(basename "$TARBALL")"
  echo "sha512: $(sha512sum "$TARBALL" | cut -d' ' -f1)"
  echo "size: $(stat -c %s "$TARBALL")"
  echo "releaseDate: '$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'"
} > dist/latest-linux-tar.yml
mkdir -p "$UPDATES_DIR"
cp "$IMAGE" "$IMAGE.sig" "$TARBALL" "$TARBALL.sig" "$UPDATES_DIR/"
# Os manifestos só ficam visíveis quando os artefatos e as assinaturas estão prontos.
cp dist/latest-linux-tar.yml "$UPDATES_DIR/latest-linux-tar.yml"
cp dist/latest-linux.yml "$UPDATES_DIR/latest-linux.yml"
echo "Publicado: Salinha $VERSION (Linux x64: AppImage e .tar.gz) em $SERVER_URL/updates/"
