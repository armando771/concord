#!/bin/sh
# Instala a Salinha para Linux x64 na sua pasta de usuário — sem root, sem
# FUSE, sem pacote nenhum. Depois disso o app se atualiza sozinho.
#
#   curl -fsSL https://salinha.bhrx.com.br/install.sh | sh
#
# Onde fica:
#   ~/.local/share/salinha/versions/<versão>/  o app (um .tar.gz por versão)
#   ~/.local/share/salinha/current             link para a versão em uso
#   ~/.local/bin/salinha                       comando para abrir
#   ~/.local/share/applications/salinha.desktop atalho no menu
#
# Rodar de novo reinstala a versão mais recente. Para remover:
#   rm -rf ~/.local/share/salinha ~/.local/bin/salinha \
#     ~/.local/share/applications/salinha.desktop
# (login e configurações ficam em ~/.config/Concord.)
#
# Variáveis: SALINHA_URL (outro servidor), XDG_DATA_HOME.
set -eu

BASE="${SALINHA_URL:-https://salinha.bhrx.com.br}"
BASE="${BASE%/}"
UPDATES="$BASE/updates"

die() {
  echo "salinha: $*" >&2
  exit 1
}

[ "$(uname -s)" = Linux ] || die "este instalador é para Linux."
[ "$(uname -m)" = x86_64 ] || die "só há versão para Linux x64 (esta máquina é $(uname -m))."
if [ "$(id -u)" = 0 ] && [ -z "${SALINHA_ALLOW_ROOT:-}" ]; then
  die "rode como o seu usuário, sem sudo: a Salinha instala na sua pasta pessoal."
fi
[ -n "${HOME:-}" ] || die "HOME não definido."

DATA="${XDG_DATA_HOME:-}"
case "$DATA" in /*) ;; *) DATA="$HOME/.local/share" ;; esac
ROOT="$DATA/salinha"

if command -v curl >/dev/null 2>&1; then
  fetch() { curl -fsSL --retry 3 -o "$2" "$1"; }
elif command -v wget >/dev/null 2>&1; then
  fetch() { wget -q -O "$2" "$1"; }
else
  die "precisa de curl ou wget para baixar."
fi
command -v tar >/dev/null 2>&1 || die "precisa do tar."

sha512_of() {
  if command -v sha512sum >/dev/null 2>&1; then
    sha512sum "$1" | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 512 "$1" | cut -d' ' -f1
  elif command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha512 -r "$1" | cut -d' ' -f1
  else
    die "precisa de sha512sum (coreutils) para conferir o download."
  fi
}

TMP=$(mktemp -d "${TMPDIR:-/tmp}/salinha-install.XXXXXX") || die "não consegui criar pasta temporária."
trap 'rm -rf "$TMP"' EXIT INT TERM

echo "Buscando a versão mais recente em $UPDATES/ ..."
fetch "$UPDATES/latest-linux-tar.yml" "$TMP/manifest" || die "não consegui baixar $UPDATES/latest-linux-tar.yml."
field() { awk -v k="$1:" '$1 == k { print $2; exit }' "$TMP/manifest" | tr -d "\"'\r"; }
VERSION=$(field version)
FILE=$(field path)
SHA512=$(field sha512 | tr 'A-F' 'a-f')
SIZE=$(field size)

echo "$VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || die "manifesto inválido (versão)."
[ "$FILE" = "Salinha-$VERSION-x64.tar.gz" ] || die "manifesto inválido (arquivo)."
echo "$SHA512" | grep -Eq '^[0-9a-f]{128}$' || die "manifesto inválido (sha512)."
echo "$SIZE" | grep -Eq '^[0-9]+$' || die "manifesto inválido (tamanho)."

echo "Baixando Salinha $VERSION ($((SIZE / 1024 / 1024)) MB)..."
fetch "$UPDATES/$FILE" "$TMP/$FILE" || die "download falhou."
[ "$(wc -c <"$TMP/$FILE" | tr -d ' ')" = "$SIZE" ] || die "download incompleto (tamanho não confere)."
[ "$(sha512_of "$TMP/$FILE")" = "$SHA512" ] || die "download corrompido (sha512 não confere)."

mkdir -p "$ROOT/versions"
DEST="$ROOT/versions/$VERSION"
STAGE="$ROOT/versions/.staging-$VERSION-$$"
rm -rf "$STAGE"
mkdir -p "$STAGE"
tar -xzf "$TMP/$FILE" -C "$STAGE" || {
  rm -rf "$STAGE"
  die "não consegui extrair o pacote."
}
if [ "$(cat "$STAGE/salinha-version" 2>/dev/null)" != "$VERSION" ] ||
  [ ! -x "$STAGE/salinha" ] || [ ! -x "$STAGE/salinha-launcher" ]; then
  rm -rf "$STAGE"
  die "pacote incompleto ou de outra versão."
fi

OLD=$(readlink "$ROOT/current" 2>/dev/null || true)
if [ "$OLD" = "versions/$VERSION" ]; then
  # Reinstalando a mesma versão: troca a pasta sem deixar current quebrado.
  [ -e "$DEST" ] && mv "$DEST" "$ROOT/versions/.staging-old-$VERSION-$$"
  mv "$STAGE" "$DEST"
  rm -rf "$ROOT/versions/.staging-old-$VERSION-$$"
else
  rm -rf "$DEST"
  mv "$STAGE" "$DEST"
  [ -n "$OLD" ] && ln -sfn "$OLD" "$ROOT/previous"
  ln -sfn "versions/$VERSION" "$ROOT/current"
fi
rm -f "$ROOT/boot-pending"

"$ROOT/current/salinha-launcher" --integrate || die "não consegui criar o atalho (veja $ROOT/launcher.log)."

echo
echo "Salinha $VERSION instalada em $ROOT"
echo "Abra pelo menu de aplicativos (Salinha) ou com o comando: salinha"
case ":$PATH:" in
*":$HOME/.local/bin:"*) ;;
*) echo "(~/.local/bin não está no seu PATH: use $HOME/.local/bin/salinha)" ;;
esac
for legacy in "$HOME/.local/opt/salinha" "$HOME/Applications/squashfs-root"; do
  if [ -f "$legacy/AppRun" ] && [ -x "$legacy/salinha" ]; then
    echo
    echo "Encontrei uma Salinha antiga (AppImage extraído) em $legacy."
    echo "Ela não é mais usada; feche-a e, se quiser, apague com: rm -rf '$legacy'"
  fi
done
echo "Se a Salinha antiga estiver aberta, feche-a antes de abrir a nova."
