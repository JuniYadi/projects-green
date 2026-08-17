# WorkOS Redirects Kubernetes-Safe CI Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clear PR #455's blocking Super-Linter failure while preserving the verified Kubernetes-safe WorkOS redirect behavior and closing the small Codecov gap.

**Architecture:** Keep the runtime-over-build-time redirect precedence and allowlisted logout URL implementation unchanged. Normalize the committed environment template so the ENV validator can lint the file without forcing a workflow-wide exemption, then add one focused test for the unset public redirect branch reported by Codecov.

**Tech Stack:** Next.js App Router, WorkOS AuthKit, TypeScript, Bun tests, Docker, GitHub Actions Super-Linter, dotenv-linter.

---

## Findings and decisions

- PR #455 is open at `f7d86224`, targets `main`, and is `UNSTABLE` only because Super-Linter failed in run `32016696610`, job `95347580314`.
- The direct `gh run view --log-failed` output shows the sole failure is `ENV` on `.env.example`: 74 `QuoteCharacter` and `UnorderedKey` violations. YAML, Markdown, TypeScript, Prettier, tests, coverage, build, typecheck, CodeQL, review, and Codecov status checks passed.
- `VALIDATE_ALL_CODEBASE=false` still validates the whole changed `.env.example`; its pre-existing quoted, logically grouped values become blocking when the file is touched.
- The recommended fix is to make `.env.example` dotenv-linter compliant, not disable the ENV validator. Remove unnecessary quote delimiters, alphabetize keys while retaining useful comments and values, and verify parsed values before/after normalization. This is a deliberate template cleanup, not a redirect behavior change.
- Codecov reports three uncovered lines in `lib/workos-redirect.ts:17-19`; add an unset `NEXT_PUBLIC_WORKOS_REDIRECT_URI` test. Do not expand scope to the pre-existing `getSafeNext` concern.
- The branch is currently checked out and tracks `origin/fix/workos-redirects-kubernetes-safe`. It diverges from `origin/main` by one commit each way, so rebase before implementation; do not force-push until the resulting history is reviewed.

## Implementation tasks

### Task 1: Rebase the target branch

**Files:** None.

1. Fetch `origin` and rebase `fix/workos-redirects-kubernetes-safe` onto `origin/main`.
2. If conflicts occur, preserve the existing redirect helpers, route integration, Docker build contract, and tests; resolve only the upstream overlap.
3. Confirm the branch contains the PR commit plus the current `main` tip before editing.

### Task 2: Normalize the environment template

**Files:**
- Modify: `.env.example`

1. Preserve every variable, comment, example value, and the two WorkOS contracts:
   - `NEXT_PUBLIC_WORKOS_REDIRECT_URI` is the build-time callback.
   - `WORKOS_REDIRECT_URI` is the runtime Kubernetes override.
2. Remove quote characters where dotenv-linter rejects them, checking that values containing spaces, angle brackets, colons, slashes, and commas retain the same parsed value.
3. Order variable assignments alphabetically as required by the ENV validator; keep explanatory comments attached to the relevant variables.
4. Do not move secrets into the repository or add real credentials.

### Task 3: Cover the unset public redirect branch

**Files:**
- Modify: `lib/workos-redirect.test.ts`

1. Follow the existing `beforeEach` environment reset pattern.
2. Add a test that deletes `NEXT_PUBLIC_WORKOS_REDIRECT_URI` and asserts `getWorkOSPublicOrigin()` returns `undefined`.
3. Restore environment defaults through the test setup so the test is isolated and does not affect logout or route tests.

### Task 4: Verify the remediation

**Files:** None.

Run the repository's changed-path checks:

```bash
bun run lint -- lib/workos-redirect.test.ts
bun run test:changed
bun run test:coverage:changed
bun run typecheck
```

Also verify the build/config contracts:

```bash
DATABASE_URL=postgresql://localhost:5432/dummy \
NEXT_PUBLIC_WORKOS_REDIRECT_URI=https://pfnapp.my.id/callback \
bun run build

docker build --check \
  --build-arg NEXT_PUBLIC_WORKOS_REDIRECT_URI=https://pfnapp.my.id/callback \
  -f Dockerfile.web .
```

The CI acceptance check is `gh pr checks 455`: Super-Linter must pass, with no regression in the already-passing changed tests, coverage, typecheck, build, CodeQL, review, or Codecov checks.

### Task 5: Commit and update PR #455

**Files:**
- Commit `.env.example`, `lib/workos-redirect.test.ts`, and any conflict-resolution files only.

1. Use a focused commit message such as `fix(ci): satisfy env lint for WorkOS redirect config`.
2. Push the existing `fix/workos-redirects-kubernetes-safe` branch to `origin`; do not create a second PR.
3. Re-check PR #455 status and report the new workflow run URL and any remaining advisory findings.

## Out of scope

- No changes to redirect precedence, origin allowlisting, locale handling, cookie security, Docker runtime semantics, or logout input handling.
- No fix for the pre-existing `getSafeNext` validation surface.
- No disabling of Super-Linter ENV validation and no unrelated repository-wide env reformat beyond what is required to make `.env.example` pass its validator.
