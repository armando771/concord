#!/usr/bin/env bash
# Aplica um Caddyfile na VPS com segurança (ver o cabeçalho de deploy/Caddyfile).
#
#   scripts/apply-caddyfile.sh root@IP deploy/Caddyfile
#   scripts/apply-caddyfile.sh --also https://app-salinha.bhrx.com.br root@IP deploy/Caddyfile
#   scripts/apply-caddyfile.sh --force root@IP deploy/Caddyfile   # mesmo com gente em chamada
#
# --also URL (pode repetir): outro endereço que serve o app; também tem que
# responder /rtc/validate=401 (LiveKit) depois do reload.
#
# Na VPS, na ordem: valida o arquivo com o caddy; confere que o backend está no
# ar (/healthz); confere que ninguém está em chamada (o primeiro reload com o
# Caddyfile novo fecha todos os WebSockets); guarda backup do atual; instala e
# recarrega; testa /rtc/validate (401 = LiveKit), /healthz e /updates pelo
# endereço público. Se o reload ou um teste falhar, volta o backup.
set -euo pipefail

FORCE=0
ALSO=""
ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE=1 ;;
    --also) ALSO="$ALSO ${2:?--also precisa de uma URL}"; shift ;;
    -*) echo "opção desconhecida: $1" >&2; exit 1 ;;
    *) ARGS+=("$1") ;;
  esac
  shift
done
if [[ ${#ARGS[@]} -ne 2 || ! -f "${ARGS[1]}" ]]; then
  echo "uso: $0 [--force] usuario@servidor Caddyfile" >&2
  exit 1
fi
HOST="${ARGS[0]}"
FILE="${ARGS[1]}"

CADDY_DIR="${CADDY_DIR:-/etc/caddy}"
CONCORD_DIR="${CONCORD_DIR:-/opt/concord}"

# O ssh junta os argumentos num texto só (um argumento vazio some e um com
# espaços se parte): os valores vão como VAR=valor já citados.
remote() {
  local assigns="" kv
  for kv in "$@"; do
    assigns+="${kv%%=*}=$(printf '%q' "${kv#*=}") "
  done
  ssh "$HOST" "${assigns}bash -s"
}

ssh "$HOST" "cat > $(printf '%q' "$CADDY_DIR/Caddyfile.new")" < "$FILE"
remote FORCE="$FORCE" ALSO="${ALSO# }" CADDY_DIR="$CADDY_DIR" CONCORD_DIR="$CONCORD_DIR" <<'REMOTE'
set -euo pipefail
NEW="$CADDY_DIR/Caddyfile.new"
CUR="$CADDY_DIR/Caddyfile"

env_value() {
  sed -n -E "s/^(export[[:space:]]+)?$1=//p" "$CONCORD_DIR/.env" | tail -n 1 |
    sed -E 's/[[:space:]]+#.*$//' | tr -d "\"' \r"
}
fail() { echo "ERRO: $*" >&2; exit 1; }

if ! out=$(caddy validate --config "$NEW" --adapter caddyfile 2>&1); then
  echo "$out" | tail -n 5 >&2
  rm -f "$NEW"
  fail "Caddyfile inválido (nada mudou)"
fi

# Com o socket do systemd a porta é a dele (o backend ignora o PORT do .env).
if systemctl is-active -q concord-server.socket 2>/dev/null; then
  listen=$(systemctl show -p Listen --value concord-server.socket | awk '{print $1}')
  port="${listen##*:}"
else
  port=$(env_value PORT)
fi
curl -fs -m 2 -o /dev/null "http://127.0.0.1:${port:-8080}/healthz" ||
  { rm -f "$NEW"; fail "backend sem /healthz em 127.0.0.1:${port:-8080} — faça o deploy do backend antes"; }

in_call=$(docker exec concord-postgres psql -U concord-user -d concord -tAc \
  "SELECT count(*) FROM call_participants p JOIN calls c ON c.id = p.call_id WHERE p.left_at IS NULL AND c.status <> 'ended'" | tr -d '[:space:]')
if [[ "$in_call" != 0 && "$FORCE" != 1 ]]; then
  rm -f "$NEW"
  fail "$in_call pessoa(s) em chamada agora — o reload derrubaria a chamada delas. Tente depois (ou --force)."
fi
echo "ninguém em chamada agora; recarregando (quem entrar numa chamada nos próximos segundos pode sentir uma travada)."

backup="$CUR.bak-$(date +%Y%m%d-%H%M%S)"
cp -p "$CUR" "$backup"
install -m 644 "$NEW" "$CUR"
rm -f "$NEW"

rollback() {
  echo "ERRO: $* — voltando $backup" >&2
  cp -p "$backup" "$CUR"
  systemctl reload caddy || systemctl restart caddy
  exit 1
}
systemctl reload caddy || rollback "reload do caddy falhou"

public=$(env_value PUBLIC_URL)
public="${public%/}"
[[ -n "$public" ]] || rollback "PUBLIC_URL vazio no $CONCORD_DIR/.env"
ok=0
for _ in $(seq 1 20); do
  rtc=$(curl -s -o /dev/null -w '%{http_code}' "$public/rtc/validate" || true)
  if [[ "$rtc" == 401 ]] && curl -fs "$public/healthz" | grep -q '"ok"'; then ok=1; break; fi
  sleep 0.5
done
[[ "$ok" == 1 ]] || rollback "$public não respondeu /rtc/validate=401 e /healthz=ok"
for url in $ALSO; do
  rtc=$(curl -s -o /dev/null -w '%{http_code}' "${url%/}/rtc/validate" || true)
  [[ "$rtc" == 401 ]] || rollback "${url%/}/rtc/validate respondeu $rtc (esperado 401, o LiveKit)"
done
if [[ -f "$CONCORD_DIR/updates/latest.yml" ]]; then
  curl -fs -o /dev/null "$public/updates/latest.yml" || rollback "$public/updates/latest.yml não abriu"
fi
echo "Caddyfile aplicado (backup em $backup)."
REMOTE
