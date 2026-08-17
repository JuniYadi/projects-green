#!/usr/bin/env bash
# Drives a real browser via `codex exec` (a separate process — its MCP tool
# calls and DOM snapshots never enter the caller's context) to explore an E2E
# flow, then writes back a ready-to-run Playwright spec.
#
# ponytail: one codex call does exploration + spec authoring, no JSON->Playwright
# templating engine. If flows need retries/multi-turn repair, add that then.
#
# Usage: scripts/e2e-agent.sh <role: user|admin|public> <spec-output-path> "<flow prompt>" [feature_key]
#   user   -> console flows,  attaches to Chrome on :9222 (must be logged in as a user)
#   admin  -> portal flows,   attaches to Chrome on :9223 (must be logged in as admin)
#   public -> no-auth flows,  isolated headless profile, no setup needed
#
# feature_key (optional): a feature_key from the vault's E2E checklist (see
# Skill - E2E Feature Verification). When given, the same codex process also
# loads AGENTS.md's Obsidian procedure, updates that row's Status/Evidence/
# playwrightTag/lastVerified per the skill's schema, and pushes the vault repo
# (vault merges don't need separate confirmation). Omit for ad-hoc checks that
# aren't on the tracked board.
set -euo pipefail

ROLE="${1:?usage: scripts/e2e-agent.sh <user|admin|public> <spec-output-path> "<flow prompt>" [feature_key]}"
SPEC_PATH="${2:?usage: scripts/e2e-agent.sh <user|admin|public> <spec-output-path> "<flow prompt>" [feature_key]}"
PROMPT="${3:?usage: scripts/e2e-agent.sh <user|admin|public> <spec-output-path> "<flow prompt>" [feature_key]}"
FEATURE_KEY="${4:-}"

case "$ROLE" in
  user|admin|public) ;;
  *) echo "role must be one of: user, admin, public (got: $ROLE)" >&2; exit 1 ;;
esac

TOOL="${ROLE}_browser"
BASE_URL="${PLAYWRIGHT_BASE_URL:-https://pfnapp.my.id}"
SCHEMA="$(dirname "$0")/../.codex/e2e-result.schema.json"
RESULT_FILE="$(mktemp)"
LOG_FILE="$(mktemp)"

VAULT_INSTRUCTIONS=""
if [ -n "$FEATURE_KEY" ]; then
  VAULT_INSTRUCTIONS="

Then, following this repo's AGENTS.md Obsidian-loading procedure and the
vault's Skill - E2E Feature Verification note, find the checklist row for
feature_key '$FEATURE_KEY' and update its Status, Evidence, sourceState,
surfaceState, readiness, gapType, playwrightTag, and lastVerified columns to
match exactly what you observed (never mark verified without evidence — use
this run's steps as the evidence reference). Commit and push the vault repo.
Report the note path and what changed as the 'vault_update' field, or null if
the feature_key wasn't found."
fi

# ponytail: codex occasionally hangs indefinitely (near-0% CPU, no session
# log growth) racing its built-in in-app-browser skill against our MCP tool —
# see AGENTS.md. --disable doesn't reliably prevent it, so bound the worst
# case with a hard timeout instead of trusting it to finish.
MAX_WAIT_SECS="${E2E_AGENT_TIMEOUT_SECS:-240}"

codex exec \
  --skip-git-repo-check \
  --dangerously-bypass-approvals-and-sandbox \
  --disable in_app_browser \
  --disable computer_use \
  --output-schema "$SCHEMA" \
  --output-last-message "$RESULT_FILE" \
  "Base URL: $BASE_URL. Using the $TOOL MCP tool, $PROMPT

Do not stop at functional flow. Also assess UI/UX as you go: is the page's
intent and labeling clear to someone unfamiliar with the system, is it
visually consistent with the rest of the admin UI (spacing, typography,
component style), are empty/loading/error states handled or just blank, and
does anything create friction or a dead end (a link that goes somewhere
unhelpful, a state the page never explains, a control with no visible
effect)? Report these observations as the 'ui_ux_notes' field — this is
required output, not optional color commentary.

Then write a complete @playwright/test spec (TypeScript) reproducing every
verified step as the 'playwright_spec' field. Use relative paths in
page.goto() (e.g. page.goto('/en/login')), not the full base URL. Follow this
repo's e2e conventions: test.describe with an @e2e/<domain>/<role>/<scenario>
tag in the title, async ({ page }) test callbacks. Assertions must be robust
to changing data: verify structural elements (headings, labels, input
placeholders, that a value is present/non-empty/numeric) instead of pinning
exact live values such as specific balances, org names, or row counts that
will change over time — this applies whether the target was local or
production data.${VAULT_INSTRUCTIONS}" \
  >"$LOG_FILE" 2>&1 &
CODEX_PID=$!

ELAPSED=0
while kill -0 "$CODEX_PID" 2>/dev/null && [ "$ELAPSED" -lt "$MAX_WAIT_SECS" ]; do
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

if kill -0 "$CODEX_PID" 2>/dev/null; then
  kill -9 "$CODEX_PID" 2>/dev/null
  echo "codex exec hung past ${MAX_WAIT_SECS}s and was killed — see $LOG_FILE" >&2
  echo "likely the in-app-browser race (AGENTS.md) rather than the target page — just retry" >&2
  exit 1
fi
wait "$CODEX_PID" 2>/dev/null || true

if [ ! -s "$RESULT_FILE" ]; then
  echo "codex produced no result — see $LOG_FILE" >&2
  exit 1
fi

PASSED="$(jq -r '.passed' "$RESULT_FILE")"
jq -r '.playwright_spec' "$RESULT_FILE" >"$SPEC_PATH"

echo "passed=$PASSED"
echo "spec written to $SPEC_PATH"
echo "vault_update=$(jq -r '.vault_update' "$RESULT_FILE")"
echo "--- ui_ux_notes ---"
jq -r '.ui_ux_notes' "$RESULT_FILE"

if [ "$PASSED" != "true" ]; then
  jq -r '.failure_reason' "$RESULT_FILE" >&2
  exit 1
fi
