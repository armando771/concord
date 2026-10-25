#!/usr/bin/env bash
# Atualiza o servidor da Salinha numa VPS (Debian/Ubuntu com Docker e Caddy).
#
#   scripts/deploy-vps.sh root@IP
#   scripts/deploy-vps.sh --infra root@IP   # aplica mudanças do Postgres/LiveKit
#
# Envia o backend (binário Linux), migrations, docker-compose.yml, a página
# de download (site/), o app web (frontend/dist-web, gerado por
# `yarn build:web`) e as atualizações do app (backend/updates, geradas por
# release-win.sh/release-linux.sh) para /opt/concord e reinicia o backend.
# Reiniciar não derruba chamadas: o backend recarrega as chamadas ativas, e a
# mídia e a sinalização (/rtc, que o Caddy manda direto para o LiveKit —
# deploy/Caddyfile) seguem no LiveKit. O Caddyfile da VPS não é enviado (use
# scripts/apply-caddyfile.sh). O .env da VPS (/opt/concord/.env) não é tocado.
# A mídia do chat (/opt/concord/uploads) nunca é enviada nem apagada.
#
# Nada que está no ar é trocado antes de o binário novo passar nas checagens:
# binário, migrations e página de download vão para nomes .new e só substituem
# os atuais depois das migrations (binário) ou do /healthz (página, app web e
# manifestos do app).
#
# Postgres e LiveKit nunca são recriados num deploy normal: recriar o LiveKit
# derruba todas as chamadas (as salas só existem na memória dele). Se o
# docker-compose.yml (ou o .env que ele usa) mudou algo que exigiria recriar
# um deles, o deploy avisa, mantém o compose antigo e segue só com o backend.
# Para aplicar, rode de novo com --infra quando ninguém estiver em chamada.
#
# Variáveis (para testes): CONCORD_REMOTE_DIR (padrão /opt/concord),
# HEALTH_TIMEOUT (segundos de espera pelo /healthz, padrão 30).
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
DIR="${CONCORD_REMOTE_DIR:-/opt/concord}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-30}"
BIN="$(mktemp)"
trap 'rm -f "$BIN"' EXIT

