#!/usr/bin/env bash
# Drives a real browser via `codex exec` (a separate process — its MCP tool
# calls and DOM snapshots never enter the caller's context) to explore an E2E
# flow, then writes back a ready-to-run Playwright spec.
#
# ponytail: one codex call does exploration + spec authoring, no JSON->Playwright
# templating engine. If flows need retries/multi-turn repair, add that then.
#
# Usage: scripts/e2e-agent.sh <spec-output-path> "<flow description prompt>"
set -euo pipefail

SPEC_PATH="${1:?usage: scripts/e2e-agent.sh <spec-output-path> "<flow prompt>"}"
PROMPT="${2:?usage: scripts/e2e-agent.sh <spec-output-path> "<flow prompt>"}"
BASE_URL="${PLAYWRIGHT_BASE_URL:-http://localhost:3300}"
SCHEMA="$(dirname "$0")/../.codex/e2e-result.schema.json"
RESULT_FILE="$(mktemp)"
LOG_FILE="$(mktemp)"

codex exec \
  --skip-git-repo-check \
  --dangerously-bypass-approvals-and-sandbox \
  --output-schema "$SCHEMA" \
  --output-last-message "$RESULT_FILE" \
  "Base URL: $BASE_URL. Using the e2e_browser MCP tool, $PROMPT

Then write a complete @playwright/test spec (TypeScript) reproducing every
verified step as the 'playwright_spec' field. Use relative paths in
page.goto() (e.g. page.goto('/en/login')), not the full base URL. Follow this
repo's e2e conventions: test.describe with an @e2e/<domain>/<role>/<scenario>
tag in the title, async ({ page }) test callbacks, expect() assertions
matching only what you actually observed." \
  >"$LOG_FILE" 2>&1

if [ ! -s "$RESULT_FILE" ]; then
  echo "codex produced no result — see $LOG_FILE" >&2
  exit 1
fi

PASSED="$(jq -r '.passed' "$RESULT_FILE")"
jq -r '.playwright_spec' "$RESULT_FILE" >"$SPEC_PATH"

echo "passed=$PASSED"
echo "spec written to $SPEC_PATH"

if [ "$PASSED" != "true" ]; then
  jq -r '.failure_reason' "$RESULT_FILE" >&2
  exit 1
fi
