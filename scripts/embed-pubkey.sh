#!/usr/bin/env bash
# Escreve em <saída> o site/install.sh com a chave pública Ed25519 embutida no
# lugar de @@SALINHA_PUBKEY@@ (o instalador confere a assinatura do pacote com
# ela). Uso: scripts/embed-pubkey.sh <install.sh> <chave-pública.pem> <saída>
set -euo pipefail
IN="$1" KEY="$2" OUT="$3"
grep -q 'BEGIN PUBLIC KEY' "$KEY" || { echo "chave pública inválida: $KEY" >&2; exit 1; }
grep -qx '@@SALINHA_PUBKEY@@' "$IN" || { echo "marcador @@SALINHA_PUBKEY@@ ausente em $IN" >&2; exit 1; }
awk -v key="$KEY" '$0 == "@@SALINHA_PUBKEY@@" { while ((getline line < key) > 0) print line; next } { print }' "$IN" >"$OUT"
chmod 644 "$OUT"