# Roda um script bash no servidor com variáveis. O ssh junta os argumentos num
# texto só (um argumento vazio some), então os valores vão como VAR=valor já
# citados, nunca como $1/$2.
remote() {
  local assigns="" kv
  for kv in "$@"; do
    assigns+="${kv%%=*}=$(printf '%q' "${kv#*=}") "
  done
  ssh "$HOST" "${assigns}bash -s"
}
q() { printf '%q' "$1"; }

(cd "$ROOT/backend" && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o "$BIN" ./cmd)
ssh "$HOST" "mkdir -p $(q "$DIR/updates") $(q "$DIR/uploads") $(q "$DIR/web")"
rsync -az "$BIN" "$HOST:$DIR/concord-server.new"
rsync -az --delete "$ROOT/backend/migrations/" "$HOST:$DIR/migrations.new/"
# O compose novo só substitui o atual se não recriar nada (ver abaixo).
rsync -az "$ROOT/backend/docker-compose.yml" "$HOST:$DIR/docker-compose.yml.new"
rsync -az --delete --chmod=D755,F644 "$ROOT/site/" "$HOST:$DIR/site.new/"
# Instaladores e assinaturas já (arquivos novos, com a versão no nome); os
# manifestos (latest*.yml) só depois que o backend novo estiver no ar. O Caddy
# serve /updates direto do disco, então os arquivos precisam ser legíveis.
if [[ -d "$ROOT/backend/updates" ]]; then
  rsync -az --chmod=D755,F644 --exclude latest.yml --exclude latest-linux.yml "$ROOT/backend/updates/" "$HOST:$DIR/updates/"
fi

# Postgres/LiveKit: compara o hash da configuração nova de cada serviço (o que
# o Compose usa para decidir recriar) com o dos containers rodando.
remote DIR="$DIR" INFRA="$INFRA" CI="${GITHUB_ACTIONS:-}" <<'REMOTE'
set -euo pipefail
cd "$DIR"
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

# Checa o binário novo e aplica as migrations novas ANTES de reiniciar, com o
# antigo ainda no ar (por isso as migrations precisam ser compatíveis com ele —
# veja "Migrations" em docs/HOSPEDAGEM.md). Se algo falhar aqui, nada que está
# no ar foi trocado. Depois reinicia e espera o /healthz (banco no ar e
# chamadas recarregadas) por até HEALTH_TIMEOUT segundos, contados no relógio.
#
# Se o binário novo não ficar saudável, volta sozinho para o último que ficou
# (concord-server.good), reinicia e sai com erro — a página, o app web e os
# manifestos não são publicados. concord-server.prev é sempre um binário que já
# passou no /healthz; o que falhou fica em concord-server.failed.
remote DIR="$DIR" HEALTH_TIMEOUT="$HEALTH_TIMEOUT" <<'REMOTE'
set -euo pipefail
cd "$DIR"
CAPABILITY=concord-capability:socket-activation-v1

socket_active() { systemctl is-active -q concord-server.socket 2>/dev/null; }
# Com o socket do systemd, a porta é a dele (o backend ignora o PORT do .env).
if socket_active; then
  listen=$(systemctl show -p Listen --value concord-server.socket 2>/dev/null | awk '{print $1}')
  port="${listen##*:}"
else
  port=$(sed -n -E 's/^(export[[:space:]]+)?PORT=//p' .env | tail -n 1 | sed -E 's/[[:space:]]+#.*$//' | tr -d "\"' \r")
fi
port="${port:-8080}" # mesmo padrão do backend
supports_socket() { grep -aq "$CAPABILITY" "$1"; }

# Espera o backend responder até o prazo (relógio, não número de tentativas:
# com o socket a conexão nunca é recusada e cada curl espera o tempo dele).
# wait_status 200: /healthz ok. wait_status 200 404: no ar, mesmo sem /healthz
# (binário de antes desta versão). Escreve o código que chegou.
wait_status() {
  local end=$((SECONDS + HEALTH_TIMEOUT)) code
  while ((SECONDS < end)); do
    code=$(curl -s -m 1 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/healthz" || true)
    for want in "$@"; do
      [[ "$code" == "$want" ]] && { echo "$code"; return 0; }
    done
    sleep 0.3
  done
  return 1
}
restart() {
  # Um crash loop anterior pode ter deixado o serviço em start-limit-hit.
  systemctl reset-failed concord-server 2>/dev/null || true
  systemctl restart concord-server
}

chmod +x concord-server.new
if socket_active && ! supports_socket concord-server.new; then
  rm -f concord-server.new
  rm -rf migrations.new site.new
  echo "ERRO: o concord-server.socket está ativo e este binário não sabe usá-lo (não subiria: porta ocupada)." >&2
  echo "      Nada foi trocado. Para instalar uma versão antiga, desative o socket antes (docs/HOSPEDAGEM.md, \"Voltar a uma versão antiga\")." >&2
  exit 1
fi
if ! MIGRATIONS_DIR=migrations.new timeout 120 ./concord-server.new migrate; then
  rm -f concord-server.new
  rm -rf migrations.new site.new
  echo "ERRO: migrations falharam; nada que está no ar foi trocado" >&2
  exit 1
fi
# Migrations aplicadas: a pasta nova passa a valer (o binário no ar só as lê
# ao subir).
rm -rf migrations.old
if [[ -d migrations ]]; then mv migrations migrations.old; fi
mv migrations.new migrations
rm -rf migrations.old

# O que está no ar agora só vira o "anterior" se já tiver passado no /healthz.
if [[ -f concord-server.good ]]; then
  cp -f concord-server.good concord-server.prev
elif [[ -f concord-server ]]; then
  cp -f concord-server concord-server.prev # primeiro deploy com este script
fi
mv concord-server.new concord-server
restart
if wait_status 200 >/dev/null; then
  cp -f concord-server concord-server.good
  echo "backend no ar (/healthz ok)"
  exit 0
fi

echo "ERRO: o backend novo não respondeu /healthz em ${HEALTH_TIMEOUT} s:" >&2
journalctl -u concord-server -n 30 --no-pager >&2 || true
mv -f concord-server concord-server.failed
rm -rf site.new
if [[ ! -f concord-server.prev ]]; then
  echo "ERRO: não há binário anterior para voltar; o backend está fora do ar" >&2
  exit 1
fi
if socket_active && ! supports_socket concord-server.prev; then
  echo "ERRO: o binário anterior não sabe usar o socket ativo; não dá para voltar sozinho." >&2
  echo "      O backend está fora do ar: veja \"Voltar a uma versão antiga\" em docs/HOSPEDAGEM.md." >&2
  exit 1
fi
cp -f concord-server.prev concord-server
restart
# Uma espera só (até HEALTH_TIMEOUT): 200 é um binário com /healthz, 404 um de
# antes dele (o primeiro deploy com este script), que também está no ar.
case "$(wait_status 200 404 || true)" in
  200) echo "ERRO: voltei para o binário anterior, que está no ar. O novo ficou em $DIR/concord-server.failed." >&2 ;;
  404) echo "ERRO: voltei para o binário anterior, que está no ar (é de antes do /healthz). O novo ficou em $DIR/concord-server.failed." >&2 ;;
  *) echo "ERRO: o binário anterior também não respondeu em ${HEALTH_TIMEOUT} s; veja journalctl -u concord-server" >&2 ;;
esac
exit 1
REMOTE

# Backend novo no ar: só agora a página de download, o app web e os apps
# desktop passam a ver a versão nova (o app web novo pode depender da API nova).
remote DIR="$DIR" <<'REMOTE'
set -euo pipefail
cd "$DIR"
rm -rf site.old
if [[ -d site ]]; then mv site site.old; fi
mv site.new site
rm -rf site.old
REMOTE
# App web: os assets (nomes com hash) antes, o index.html por último — quem
# abrir no meio do envio não pega um index apontando para arquivo que falta.
# O --delete só limpa /opt/concord/web.
WEB="$ROOT/frontend/dist-web"
if [[ -f "$WEB/index.html" ]]; then
  rsync -az --chmod=D755,F644 --exclude index.html "$WEB/" "$HOST:$DIR/web/"
  rsync -az --delete --chmod=D755,F644 "$WEB/" "$HOST:$DIR/web/"
else
  echo "aviso: $WEB não existe (rode 'yarn build:web' em frontend/) — app web não atualizado" >&2
fi
for manifest in latest.yml latest-linux.yml; do
  if [[ -f "$ROOT/backend/updates/$manifest" ]]; then
    rsync -az --chmod=F644 "$ROOT/backend/updates/$manifest" "$HOST:$DIR/updates/"
  fi
done
# Guarda só os 3 instaladores mais recentes (cada um tem ~120 MB). Concord-* é
# o nome antigo do app.
remote DIR="$DIR" <<'REMOTE'
set -euo pipefail
cd "$DIR/updates"
{ ls -t Salinha-*-setup.exe Concord-*-setup.exe 2>/dev/null || true; } | tail -n +4 | while read -r f; do rm -f "$f" "$f.blockmap" "$f.sig"; done
{ ls -t Salinha-*-x64.AppImage 2>/dev/null || true; } | tail -n +4 | while read -r f; do rm -f "$f" "$f.sig"; done
REMOTE
