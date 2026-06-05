#!/usr/bin/env bash
# Probe a FastAPI endpoint to distinguish "real exception" 500s from
# "response-model serialization" 500s. See SKILL.md "Pitfall: empty 500".
#
# Usage: ./probe_endpoint.sh <base_url> <route> [json_body]
#   ./probe_endpoint.sh http://127.0.0.1:8765 /healthz
#   ./probe_endpoint.sh http://127.0.0.1:8765 /intake/start '{"description":"x"}'

set -u

BASE="${1:?usage: $0 <base_url> <route> [json_body]}"
ROUTE="${2:?usage: $0 <base_url> <route> [json_body]}"
BODY="${3:-}"

if [ -n "$BODY" ]; then
  RESP=$(curl -s -i -X POST -H "Content-Type: application/json" -d "$BODY" "$BASE$ROUTE")
else
  RESP=$(curl -s -i "$BASE$ROUTE")
fi

STATUS=$(printf '%s' "$RESP" | head -1 | awk '{print $2}')
CTYPE=$(printf '%s' "$RESP" | grep -i '^content-type:' | head -1 | tr -d '\r')
LENGTH=$(printf '%s' "$RESP" | grep -i '^content-length:' | head -1 | tr -d '\r')

printf 'status:   %s\n' "$STATUS"
printf 'ctype:    %s\n' "$CTYPE"
printf 'length:   %s\n' "$LENGTH"

if [ "$STATUS" = "500" ]; then
  if printf '%s' "$CTYPE" | grep -qi 'application/json'; then
    echo "diagnosis: REAL EXCEPTION (FastAPI returned the error as JSON)"
    echo "           inspect the body for the traceback / detail"
  elif printf '%s' "$CTYPE" | grep -qi 'text/plain'; then
    echo "diagnosis: SERIALIZATION 500 (Pydantic response model failed)"
    echo "           reproduce the handler in-process; suspect tuple/enum/datetime fields"
    echo "           see SKILL.md 'Pitfall: empty 500 Internal Server Error'"
  fi
fi
