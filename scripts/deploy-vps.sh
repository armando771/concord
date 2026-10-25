#!/usr/bin/env bash
# Atualiza o servidor da Salinha numa VPS (Debian/Ubuntu com Docker e Caddy).
#
#   scripts/deploy-vps.sh root@IP
#   scripts/deploy-vps.sh --infra root@IP   # aplica mudanças do Postgres/LiveKit
#
# Envia o backend (binário Linux), migrations, docker-compose.yml, a página
# de download (site/) e as atualizações do app (backend/updates, geradas por
# release-win.sh/release-linux.sh) para /opt/concord e reinicia o backend. Reiniciar não derruba chamadas: o
# backend recarrega as chamadas ativas, e a mídia e a sinalização (/rtc, que o
# Caddy manda direto para o LiveKit — deploy/Caddyfile) seguem no LiveKit.
# O Caddyfile da VPS não é enviado (mudá-lo é manual; veja docs/HOSPEDAGEM.md).
# O .env da VPS (/opt/concord/.env) não é tocado.
# A mídia do chat (/opt/concord/uploads) nunca é enviada nem apagada pelo deploy.
#
# Postgres e LiveKit nunca são recriados num deploy normal: recriar o LiveKit
# derruba todas as chamadas (as salas só existem na memória dele). Se o
# docker-compose.yml (ou o .env que ele usa) mudou algo que exigiria recriar
# um deles, o deploy avisa, mantém o compose antigo e segue só com o backend.
# Para aplicar, rode de novo com --infra quando ninguém estiver em chamada.
set -euo pipefail

INFRA=0
HOST=""
for arg in "$@"; do
  case "$arg" in
    --infra) INFRA=1 ;;
    -*) echo "opção desconhecida: $arg" >&2; exit 1 ;;
    *) HOST="$arg" ;;
  esac
done
if [[ -z "$HOST" ]]; then
  echo "uso: $0 [--infra] usuario@servidor" >&2
  exit 1
fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="$(mktemp)"
trap 'rm -f "$BIN"' EXIT

(cd "$ROOT/backend" && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o "$BIN" ./cmd)
ssh "$HOST" 'mkdir -p /opt/concord/updates /opt/concord/uploads'
rsync -az "$BIN" "$HOST:/opt/concord/concord-server.new"
rsync -az --delete "$ROOT/backend/migrations/" "$HOST:/opt/concord/migrations/"
# O compose novo só substitui o atual se não recriar nada (ver abaixo).
rsync -az "$ROOT/backend/docker-compose.yml" "$HOST:/opt/concord/docker-compose.yml.new"
rsync -az --delete --chmod=D755,F644 "$ROOT/site/" "$HOST:/opt/concord/site/"
# Manifestos por último: cada app só vê a versão nova com binário e assinatura no ar.
rsync -az --exclude latest.yml --exclude latest-linux.yml "$ROOT/backend/updates/" "$HOST:/opt/concord/updates/"
for manifest in latest.yml latest-linux.yml; do
  if [[ -f "$ROOT/backend/updates/$manifest" ]]; then
    rsync -az "$ROOT/backend/updates/$manifest" "$HOST:/opt/concord/updates/"
  fi
done
# Guarda só os 3 instaladores mais recentes (cada um tem ~120 MB). Concord-* é
# o nome antigo do app.
ssh "$HOST" 'cd /opt/concord/updates && ls -t Salinha-*-setup.exe Concord-*-setup.exe 2>/dev/null | tail -n +4 | while read -r f; do rm -f "$f" "$f.blockmap" "$f.sig"; done'
ssh "$HOST" 'cd /opt/concord/updates && ls -t Salinha-*-x64.AppImage 2>/dev/null | tail -n +4 | while read -r f; do rm -f "$f" "$f.sig"; done'

# Postgres/LiveKit: compara o hash da configuração nova de cada serviço (o que
# o Compose usa para decidir recriar) com o dos containers rodando.
ssh "$HOST" bash -s -- "$INFRA" "${GITHUB_ACTIONS:-}" <<'REMOTE'
set -euo pipefail
INFRA="$1"
CI="$2"
cd /opt/concord
running=$(for id in $(docker compose -f docker-compose.yml.new ps -aq); do
  docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}} {{index .Config.Labels "com.docker.compose.config-hash"}}' "$id"
done)
changed=""
while read -r service hash; do
  [[ -z "$service" ]] && continue
  current=$(awk -v s="$service" '$1 == s { print $2 }' <<<"$running")
  if [[ -n "$current" && "$current" != "$hash" ]]; then
    changed="$changed $service"
  fi
done < <(docker compose -f docker-compose.yml.new config --hash '*')

if [[ -n "$changed" && "$INFRA" != 1 ]]; then
  msg="docker-compose.yml/.env mudou:$changed. NÃO recriei (derrubaria as chamadas). Rode scripts/deploy-vps.sh --infra quando ninguém estiver em chamada."
  if [[ -n "$CI" ]]; then echo "::warning::$msg"; else echo "AVISO: $msg" >&2; fi
  rm -f docker-compose.yml.new
else
  mv docker-compose.yml.new docker-compose.yml
  if [[ -n "$changed" ]]; then
    echo "--infra: recriando$changed (as chamadas em andamento caem)."
    docker compose pull --quiet
    docker compose up -d
  fi
fi
# Sobe o que estiver parado ou faltando, sem recriar o que já roda.
docker compose up -d --no-recreate
REMOTE

# Aplica as migrations com o binário novo ANTES de reiniciar, com o antigo
# ainda no ar (por isso as migrations precisam ser compatíveis com ele — veja
# "Migrations" em docs/HOSPEDAGEM.md). Se falharem, nada é reiniciado. Depois
# reinicia e espera o /healthz (banco no ar e chamadas recarregadas); durante o
# reinício o Caddy segura as requisições (deploy/Caddyfile). O binário anterior
# fica em concord-server.prev para voltar atrás.
ssh "$HOST" bash -s <<'REMOTE'
set -euo pipefail
cd /opt/concord
chmod +x concord-server.new
if ! ./concord-server.new migrate; then
  echo "migrations falharam: o backend no ar não foi tocado" >&2
  exit 1
fi
if [[ -f concord-server ]]; then cp -f concord-server concord-server.prev; fi
mv concord-server.new concord-server
systemctl restart concord-server
port=$(sed -n 's/^PORT=//p' .env | tail -n 1 | tr -d "\"' \r")
for _ in $(seq 1 60); do
  if curl -fs -o /dev/null "http://127.0.0.1:${port:-8080}/healthz"; then
    echo "backend no ar (/healthz ok)"
    exit 0
  fi
  sleep 0.5
done
echo "backend não respondeu /healthz em 30 s" >&2
journalctl -u concord-server -n 30 --no-pager >&2 || true
exit 1
REMOTE
