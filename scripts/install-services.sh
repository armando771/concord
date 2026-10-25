#!/usr/bin/env bash
# Instala serviços systemd do usuário para o servidor ficar sempre de pé:
#   concord-server               backend Go (binário backend/concord-server)
#   concord-playit               agente do playit
#   concord-playit-watchdog      testa o túnel a cada minuto e reinicia o playit
#
#   scripts/install-services.sh
#
# Requer `playit` no PATH e PUBLIC_URL em backend/.env (para o vigia).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNITS="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
PLAYIT="$(command -v playit || true)"
PLAYIT_DATA="${XDG_DATA_HOME:-$HOME/.local/share}/playit"
PLAYIT_SECRET="${XDG_CONFIG_HOME:-$HOME/.config}/playit/playit.toml"

if [[ -z "$PLAYIT" ]]; then
  echo "playit não encontrado no PATH — instale o agente (playit.gg/download)." >&2
  exit 1
fi

mkdir -p "$UNITS" "$PLAYIT_DATA" "$(dirname "$PLAYIT_SECRET")"
(cd "$ROOT/backend" && go build -o concord-server ./cmd)

cat > "$UNITS/concord-server.service" <<UNIT
[Unit]
Description=Concord backend (API + proxy LiveKit)
After=network-online.target

[Service]
WorkingDirectory=$ROOT/backend
ExecStart=$ROOT/backend/concord-server
Restart=always
RestartSec=1
# SIGTERM desliga com calma (fecha o chat com 1012 e termina as requisições em
# até 10 s); só depois disso o systemd mata à força.
KillSignal=SIGTERM
TimeoutStopSec=20

[Install]
WantedBy=default.target
UNIT

cat > "$UNITS/concord-playit.service" <<UNIT
[Unit]
Description=playit.gg agent (túneis do Concord)
After=network-online.target

[Service]
ExecStart=$PLAYIT --socket-path $PLAYIT_DATA/playitd.sock --secret-path $PLAYIT_SECRET -l $PLAYIT_DATA/playitd.log
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
UNIT

cat > "$UNITS/concord-playit-watchdog.service" <<UNIT
[Unit]
Description=Vigia do túnel playit do Concord

[Service]
Type=oneshot
ExecStart=$ROOT/scripts/playit-watchdog.sh
UNIT

cat > "$UNITS/concord-playit-watchdog.timer" <<UNIT
[Unit]
Description=Testa o túnel do Concord a cada minuto

[Timer]
OnBootSec=2min
OnUnitActiveSec=1min

[Install]
WantedBy=timers.target
UNIT

systemctl --user daemon-reload
systemctl --user enable --now concord-playit concord-server concord-playit-watchdog.timer

echo
echo "Serviços instalados. Se o playit ainda não foi vinculado à sua conta:"
echo "  playit-cli --socket-path $PLAYIT_DATA/playitd.sock setup"
