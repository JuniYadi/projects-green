# Task 2 report

## Files

- `modules/deploy/ui/step-source-v2.tsx`
- `modules/deploy/ui/step-connect-v2.tsx`
- `modules/deploy/ui/step-source.test.tsx`

## Behavior

- Source stage now leads with `What would you like to publish?` and outcome-led guidance.
- Source cards render in template, GitHub, public order with exact approved labels, descriptions, template badge, `aria-pressed` semantic button headers, and expanded controls outside headers.
- GitHub and public field labels, public trust warning, and disabled/ready continuation CTA copy match approved requirements.
- Existing source callbacks, state props, payload-facing fields, and validation behavior remain unchanged.
- Connect stage now uses `Your project is selected`, calm setup copy, and `Check my site` CTA while retaining source details and Back behavior.
- Skipped legacy source assertions were removed; active tests cover source cards, template catalog controls, GitHub controls, public safety disclosure, and CTA state.

## Concerns

- No known functional concerns. Existing LSP warnings/hints (serializable client callbacks and deprecated icon exports) predate this change and were not altered.

## Checks skipped

- Formatter, lint, typecheck, full test suite, and E2E checks skipped per task brief.
- Focused source test run passed: `bun test --isolate --preload ./test/setup.ts --max-concurrency=2 modules/deploy/ui/step-source.test.tsx` (7 passed).
