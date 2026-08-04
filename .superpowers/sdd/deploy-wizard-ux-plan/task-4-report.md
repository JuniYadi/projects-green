# Task 4 report

## Changed files

- `modules/deploy/ui/step-review-v2.tsx`
- `modules/deploy/ui/step-environment-v2.tsx`
- `modules/deploy/ui/resource-plan-selector.tsx`
- `modules/deploy/ui/step-environment-v2.test.tsx`

## Behavior

- Review heading now reads `Choose your web address & plan` with approved guidance copy.
- Review defaults expose `Web address` and `Hosting plan` cards. Generated `pfn.app` address remains selected and marked `Recommended`; plan IDs and callbacks remain `starter`, `pro`, and `payg`.
- Recommendation badge reads `Recommended for this site`.
- Build summary/edit action, environment variables, pay-as-you-go CPU/memory controls, and attached resources live in one native `Advanced settings` disclosure, closed initially.
- Hidden-field validation forces Advanced settings open and shows `Environment settings need attention` with existing messages above affected controls. Custom-domain errors remain in the visible Web address card.
- Readiness copy is `Ready to publish at <targetDomain>.`; submit errors remain visible; CTA reads `Publish site` and `Publishing site…` while submitting.
- Active tests cover review copy, generated/custom address behavior, recommended plan, disclosure state and validation, plan callbacks, readiness/submit, and submit errors.

## Verification

Passed:

```text
bun test --isolate --preload ./test/setup.ts --max-concurrency=2 modules/deploy/ui/step-environment-v2.test.tsx
7 pass, 0 fail

bun test --isolate --preload ./test/setup.ts --max-concurrency=2 modules/deploy/ui/step-environment.test.tsx modules/deploy/ui/pay-as-you-go-selector.test.tsx
9 pass, 0 fail
```

Skipped per task context: formatter, lint, typecheck, full test suite, and E2E.

## Concerns

- No known contract concerns. Existing StepEnvironmentV2 props, callbacks, validation inputs, and deployment payload path remain unchanged.
