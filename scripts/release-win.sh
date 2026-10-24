#!/usr/bin/env bash
# Publica uma nova versão do Concord para Windows com atualização automática.
#
#   scripts/release-win.sh [versão]          # ex.: 0.2.0 (padrão: próximo patch)
#
# 1. Na primeira vez, gera a chave de assinatura (backend/.release-key — NÃO
#    perca nem compartilhe; sem ela os apps instalados não aceitam updates).
# 2. Sobe a versão em frontend/package.json.
# 3. Gera o instalador com o endereço do servidor (PUBLIC_URL do backend/.env)
#    e a chave pública embutidos, e assina o instalador.
# 4. Copia latest.yml, instalador, .blockmap e .sig para a pasta servida em
#    /updates/ — os apps abertos baixam sozinhos.
#
# Quem ainda usa uma versão sem auto-update precisa instalar o -setup.exe
# gerado aqui uma vez.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/backend/.env"
KEY="$ROOT/backend/.release-key"

env_value() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true; }

# PUBLIC_URL e UPDATES_DIR podem vir do ambiente (CI) ou do backend/.env.
SERVER_URL="${PUBLIC_URL:-$(env_value PUBLIC_URL)}"
if [[ -z "$SERVER_URL" ]]; then
  echo "defina PUBLIC_URL em backend/.env (endereço público do backend)" >&2
  exit 1
fi
UPDATES_DIR="${UPDATES_DIR:-$(env_value UPDATES_DIR)}"
UPDATES_DIR="$ROOT/backend/${UPDATES_DIR:-updates}"

if [[ ! -f "$KEY" ]]; then
  # No CI a chave vem de um secret: gerar outra quebraria os apps instalados.
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
VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  VERSION="$(node -p "const [a,b,c]=require('./package.json').version.split('.').map(Number); [a,b,c+1].join('.')")"
fi
node -e "
  const fs = require('fs')
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  pkg.version = process.argv[1]
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
" "$VERSION"
echo "Versão $VERSION"

rm -f dist/latest.yml dist/*.blockmap
CONCORD_UPDATE_PUBKEY="$PUBKEY" BUILD_TARGETS="nsis" "$ROOT/scripts/build-win.sh" "$SERVER_URL"

INSTALLER="dist/Concord-$VERSION-setup.exe"
if [[ ! -f "$INSTALLER" || ! -f dist/latest.yml ]]; then
  echo "build não gerou $INSTALLER e latest.yml" >&2
  exit 1
fi
openssl pkeyutl -sign -inkey "$KEY" -rawin -in "$INSTALLER" | base64 -w0 > "$INSTALLER.sig"

mkdir -p "$UPDATES_DIR"
cp "$INSTALLER" "$INSTALLER.blockmap" "$INSTALLER.sig" "$UPDATES_DIR/"
# latest.yml por último: os apps só enxergam a versão nova quando tudo já está lá.
cp dist/latest.yml "$UPDATES_DIR/latest.yml"

echo
echo "Publicado: Concord $VERSION em $SERVER_URL/updates/"
echo "Instalador para quem ainda não tem auto-update: frontend/$INSTALLER"
echo "Lembre de commitar a nova versão em frontend/package.json."
