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
# O pacote é conferido com sha512 e, com OpenSSL 3, com a assinatura Ed25519
# da Salinha (a chave pública vem embutida abaixo pelo deploy). Sem OpenSSL 3
# só aceita HTTPS. Rodar de novo reinstala a versão mais recente.
#
# Para remover:
#   rm -rf ~/.local/share/salinha ~/.local/bin/salinha \
#     ~/.local/share/applications/salinha.desktop
#   sudo rm -f /etc/apparmor.d/salinha   # se instalou o perfil do AppArmor
# (login e configurações ficam em ~/.config/Concord.)
#
# Variáveis: SALINHA_URL (outro servidor), XDG_DATA_HOME, SALINHA_APPARMOR=s/n
# (responde a pergunta do perfil do AppArmor sem terminal).
#
# Tudo fica dentro de main(), chamada na última linha: se o download deste
# script for cortado no meio, nada roda.

# Chave pública Ed25519 que assina as atualizações (deploy-vps.sh preenche).
SALINHA_PUBKEY='
@@SALINHA_PUBKEY@@
'

main() {
  set -eu

  BASE="${SALINHA_URL:-https://salinha.bhrx.com.br}"
  BASE="${BASE%/}"
  UPDATES="$BASE/updates"
  PROC_SYS="${SALINHA_PROC_SYS:-/proc/sys}"
  APPARMOR_D="${SALINHA_APPARMOR_D:-/etc/apparmor.d}"

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

  if pgrep -f "$ROOT/versions/" >/dev/null 2>&1 || pgrep -f "$HOME/.local/opt/salinha/salinha" >/dev/null 2>&1; then
    echo "Aviso: a Salinha está aberta. Feche-a (inclusive a antiga) antes de continuar, ou abra de novo depois." >&2
  fi

  mkdir -p "$ROOT/downloads" "$ROOT/versions"
  # Downloads na raiz da instalação (não em /tmp, que costuma ser pequeno).
  TMP=$(mktemp -d "$ROOT/downloads/.install.XXXXXX") || die "não consegui criar pasta temporária."
  trap 'rm -rf "$TMP"' EXIT INT TERM

  echo "Buscando a versão mais recente em $UPDATES/ ..."
  fetch "$UPDATES/latest-linux-tar.yml" "$TMP/manifest" || die "não consegui baixar $UPDATES/latest-linux-tar.yml."
  VERSION=$(field version)
  FILE=$(field path)
  SHA512=$(field sha512 | tr 'A-F' 'a-f')
  SIZE=$(field size)

  echo "$VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || die "manifesto inválido (versão)."
  [ "$FILE" = "Salinha-$VERSION-x64.tar.gz" ] || die "manifesto inválido (arquivo)."
  echo "$SHA512" | grep -Eq '^[0-9a-f]{128}$' || die "manifesto inválido (sha512)."
  echo "$SIZE" | grep -Eq '^[0-9]+$' || die "manifesto inválido (tamanho)."
  [ "$SIZE" -le 1073741824 ] || die "manifesto inválido (tamanho)."

  echo "Baixando Salinha $VERSION ($((SIZE / 1024 / 1024)) MB)..."
  fetch "$UPDATES/$FILE" "$TMP/$FILE" || die "download falhou."
  [ "$(wc -c <"$TMP/$FILE" | tr -d ' ')" = "$SIZE" ] || die "download incompleto (tamanho não confere)."
  [ "$(sha512_of "$TMP/$FILE")" = "$SHA512" ] || die "download corrompido (sha512 não confere)."

  if verify_signature "$TMP/$FILE"; then
    echo "Assinatura da Salinha conferida."
  else
    case "$BASE" in
    https://*) echo "Aviso: sem OpenSSL 3 (ou sem a chave), conferido só o sha512 pelo HTTPS." >&2 ;;
    *) die "sem HTTPS e sem conferir a assinatura (precisa do OpenSSL 3) não dá para instalar com segurança." ;;
    esac
  fi

  DEST="$ROOT/versions/$VERSION"
  STAGE="$ROOT/versions/.staging-$VERSION-$$"
  rm -rf "$STAGE"
  mkdir -p "$STAGE"
  tar -x --no-same-owner -zf "$TMP/$FILE" -C "$STAGE" || {
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
    [ -n "$OLD" ] && relink "$OLD" "$ROOT/previous"
    relink "versions/$VERSION" "$ROOT/current"
  fi
  rm -f "$ROOT/boot-pending"
  # Reinstalar à mão é uma escolha: esquece as versões que tinham voltado atrás.
  rm -f "$ROOT/bad-versions"

  "$ROOT/current/salinha-launcher" --integrate || die "não consegui criar o atalho (veja $ROOT/launcher.log)."

  offer_apparmor_profile

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
}

