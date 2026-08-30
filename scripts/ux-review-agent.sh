#!/usr/bin/env bash
# Drives a real browser via `codex exec` (a separate process — its MCP tool
# calls and DOM snapshots never enter the caller's context) to perform a
# "baby-ux-review" first-time-user teardown on a single page, then returns
# only the small structured verdict.
#
# ponytail: reuses the same codex-subprocess pattern as e2e-agent.sh /
# kb-agent.sh instead of a new orchestration mechanism.
#
# Usage: scripts/ux-review-agent.sh <role: user|admin|public> <page-path>
#   user   -> console flows,  attaches to Chrome on :9222 (must be logged in as a user)
#   admin  -> portal flows,   attaches to Chrome on :9223 (must be logged in as admin)
#   public -> no-auth flows,  isolated headless profile, no setup needed
#
# <page-path> is appended to $PLAYWRIGHT_BASE_URL (default https://pfnapp.my.id),
# e.g. '/en/console/whatsapp/messages?phone=6285708296482'. Override the base
# with PLAYWRIGHT_BASE_URL=http://localhost:3300 for local review.
set -euo pipefail

ROLE="${1:?usage: scripts/ux-review-agent.sh <user|admin|public> <page-path>}"
PAGE_PATH="${2:?usage: scripts/ux-review-agent.sh <user|admin|public> <page-path>}"

case "$ROLE" in
user | admin | public) ;;
*)
	echo "role must be one of: user, admin, public (got: $ROLE)" >&2
	exit 1
	;;
esac

TOOL="${ROLE}_browser"
BASE_URL="${PLAYWRIGHT_BASE_URL:-https://pfnapp.my.id}"
SCHEMA="$(dirname "$0")/../.codex/ux-review-result.schema.json"
RESULT_FILE="$(mktemp)"
LOG_FILE="$(mktemp)"

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
	"Base URL: $BASE_URL. Using the $TOOL MCP tool, navigate to '$BASE_URL$PAGE_PATH' and
take an accessibility snapshot and a screenshot of what renders.

You are performing a 'baby-ux-review' teardown: evaluate this page exactly as
a complete first-time user with zero domain context would experience it —
not as a developer who already knows what the product does. Judge it through
these 6 friction filters, and for every violation found report it as a
friction_points entry naming which filter it violates:

1. 3-second-clarity — is the page title/hero clear value proposition, or
   developer jargon? Could a total newcomer grasp why they're here in 3
   seconds?
2. cognitive-dread — does the page open with failure states, red errors,
   warnings, or complex flows before showing anything reassuring/successful?
3. visual-abstraction — are real-world things (e.g. chat messages) shown as
   raw monospace/metadata dumps instead of realistic styled UI (e.g. actual
   chat bubbles)?
4. scannability — are headings/labels/table columns terse and scannable in 5
   seconds, or dense run-on text?
5. mental-math — is the user forced to calculate anything (rates,
   multipliers, offsets) before understanding the page?
6. click-depth — how many clicks/how much scrolling to the first meaningful
   action? Is it buried?

For each friction_points entry, quote the exact problematic label/copy where
applicable (quote field, null if purely visual), name the exact element
(element field), and explain why it confuses a newcomer (why field).

Then produce reaction (a brutally honest, no-shy first impression, 1-3
sentences) and prescription (a prioritized list of concrete fixes: what to
delete, simplify, or replace with a more realistic visual component).

Set passed=true if you were able to load the page and complete the review,
even if the review itself is highly critical. Set passed=false only if the
page failed to load, showed an auth wall, or crashed before rendering
anything reviewable — put the reason in failure_reason (otherwise null)." \
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

cat "$RESULT_FILE"
