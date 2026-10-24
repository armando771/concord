#!/usr/bin/env bash
# Vigia do túnel: o agente do playit às vezes perde a sessão e continua
# "rodando" sem repassar nada. Testa o endereço público (PUBLIC_URL do
# backend/.env) e reinicia o serviço concord-playit após 2 falhas seguidas.
# Rodado a cada minuto pelo timer concord-playit-watchdog.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# PLAYIT_URL: endereço do túnel (se o PUBLIC_URL já for outro, ex.: VPS).
PUBLIC_URL="$(grep -E '^PLAYIT_URL=' "$ROOT/backend/.env" | cut -d= -f2-)"
[[ -z "$PUBLIC_URL" ]] && PUBLIC_URL="$(grep -E '^PUBLIC_URL=' "$ROOT/backend/.env" | cut -d= -f2-)"
STATE="${XDG_RUNTIME_DIR:-/tmp}/concord-playit-failures"

if [[ -z "$PUBLIC_URL" ]]; then
  echo "PUBLIC_URL não definido em backend/.env" >&2
  exit 0
fi

# /rtc/validate sem token responde 401 quando o caminho todo está de pé.
code="$(curl -s -m 10 -o /dev/null -w '%{http_code}' "$PUBLIC_URL/rtc/validate")"
if [[ "$code" == "401" ]]; then
  rm -f "$STATE"
  exit 0
fi

failures=$(( $(cat "$STATE" 2>/dev/null || echo 0) + 1 ))
echo "$failures" > "$STATE"
echo "túnel sem resposta (http $code), falha $failures"

if (( failures >= 2 )); then
  # Só reinicia o playit se o backend local estiver ok (senão o problema é outro).
  port="$(grep -E '^PORT=' "$ROOT/backend/.env" | cut -d= -f2-)"
  local_code="$(curl -s -m 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:${port:-8080}/rtc/validate")"
  if [[ "$local_code" == "401" ]]; then
    echo "reiniciando concord-playit"
    systemctl --user restart concord-playit
  else
    echo "backend local também não responde (http $local_code) — não reiniciei o playit"
  fi
  rm -f "$STATE"
fi
