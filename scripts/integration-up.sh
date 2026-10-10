#!/usr/bin/env bash
# Starts the disposable Kan stack and writes .env.integration with everything the
# attachment integration tests need (API key, base URL, card id).
# Requires: docker compose, curl >= 7.75 (--aws-sigv4), python3.
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.integration.yml"
KAN=http://localhost:3000
S3=http://localhost:9000

$COMPOSE up -d

echo "Waiting for Kan..."
for _ in $(seq 1 90); do
  curl -fsS -m 3 -o /dev/null "$KAN/api/health" 2>/dev/null && break
  sleep 2
done
curl -fsS -m 3 -o /dev/null "$KAN/api/health"

echo "Waiting for storage and creating buckets..."
for bucket in kan-attachments kan-avatars; do
  for _ in $(seq 1 30); do
    code=$(curl -sS -m 5 -o /dev/null -w '%{http_code}' -X PUT --aws-sigv4 "aws:amz:us-east-1:s3" \
      --user "kanaccess:kansecret12345" "$S3/$bucket" || true)
    [ "$code" = "200" ] || [ "$code" = "409" ] && break
    sleep 1
  done
done

json() { python3 -c "import sys,json;print(json.load(sys.stdin)$1)"; }
auth=(-H 'Content-Type: application/json' -H "Origin: $KAN")
jar=$(mktemp)

curl -fsS "${auth[@]}" -c "$jar" -X POST "$KAN/api/auth/sign-up/email" \
  -d '{"name":"Teste","email":"teste@example.com","password":"Senha-Teste-123"}' >/dev/null
KEY=$(curl -fsS "${auth[@]}" -b "$jar" -X POST "$KAN/api/auth/api-key/create" -d '{"name":"mcp-test"}' | json '["key"]')
rm -f "$jar"

api() { curl -fsS -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' "$@"; }
WS=$(api -X POST "$KAN/api/v1/workspaces" -d '{"name":"WS Teste","slug":"ws-teste"}' | json '["publicId"]')
BOARD=$(api -X POST "$KAN/api/v1/workspaces/$WS/boards" -d '{"name":"Board","lists":["Todo"],"labels":[]}' | json '["publicId"]')
LIST=$(api "$KAN/api/v1/boards/$BOARD" | json '["lists"][0]["publicId"]')
CARD=$(api -X POST "$KAN/api/v1/cards" \
  -d "{\"listPublicId\":\"$LIST\",\"title\":\"Card de teste\",\"description\":\"\",\"labelPublicIds\":[],\"memberPublicIds\":[],\"position\":\"start\"}" | json '["publicId"]')

cat > .env.integration <<ENV
KAN_API_KEY=$KEY
KAN_API_BASE_URL=$KAN/api/v1
KAN_TEST_CARD_ID=$CARD
ENV
echo "Ready. Run: set -a; . ./.env.integration; set +a; INTEGRATION_TEST=true bun test tests/integration/attachment.test.ts"
