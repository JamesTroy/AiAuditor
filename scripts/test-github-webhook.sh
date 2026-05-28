#!/usr/bin/env bash
# Smoke-test the GitHub webhook receiver without involving GitHub.
#
# Builds a synthetic webhook payload, signs it with GITHUB_APP_WEBHOOK_SECRET
# using HMAC-SHA256 (matching GitHub's X-Hub-Signature-256), and POSTs it to
# the local /api/webhooks/github endpoint.
#
# Usage:
#   GITHUB_APP_WEBHOOK_SECRET=xxx ./scripts/test-github-webhook.sh ping
#   GITHUB_APP_WEBHOOK_SECRET=xxx ./scripts/test-github-webhook.sh pull_request
#   GITHUB_APP_WEBHOOK_SECRET=xxx URL=https://your-app.up.railway.app ./scripts/test-github-webhook.sh ping
#   ./scripts/test-github-webhook.sh ping bad-sig    # negative test
#
# Exit codes:
#   0  expected response (200 for ping, 200 with queued:true for PR)
#   1  unexpected status or body
#   2  missing config
set -euo pipefail

EVENT="${1:-ping}"
MODE="${2:-good}"  # "good" = correct HMAC, "bad-sig" = bypass test
URL="${URL:-http://localhost:3000/api/webhooks/github}"
SECRET="${GITHUB_APP_WEBHOOK_SECRET:-}"

if [ -z "$SECRET" ]; then
  echo "GITHUB_APP_WEBHOOK_SECRET must be set" >&2
  exit 2
fi

case "$EVENT" in
  ping)
    BODY='{"zen":"Speak like a human.","hook_id":1,"hook":{"type":"App"},"sender":{"login":"smoke-test"}}'
    ;;
  pull_request)
    BODY=$(cat <<'JSON'
{
  "action": "opened",
  "number": 1,
  "pull_request": {
    "number": 1,
    "state": "open",
    "draft": false,
    "head": {"sha": "deadbeef0000000000000000000000000000beef", "ref": "feature/test"},
    "base": {"ref": "main"},
    "user": {"login": "smoke-test"}
  },
  "repository": {
    "id": 1234567,
    "full_name": "smoke-test/repo",
    "owner": {"login": "smoke-test"},
    "name": "repo"
  },
  "installation": {"id": 99999},
  "sender": {"login": "smoke-test"}
}
JSON
    )
    ;;
  *)
    echo "Unknown event '$EVENT' — supported: ping, pull_request" >&2
    exit 2
    ;;
esac

# HMAC-SHA256 of the raw body, hex digest, with sha256= prefix (GitHub spec).
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')
if [ "$MODE" = "bad-sig" ]; then
  SIG="0000000000000000000000000000000000000000000000000000000000000000"
fi

DELIVERY="smoke-$(date +%s)-$RANDOM"

echo "→ POST $URL"
echo "  event=$EVENT  signature-mode=$MODE  delivery-id=$DELIVERY"

RES=$(curl -sS -o /tmp/gh-webhook-resp.txt -w '%{http_code}' \
  -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: $EVENT" \
  -H "X-GitHub-Delivery: $DELIVERY" \
  -H "X-Hub-Signature-256: sha256=$SIG" \
  -H "User-Agent: GitHub-Hookshot/smoke-test" \
  --data-raw "$BODY")

BODY_RESP=$(cat /tmp/gh-webhook-resp.txt)
echo "← HTTP $RES"
echo "  body: $BODY_RESP"

EXPECTED_STATUS=200
EXPECTED_SUBSTR=""
case "$EVENT:$MODE" in
  ping:good)        EXPECTED_SUBSTR='"pong":true'    ;;
  pull_request:good) EXPECTED_SUBSTR='"queued":true' ;;
  *:bad-sig)        EXPECTED_STATUS=401; EXPECTED_SUBSTR='Invalid signature' ;;
esac

if [ "$RES" != "$EXPECTED_STATUS" ]; then
  echo "FAIL: expected HTTP $EXPECTED_STATUS, got $RES" >&2
  exit 1
fi
if [ -n "$EXPECTED_SUBSTR" ] && ! grep -q -- "$EXPECTED_SUBSTR" /tmp/gh-webhook-resp.txt; then
  echo "FAIL: response missing '$EXPECTED_SUBSTR'" >&2
  exit 1
fi
echo "OK"
