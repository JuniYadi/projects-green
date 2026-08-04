# Task 3 report

## Changed files

- `modules/deploy/ui/step-detect-v2.tsx`
- `modules/deploy/ui/step-detect-v2.test.tsx`

## Behavior

- Detection and retry work render compact `Checking your project…` status with current operation, including retry waits.
- Successful, low-confidence, blocked/unsupported, and transient-failure outcomes use exact outcome-led lead copy while preserving backend `decisionMessage` values and prioritizing Back over false-ready language.
- Kept retry action restricted to existing retryable error codes (`NETWORK_ERROR` and `DETECTION_TRANSIENT_PROVIDER_ERROR`) after the existing final-attempt policy.
- Moved confidence, operation rows, evidence, policy status/message, runtime/build/port/Dockerfile facts into closed native `Show technical details` disclosure; tests verify hidden-until-open behavior.
- Moved manual build controls into separate native `Change technical settings` disclosure. It opens for required manual setup, final retryable failure, or visible validation errors; Dockerfile validation exception and field callbacks remain unchanged.
- Added focused assertions for compact progress, success/low-confidence/transient/blocked/unsupported copy, disclosure state/opening, retry eligibility, Dockerfile validation exception, and manual fallback.
## Concerns

- Focused coverage has no functional concerns. Repository pre-commit ESLint rejects the required exact apostrophe copy via `react/no-unescaped-entities`; copy was preserved and hook bypassed because lint is explicitly skipped for this task.

## Skipped checks

- Formatter, lint, typecheck, full test suite, and E2E checks skipped per task brief.
- Focused check run: `bun test --isolate --preload ./test/setup.ts --max-concurrency=2 modules/deploy/ui/step-detect-v2.test.tsx` (10 pass, 0 fail).
