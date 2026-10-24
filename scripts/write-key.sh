#!/usr/bin/env bash
# Grava uma chave privada vinda de um secret do CI, tolerando o jeito que ela
# foi colada: PEM completo (com CRLF ou numa linha só), em base64 ou só o
# corpo, sem as linhas BEGIN/END.
#
#   printf '%s' "$SECRET" | scripts/write-key.sh <arquivo> <tipo>
#
# <tipo> é o usado quando faltam BEGIN/END: "PRIVATE KEY" (openssl) ou
# "OPENSSH PRIVATE KEY" (ssh-keygen).
set -euo pipefail

OUT="$1"
TYPE="$2"

key=$(tr -d '\0\r')
if [[ "$key" != *-----BEGIN* ]]; then
  decoded=$(printf '%s' "$key" | base64 -d 2>/dev/null | tr -d '\0\r' || true)
  if [[ "$decoded" == *-----BEGIN* ]]; then
    key=$decoded
  else
    key="-----BEGIN $TYPE----- $key -----END $TYPE-----"
  fi
fi

# Numa linha só: refaz as quebras (corpo em linhas de 64).
if [[ "$key" != *$'\n'* ]]; then
  if [[ "$key" =~ -----BEGIN\ ([A-Z0-9 ]+)----- ]]; then
    TYPE="${BASH_REMATCH[1]}"
  fi
  body=${key#*-----BEGIN "$TYPE"-----}
  body=${body%-----END "$TYPE"-----*}
  key=$(printf -- '-----BEGIN %s-----\n%s\n-----END %s-----' \
    "$TYPE" "$(printf '%s' "$body" | tr -d ' \t' | fold -w 64)" "$TYPE")
fi

umask 077
printf '%s\n' "$key" > "$OUT"