die() {
  echo "salinha: $*" >&2
  exit 1
}

field() { awk -v k="$1:" '$1 == k { print $2; exit }' "$TMP/manifest" | tr -d "\"'\r"; }

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

# Troca um link de forma atômica (mv -T por cima); sem -T, ln -sfn.
relink() {
  tmp="$2.new.$$"
  if ln -s "$1" "$tmp" 2>/dev/null && mv -Tf "$tmp" "$2" 2>/dev/null; then
    return 0
  fi
  rm -f "$tmp"
  ln -sfn "$1" "$2"
}

# 0 = assinatura Ed25519 conferida; 1 = não dá para conferir aqui (sem OpenSSL 3
# ou sem chave embutida); assinatura errada encerra.
verify_signature() {
  case "$SALINHA_PUBKEY" in *"BEGIN PUBLIC KEY"*) ;; *) return 1 ;; esac
  command -v openssl >/dev/null 2>&1 || return 1
  openssl pkeyutl -help 2>&1 | grep -q -- '-rawin' || return 1
  fetch "$UPDATES/$FILE.sig" "$TMP/sig.b64" || die "assinatura não encontrada ($UPDATES/$FILE.sig)."
  printf '%s\n' "$SALINHA_PUBKEY" | sed '/^$/d' >"$TMP/pub.pem"
  if ! base64 -d <"$TMP/sig.b64" >"$TMP/sig.bin" 2>/dev/null; then
    openssl base64 -d -A -in "$TMP/sig.b64" -out "$TMP/sig.bin" 2>/dev/null || die "assinatura ilegível."
  fi
  openssl pkeyutl -verify -pubin -inkey "$TMP/pub.pem" -rawin -in "$1" \
    -sigfile "$TMP/sig.bin" >/dev/null 2>&1 || die "assinatura inválida: o pacote não é da Salinha. Nada foi instalado."
  return 0
}

# Ubuntu 24.04+: o AppArmor restringe user namespaces e o sandbox do Chromium
# não funciona sem root. Um perfil mínimo para o binário desta instalação
# devolve a proteção; precisa de sudo uma vez. Sem ele o app abre sem sandbox
# e avisa.
offer_apparmor_profile() {
  [ "$(cat "$PROC_SYS/kernel/apparmor_restrict_unprivileged_userns" 2>/dev/null)" = 1 ] || return 0
  profile="$APPARMOR_D/salinha"
  binary="$ROOT/versions/*/salinha"
  grep -qF "\"$binary\"" "$profile" 2>/dev/null && return 0
  answer="${SALINHA_APPARMOR:-}"
  if [ -z "$answer" ]; then
    # curl | sh: a entrada é o próprio script; a pergunta vai pelo terminal.
    if (: </dev/tty) 2>/dev/null; then
      printf 'Instalar perfil do AppArmor para manter a proteção (sandbox)? Precisa de sudo. [s/N] ' >/dev/tty
      read -r answer </dev/tty || answer=''
    fi
  fi
  case "$answer" in
  s | S | sim | Sim | y | Y | yes) ;;
  *)
    echo "Sem o perfil do AppArmor a Salinha abre sem a proteção do navegador (sandbox)."
    echo "Para ativar depois, rode este instalador de novo e responda s, ou veja https://salinha.bhrx.com.br/#sandbox"
    return 0
    ;;
  esac
  command -v sudo >/dev/null 2>&1 || {
    echo "sudo não encontrado: perfil do AppArmor não instalado." >&2
    return 0
  }
  {
    echo '# Perfil da Salinha (install.sh): libera user namespaces só para o app,'
    echo '# para o sandbox do Chromium funcionar sem o chrome-sandbox SUID.'
    echo 'abi <abi/4.0>,'
    echo 'include <tunables/global>'
    echo
    echo "profile salinha \"$binary\" flags=(unconfined) {"
    echo '  userns,'
    echo
    echo '  include if exists <local/salinha>'
    echo '}'
  } >"$TMP/apparmor-salinha"
  if sudo install -m 644 "$TMP/apparmor-salinha" "$profile" && sudo apparmor_parser -r "$profile"; then
    echo "Perfil do AppArmor instalado em $profile: a Salinha abre com o sandbox."
  else
    echo "Não consegui instalar o perfil do AppArmor; a Salinha abre sem o sandbox." >&2
  fi
}

main "$@"
