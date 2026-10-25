#!/usr/bin/env bash
# Instala serviços systemd do usuário para o servidor ficar sempre de pé:
#   concord-server               backend Go (binário backend/concord-server)
#   concord-playit               agente do playit
#   concord-playit-watchdog      testa o túnel a cada minuto e reinicia o playit
#
#   scripts/install-services.sh
#
#   concord-ytdlp-update.timer   atualiza o yt-dlp do Maestro todo dia
#
# Requer `playit`, `ffmpeg` no PATH e PUBLIC_URL em backend/.env (para o vigia).
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

# Maestro (bot de música): ffmpeg + yt-dlp. O yt-dlp se atualiza todo dia
# porque o YouTube muda com frequência e quebra versões antigas.
if ! command -v ffmpeg >/dev/null; then
  echo "ffmpeg não encontrado — instale com: sudo apt-get install -y ffmpeg" >&2
  exit 1
fi
YTDLP_BIN="$HOME/.local/bin/yt-dlp"
if ! command -v yt-dlp >/dev/null; then
  mkdir -p "$(dirname "$YTDLP_BIN")"
  curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "$YTDLP_BIN"
  chmod a+rx "$YTDLP_BIN"
fi
YTDLP_BIN="$(command -v yt-dlp || echo "$YTDLP_BIN")"
FFMPEG_BIN="$(command -v ffmpeg)"

mkdir -p "$UNITS" "$PLAYIT_DATA" "$(dirname "$PLAYIT_SECRET")"
(cd "$ROOT/backend" && go build -o concord-server ./cmd)

cat > "$UNITS/concord-server.service" <<UNIT
[Unit]
Description=Concord backend (API + proxy LiveKit)
After=network-online.target

[Service]
WorkingDirectory=$ROOT/backend
# Units do usuário não enxergam ~/.local/bin: caminhos absolutos para o Maestro.
Environment=MUSIC_YTDLP=$YTDLP_BIN
Environment=MUSIC_FFMPEG=$FFMPEG_BIN
ExecStart=$ROOT/backend/concord-server
Restart=always
RestartSec=3

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

# Se o yt-dlp veio do apt (/usr/bin/yt-dlp), o -U falha sem quebrar nada; o
# binário oficial é o recomendado (docs/HOSPEDAGEM.md).
cat > "$UNITS/concord-ytdlp-update.service" <<UNIT
[Unit]
Description=Atualiza o yt-dlp do Maestro

[Service]
Type=oneshot
ExecStart=$YTDLP_BIN -U
UNIT

cat > "$UNITS/concord-ytdlp-update.timer" <<UNIT
[Unit]
Description=Atualiza o yt-dlp todo dia

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
UNIT

systemctl --user daemon-reload
systemctl --user enable --now concord-playit concord-server concord-playit-watchdog.timer concord-ytdlp-update.timer

echo
echo "Serviços instalados. Se o playit ainda não foi vinculado à sua conta:"
echo "  playit-cli --socket-path $PLAYIT_DATA/playitd.sock setup"
