#!/usr/bin/env bash
# Acceptance check of a running kan-mcp-full (docker compose or any HTTP deployment).
#
#   scripts/smoke.sh [MCP_URL] [CARD_PUBLIC_ID]
#
# MCP_URL defaults to http://127.0.0.1:3333. The token is read from $MCP_AUTH_TOKEN or from ./.env.
# Without a card id it checks the service, the token and the connection to your Kan (read only).
# With a card id of a TEST card it also attaches a small file, lists it, downloads it and removes it,
# which exercises the storage (S3/R2) of your Kan end to end. Requires: curl, jq.
set -uo pipefail

URL="${1:-http://127.0.0.1:3333}"
CARD="${2:-}"
cd "$(dirname "$0")/.."
command -v jq >/dev/null || { echo "jq is required"; exit 2; }
TOKEN="${MCP_AUTH_TOKEN:-$(grep -E '^MCP_AUTH_TOKEN=' .env 2>/dev/null | head -1 | cut -d= -f2-)}"
[ -n "$TOKEN" ] || { echo "MCP_AUTH_TOKEN not found (export it or fill .env)"; exit 2; }

FAILED=0
ok()   { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; FAILED=$((FAILED + 1)); }
check() { if [ "$2" = "1" ]; then ok "$1"; else fail "$1${3:+ ($3)}"; fi; }

rpc() { # $1 = JSON body; prints the response body
  curl -sS -m 120 -X POST "$URL/mcp" -H "authorization: Bearer $TOKEN" \
    -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d "$1"
}
# Calls a tool. Must NOT run in a subshell ($(...)): it sets TOOL_OUT (text of the result) and TOOL_ERR.
TOOL_OUT=""; TOOL_ERR="true"
tool() { # $1 = tool name, $2 = JSON arguments
  local out
  out=$(rpc "$(jq -nc --arg n "$1" --argjson a "$2" '{jsonrpc:"2.0",id:1,method:"tools/call",params:{name:$n,arguments:$a}}')")
  # Success only when the response has a "result" that is not flagged isError (a 401 body has no result).
  TOOL_ERR=$(printf '%s' "$out" | jq -r 'if .result then (.result.isError // false) else true end' 2>/dev/null) || TOOL_ERR="true"
  [ -n "$TOOL_ERR" ] || TOOL_ERR="true"
  TOOL_OUT=$(printf '%s' "$out" | jq -r '.result.content[0].text // .error.message // "no response"' 2>/dev/null) || TOOL_OUT="no response"
}

echo "kan-mcp-full at $URL"
H=$(curl -sS -m 10 "$URL/health" 2>/dev/null)
check "service answers /health ($(printf '%s' "$H" | jq -r .version 2>/dev/null))" "$([ "$(printf '%s' "$H" | jq -r .status 2>/dev/null)" = ok ] && echo 1 || echo 0)"

CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 10 -X POST "$URL/mcp" -H 'content-type: application/json' -d '{}')
check "requests without the token are refused (401)" "$([ "$CODE" = 401 ] && echo 1 || echo 0)" "got $CODE"

N=$(rpc '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.result.tools | length' 2>/dev/null)
check "the token works and 54 tools are available" "$([ "$N" = 54 ] && echo 1 || echo 0)" "got ${N:-none}"

tool workspace.list '{}'
check "the MCP reaches your Kan and the API key is valid (workspace.list)" "$([ "$TOOL_ERR" = false ] && echo 1 || echo 0)" "$(printf '%s' "$TOOL_OUT" | head -c 200)"
[ "$TOOL_ERR" = false ] && echo "       workspaces: $(printf '%s' "$TOOL_OUT" | jq -r '[.[].workspace.name] | join(", ")')"

if [ -n "$CARD" ]; then
  echo "attachments on card $CARD (use a TEST card):"
  NAME="smoke-$(date +%s).txt"
  B64=$(printf 'kan-mcp-full smoke test %s' "$(date -u +%FT%TZ)" | base64 | tr -d '\n')
  tool attachment.add "$(jq -nc --arg c "$CARD" --arg f "$NAME" --arg b "$B64" '{cardPublicId:$c,contentBase64:$b,filename:$f}')"
  ID=$(printf '%s' "$TOOL_OUT" | jq -r '.publicId // empty' 2>/dev/null)
  check "attachment.add uploads through the storage and registers the file" "$([ "$TOOL_ERR" = false ] && [ -n "$ID" ] && echo 1 || echo 0)" "$(printf '%s' "$TOOL_OUT" | head -c 300)"
  if [ -n "$ID" ]; then
    tool attachment.list "$(jq -nc --arg c "$CARD" '{cardPublicId:$c}')"
    check "attachment.list shows it" "$(printf '%s' "$TOOL_OUT" | jq -e --arg i "$ID" 'any(.[]; .publicId == $i)' >/dev/null 2>&1 && echo 1 || echo 0)"
    tool attachment.download "$(jq -nc --arg c "$CARD" --arg i "$ID" '{cardPublicId:$c,attachmentPublicId:$i}')"
    check "attachment.download reads it back from the storage" "$([ "$TOOL_ERR" = false ] && echo 1 || echo 0)" "$(printf '%s' "$TOOL_OUT" | head -c 300)"
    tool attachment.remove "$(jq -nc --arg i "$ID" '{attachmentPublicId:$i}')"
    check "attachment.remove" "$([ "$TOOL_ERR" = false ] && echo 1 || echo 0)" "$(printf '%s' "$TOOL_OUT" | head -c 300)"
    tool attachment.list "$(jq -nc --arg c "$CARD" '{cardPublicId:$c}')"
    check "it is gone from the card" "$(printf '%s' "$TOOL_OUT" | jq -e --arg i "$ID" 'all(.[]; .publicId != $i)' >/dev/null 2>&1 && echo 1 || echo 0)"
  fi
else
  echo "(pass the public ID of a test card as 2nd argument to also test attachments)"
fi

echo
if [ "$FAILED" -eq 0 ]; then echo "All checks passed."; else echo "$FAILED check(s) failed."; fi
exit "$FAILED"
