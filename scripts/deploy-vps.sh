#!/usr/bin/env bash
# Atualiza o servidor da Salinha numa VPS (Debian/Ubuntu com Docker e Caddy).
#
#   scripts/deploy-vps.sh root@IP
#
# Envia o backend (binário Linux), migrations, docker-compose.yml, a página
# de download (site/) e as atualizações do app (backend/updates, geradas por
# release-win.sh) para /opt/concord e reinicia o backend. Reiniciar não derruba chamadas: o
# backend recarrega as chamadas ativas e a mídia segue no LiveKit.
# O .env da VPS (/opt/concord/.env) não é tocado.
set -euo pipefail

HOST="${1:-}"
if [[ -z "$HOST" ]]; then
  echo "uso: $0 usuario@servidor" >&2
  exit 1
fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="$(mktemp)"
trap 'rm -f "$BIN"' EXIT

(cd "$ROOT/backend" && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o "$BIN" ./cmd)
ssh "$HOST" 'mkdir -p /opt/concord/updates'
rsync -az "$BIN" "$HOST:/opt/concord/concord-server.new"
rsync -az --delete "$ROOT/backend/migrations/" "$HOST:/opt/concord/migrations/"
rsync -az "$ROOT/backend/docker-compose.yml" "$HOST:/opt/concord/"
rsync -az --delete --chmod=D755,F644 "$ROOT/site/" "$HOST:/opt/concord/site/"
# latest.yml por último: o app só vê a versão nova quando o instalador já está lá.
rsync -az --exclude latest.yml "$ROOT/backend/updates/" "$HOST:/opt/concord/updates/"
[[ -f "$ROOT/backend/updates/latest.yml" ]] && rsync -az "$ROOT/backend/updates/latest.yml" "$HOST:/opt/concord/updates/"
# Guarda só os 3 instaladores mais recentes (cada um tem ~120 MB). Concord-* é
# o nome antigo do app.
ssh "$HOST" 'cd /opt/concord/updates && ls -t Salinha-*-setup.exe Concord-*-setup.exe 2>/dev/null | tail -n +4 | while read -r f; do rm -f "$f" "$f.blockmap" "$f.sig"; done'
ssh "$HOST" 'cd /opt/concord && chmod +x concord-server.new && mv concord-server.new concord-server && docker compose up -d && systemctl restart concord-server && sleep 2 && systemctl is-active concord-server'
