#!/usr/bin/env bash
# Mostra o IP público de um túnel do playit, para usar em LIVEKIT_NODE_IP.
#
#   scripts/playit-ip.sh abc-def.gl.at.ply.gg
#
# Use o endereço do túnel UDP (é por ele que passa a mídia das chamadas).
set -euo pipefail

HOST="${1:-}"
HOST="${HOST%%:*}"
if [[ -z "$HOST" ]]; then
  echo "uso: $0 endereco-do-tunel.ply.gg" >&2
  exit 1
fi

IP="$(getent ahostsv4 "$HOST" | awk 'NR==1 {print $1}')"
if [[ -z "$IP" ]]; then
  echo "não consegui resolver $HOST" >&2
  exit 1
fi
echo "$IP"
