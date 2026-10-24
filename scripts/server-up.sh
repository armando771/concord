#!/usr/bin/env bash
# Sobe o servidor do Concord neste PC: Postgres + LiveKit (Docker) e o backend Go.
#
#   scripts/server-up.sh
#
# Configuração em backend/.env (veja backend/.env.example). Ctrl+C para o
# backend; o Docker continua rodando (docker compose -f backend/docker-compose.yml down).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/backend"

if [[ ! -f .env ]]; then
  echo "backend/.env não existe — copie backend/.env.example e ajuste." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ -z "${LIVEKIT_NODE_IP:-}" ]]; then
  echo "aviso: LIVEKIT_NODE_IP vazio — chamadas só funcionam na rede local." >&2
  echo "       Para amigos de fora: scripts/playit-ip.sh <endereço-do-túnel-udp>" >&2
fi

docker compose up -d
echo "Esperando o LiveKit…"
for _ in $(seq 1 30); do
  curl -sf "http://127.0.0.1:${LIVEKIT_PORT:-7880}" >/dev/null && break
  sleep 1
done

go build -o "$ROOT/backend/concord-server" ./cmd
echo "Backend em :${PORT:-8080}"
exec "$ROOT/backend/concord-server"
