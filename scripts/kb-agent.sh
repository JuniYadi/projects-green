#!/usr/bin/env bash
# Drives real browser via MCP `user_browser` (through codex exec subprocess)
# to navigate the UI, wait for data rendering, capture real screenshots, and generate documentation.
set -euo pipefail

ROLE="${1:-user}"
TOOL="${ROLE}_browser"
BASE_URL="${PLAYWRIGHT_BASE_URL:-https://pfnapp.my.id}"
SCHEMA="$(dirname "$0")/../.codex/kb-result.schema.json"
RESULT_FILE="$(mktemp)"
LOG_FILE="$(mktemp)"

echo "Running KB Agent with MCP tool: $TOOL against $BASE_URL..."

MAX_WAIT_SECS="${E2E_AGENT_TIMEOUT_SECS:-240}"

codex exec \
	--skip-git-repo-check \
	--dangerously-bypass-approvals-and-sandbox \
	--disable in_app_browser \
	--disable computer_use \
	--output-schema "$SCHEMA" \
	--output-last-message "$RESULT_FILE" \
	"You are capturing verified, high-quality documentation screenshots for the WhatsApp API Key knowledge base.
Base URL: $BASE_URL.
Using the $TOOL MCP tool:

1. Navigate to '$BASE_URL/en/console/whatsapp/api-keys'.
2. Wait until all loading states ('Loading API key...') disappear and the actual UI renders.
3. If an active key exists, revoke it first so you can document the initial clean state.
4. Step 1: Capture screenshot to 'public/kb-assets/whatsapp/api-keys/01-initial-empty-state.png'.
5. Step 2: Click the 'Generate API key' button. Wait for the 'One-time API secret' banner to appear with the full secret card. Capture screenshot to 'public/kb-assets/whatsapp/api-keys/02-key-generated-with-secret.png'.
6. Step 3: Click 'Rotate API key' button to open the confirmation modal. Capture screenshot to 'public/kb-assets/whatsapp/api-keys/03-rotate-key-dialog.png'. Cancel the dialog.
7. Step 4: Click 'Revoke API key' button to open the confirmation modal. Capture screenshot to 'public/kb-assets/whatsapp/api-keys/04-revoke-key-dialog.png'. Cancel the dialog.

Return the JSON result with passed=true, the list of saved screenshots, and markdown_content." \
	>"$LOG_FILE" 2>&1 &
CODEX_PID=$!

ELAPSED=0
while kill -0 "$CODEX_PID" 2>/dev/null && [ "$ELAPSED" -lt "$MAX_WAIT_SECS" ]; do
	sleep 5
	ELAPSED=$((ELAPSED + 5))
done

if kill -0 "$CODEX_PID" 2>/dev/null; then
	kill -9 "$CODEX_PID" 2>/dev/null
	echo "codex exec hung past ${MAX_WAIT_SECS}s — see $LOG_FILE" >&2
	exit 1
fi
wait "$CODEX_PID" 2>/dev/null || true

if [ ! -s "$RESULT_FILE" ]; then
	echo "codex produced no result — see $LOG_FILE" >&2
	exit 1
fi

cat "$RESULT_FILE"
