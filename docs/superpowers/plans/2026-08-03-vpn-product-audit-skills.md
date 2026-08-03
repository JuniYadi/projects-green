# VPN Product Audit Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a repeatable VPN product-audit skill family, extend browser verification to portal and console, and seed a bounded Obsidian ledger with current Green VPN feature/gap evidence.

**Architecture:** Keep the vault as the durable audit record. Separate static inventory (`Skill - VPN Product Audit`), manual proof (`Skill - E2E Feature Verification`), and vault hygiene (`Skill - Maintain Feature Audit Ledger`). Reuse `E2E VPN.md` as the canonical outcome ledger and add dated VPN run notes for evidence snapshots.

**Tech Stack:** Markdown skills, Obsidian vault at `.obsidian.json.directory`, Next.js route/source inspection, existing `graphify-out/graph.json`, manual browser verification, repository tests and E2E metadata.

## Global Constraints

- Use `bun` for project commands; do not use `npm` or `yarn`.
- Read `.obsidian.json`, then follow `Meta/SESSION-BRIEFING.md`, `index.md`, `log.md`, `SCHEMA.md`, `_Skills.md`, relevant hubs, and the VPN MOC before vault edits.
- Use current repository source and runtime evidence over stale vault claims; mark stale claims instead of silently treating them as current.
- Keep one row per product outcome, not one row per service, DTO, worker, or test file.
- Keep independent fields `sourceState`, `surfaceState`, `readiness`, `gapType`, and `evidence`.
- Do not mark `surfaceState: verified` or `readiness: ready` without evidence appropriate to that state.
- Keep authentication credentials and secrets out of notes, screenshots, logs, and repository files.
- Record external prerequisites as `blocked`, not `missing` or `failed`.
- Use only tags from `SCHEMA.md`; bump `updated` on edits and `lastVerified` only after human confirmation.
- Keep active notes below the 200-line soft cap and never exceed the 250-line hard cap.
- Create and verify one new skill at a time. Follow RED → GREEN → REFACTOR pressure testing from `writing-skills`.
- Do not create a repository JSON manifest in this implementation.

---

### Task 1: Establish the shared audit contract and baseline failures

**Files:**
- Read: `docs/superpowers/specs/2026-08-03-vpn-product-audit-skills-design.md`
- Read: `.obsidian.json`
- Read: `Meta/Skills/Skill - E2E Feature Verification.md`
- Read: `Projects/Projects Green/Testing/E2E Testing/E2E VPN.md`
- No permanent file created for pressure scenarios.

**Interfaces:**
- Produces the exact ledger fields and status vocabulary consumed by all later tasks:
  `feature`, `surface`, `role`, `route`, `preconditions`, `expected`,
  `sourceState`, `surfaceState`, `readiness`, `gapType`, `sources`, `evidence`,
  `lastVerified`, and `playwrightTag`.
- Produces observed baseline rationalizations for each skill before editing it.

- [ ] Run a fresh-context pressure scenario without `Skill - VPN Product Audit`: ask for a VPN feature inventory under time pressure and check whether the agent confuses source presence with product readiness.
- [ ] Run a second baseline scenario without the skill: provide a backend route and no confirmed page, then check whether the agent marks it as verified instead of route-unknown or evidence-gap.
- [ ] Run a third baseline scenario without the skill: make browser authentication unavailable and check whether the agent calls the feature missing instead of blocked.
- [ ] Record the exact failure patterns in the implementation session; do not put transient pressure transcripts in the vault.
- [ ] Run a fresh-context baseline against the current E2E skill with a portal-admin scenario and confirm that its console-only wording omits portal role and route handling.
- [ ] Define stable feature keys using lowercase domain and outcome names, such as `vpn.portal.regions`, `vpn.console.purchase`, and `vpn.cross.purchase-provision-config`.

**Expected result:** Later skills address observed failures rather than hypothetical guidance, and all skills share one schema.

### Task 2: Create `Skill - VPN Product Audit`

**Files:**
- Create: `/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/Meta/Skills/Skill - VPN Product Audit.md`
- Modify: `/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/Meta/Skills/_Skills.md`
- Modify: `/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/Projects/Projects Green/Features/VPN Features.md` only if a link to the audit ledger is missing.

**Interfaces:**
- Consumes: repository rules, graph query output, VPN source paths, and current vault hubs.
- Produces: outcome-level static inventory with `sourceState`, expected surface, role, route, preconditions, expected result, gap type, and source pointers.

- [ ] Write the failing pressure scenarios from Task 1 as acceptance checks before writing the skill body.
- [ ] Add YAML frontmatter with title, dates, `type: process`, valid tags, `status: current`, and `project: green`.
- [ ] Write a trigger description that starts with `Use when...` and mentions VPN feature inventory, portal/console parity, source-vs-surface gaps, and stale product documentation.
- [ ] Add a compact overview stating that source presence never proves user-visible readiness.
- [ ] Document the required boot sequence: `.obsidian.json` → `Meta/SESSION-BRIEFING.md` → `index.md` → `log.md` → `SCHEMA.md` → `_Skills.md` → VPN MOC and project notes.
- [ ] Require `graphify query` before broad search when `graphify-out/graph.json` exists.
- [ ] Document source mapping for `app/[lang]/portal/vpn/**`, `app/[lang]/console/vpn/**`, `modules/vpn/admin/api/index.ts`, `modules/vpn/subscriptions/api/index.ts`, and `modules/vpn/mobile/api/index.ts`.
- [ ] Document outcome normalization: portal admin, console user, cross-surface, and backend-only rows.
- [ ] Add the exact three-state ledger table and gap taxonomy from the approved design.
- [ ] Add explicit rules for `route unknown`, `not-console`, `blocked`, `failed`, `partial`, and `missing`.
- [ ] Add one VPN example showing a present backend route with an unconfirmed portal surface and an evidence gap.
- [ ] Add common mistakes: one row per source file, treating tests as proof, copying stale strategy rows, and marking a blocked browser run as missing.
- [ ] Link the skill to `[[E2E VPN]]`, `[[VPN Strategy]]`, `[[MOC - VPN]]`, and `[[Skill - E2E Feature Verification]]`.

**Expected result:** A future agent can build a source-grounded VPN inventory without prematurely claiming browser or product readiness.

### Task 3: Verify and harden `Skill - VPN Product Audit`

**Files:**
- Modify: `/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/Meta/Skills/Skill - VPN Product Audit.md`

**Interfaces:**
- Consumes: Task 1 baseline failures.
- Produces: a skill that passes the same pressure scenarios and resists new rationalizations.

- [ ] Run the three Task 1 pressure scenarios with the new skill loaded.
- [ ] Confirm output separates `sourceState`, `surfaceState`, `readiness`, `gapType`, and `evidence`.
- [ ] Confirm an unavailable browser is recorded as `blocked`.
- [ ] Confirm a backend-only feature is not forced into a portal or console pass.
- [ ] Add a rationalization counter for every new failure found.
- [ ] Add a short red-flags section for `service exists`, `test exists`, `route guessed`, `browser unavailable`, and `stale note copied`.
- [ ] Re-run until the scenarios produce stable status vocabulary and outcome-level rows.

**Expected result:** Static audit guidance is tested before it becomes the source for ledger updates.

### Task 4: Extend `Skill - E2E Feature Verification` to portal and console

**Files:**
- Modify: `/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/Meta/Skills/Skill - E2E Feature Verification.md`
- Modify: `/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/Meta/Skills/_Skills.md` only if its description still says console-only.

**Interfaces:**
- Consumes: Task 1 shared contract and Task 2 static inventory.
- Produces: manual verification procedure for `portal`, `console`, and cross-surface rows.

- [ ] Run the portal-admin baseline against the current skill and record omitted requirements.
- [ ] Add portal roles: `super_admin` and tenant `owner/admin`; keep `member` for console.
- [ ] Add exact route and locale requirements for both `/portal/vpn/**` and `/console/vpn/**`.
- [ ] Require one happy path and one meaningful permission, validation, lifecycle, or missing-precondition boundary per browser row.
- [ ] Define `verified`, `failed`, `blocked`, `route-unknown`, `not-console`, and `not-applicable` semantics without conflating them.
- [ ] Require screenshot, log, or equivalent evidence for every verified or failed row; keep `evidence: —` for pending rows.
- [ ] Add cross-surface verification rules for package visibility, purchase-to-provisioning, admin revoke/retry, cancellation/renewal, and pairing/device revoke.
- [ ] Keep credentials out of notes and screenshots.
- [ ] Add `playwrightTag` lookup rules and preserve the existing `@e2e/<domain>/<role>/<scenario>` format.
- [ ] Link the skill to `[[E2E VPN]]`, `[[E2E Testing Index]]`, `[[Skill - VPN Product Audit]]`, and `[[Skill - Maintain Feature Audit Ledger]]`.

**Expected result:** The existing skill can verify both admin and user surfaces without requiring a second browser-verification procedure.

### Task 5: Verify and harden the extended E2E skill

**Files:**
- Modify: `/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/Meta/Skills/Skill - E2E Feature Verification.md`

**Interfaces:**
- Consumes: Task 4 portal/console rules.
- Produces: stable manual-verification behavior under missing auth, wrong role, missing precondition, and visible failure pressure.

- [ ] Run a portal happy-path scenario with a super-admin role.
- [ ] Run a console happy-path scenario with a tenant member role.
- [ ] Run a wrong-role scenario and confirm it records a permission result rather than a generic failure.
- [ ] Run a missing-precondition scenario and confirm it records the observed product message.
- [ ] Run an unavailable-auth/runtime scenario and confirm it records `blocked` with the external blocker.
- [ ] Confirm no scenario stores a credential, token, or secret.
- [ ] Add counters for any new ambiguity and repeat the scenarios.

**Expected result:** Manual verification produces evidence-backed rows and preserves blocked versus failed semantics.

### Task 6: Convert `E2E VPN.md` into the canonical outcome ledger

**Files:**
- Modify: `/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/Projects/Projects Green/Testing/E2E Testing/E2E VPN.md`
- Modify: `/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/Projects/Projects Green/Testing/E2E Testing/E2E Testing Index.md`
- Modify: `/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/Projects/Projects Green/Features/VPN Strategy.md` only to link to the canonical ledger and remove duplicate status claims.
- Modify: `/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/Projects/Projects Green/Features/VPN Features.md` only to link to the ledger if missing.

**Interfaces:**
- Consumes: Tasks 2–5 skills and current source evidence.
- Produces: one outcome-level ledger consumed by future audit and verification runs.

- [ ] Preserve the existing frontmatter and bump `updated` and `lastVerified` only according to evidence actually collected.
- [ ] Replace service/test-file checklist rows with stable outcome rows while retaining backend-only rows only when they explain an operational dependency.
- [ ] Add portal rows for regions, SSH keys, servers/protocols, packages, subscription portfolio/detail, provisioning actions, audit logs, and health/WireGuard operations.
- [ ] Add console rows for dashboard, catalog/purchase, subscriptions, config/credentials, cancellation/reinstatement, pairing QR, devices/revoke, and user-visible error states.
- [ ] Add cross-surface rows for package visibility, purchase-to-provision-config, admin provisioning actions, lifecycle access boundaries, and Green-to-Uni profile/pairing contract.
- [ ] For every row, fill exact route or `route unknown`, role, preconditions, expected result, source pointers, status fields, and `playwrightTag` or `—`.
- [ ] Use current source to set `sourceState`; do not infer it from the old `VPN Strategy` score.
- [ ] Set manual rows to `pending` or `blocked` until an evidence-bearing run confirms them.
- [ ] Link `E2E VPN.md` from the E2E index, VPN feature index, VPN strategy, and the three skills.
- [ ] Keep the note under 250 lines; split only by outcome group if the cap would be exceeded.

**Expected result:** The vault has one compact VPN ledger that states what exists, what is exposed, what is verified, and what remains a gap.

### Task 7: Create the first dated VPN audit run

**Files:**
- Create: `/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/Projects/Projects Green/Testing/E2E Testing/E2E VPN Run - 2026-08-03.md`
- Modify: `/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/log.md`
- Modify: `/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/Projects/Projects Green/Testing/E2E Testing/E2E VPN.md`

**Interfaces:**
- Consumes: canonical ledger and current static/browser evidence.
- Produces: dated evidence snapshot and state-transition summary.

- [ ] Add valid frontmatter with `type: process`, project/tag fields, `status: current`, and `lastVerified` only if a human verification occurred.
- [ ] Record run scope, repository revision, vault sources, timestamp, and verifier role without credentials.
- [ ] Record static inventory findings separately from browser findings.
- [ ] Attempt the browser preflight for portal and console; if auth state, browser dependency, or authorized runtime is unavailable, record `blocked` with exact blocker evidence.
- [ ] Record each executed scenario with feature key, route, role, expected result, observed result, status, and evidence reference.
- [ ] Record skipped scenarios and their reason; do not silently omit them.
- [ ] Summarize state transitions from the previous ledger, including new implementation, route, contract, operations, runtime, and evidence gaps.
- [ ] Update only affected ledger rows and bump `lastVerified` only for confirmed rows.
- [ ] Add one compact `create` or `update` entry to `log.md`; keep older log detail out of the ten-entry dashboard.
- [ ] Link the run note from `E2E VPN.md` and the E2E index.

**Expected result:** The initial audit is reproducible even if live browser verification is blocked, and the blocker is not mistaken for a product gap.

### Task 8: Create and verify `Skill - Maintain Feature Audit Ledger`

**Files:**
- Create: `/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/Meta/Skills/Skill - Maintain Feature Audit Ledger.md`
- Modify: `/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/Meta/Skills/_Skills.md`
- Modify: `/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/Meta/SESSION-BRIEFING.md` only if the skill routing list needs the new workflow.

**Interfaces:**
- Consumes: ledger schema, run-note format, `SCHEMA.md`, and existing vault navigation rules.
- Produces: bounded, deduplicated, linkable audit records.

- [ ] Run a baseline scenario without the skill: provide a growing audit note and stale duplicate feature notes; observe whether the agent appends prose, duplicates rows, or ignores note limits.
- [ ] Add frontmatter with valid process metadata and a trigger description for feature ledgers, audit runs, stale evidence, duplicate notes, and Obsidian size limits.
- [ ] Document canonical ownership: `E2E VPN.md` owns outcome rows, run notes own evidence snapshots, feature notes own behavior/source detail, and `VPN Strategy.md` owns prioritization.
- [ ] Document idempotent updates by stable feature key; unchanged evidence is referenced, not copied.
- [ ] Document date rules for `updated` and `lastVerified`.
- [ ] Document the 200/250-line thresholds, link requirements, valid tags, and explicit-confirmation archive rule.
- [ ] Add a compact example of a state transition such as `route-unknown → verified`.
- [ ] Run the baseline scenario with the skill loaded and verify no duplicate row or oversized note is produced.
- [ ] Add rationalization counters and rerun until stable.
- [ ] Add links to the audit and E2E skills, ledger, run-note pattern, `SCHEMA`, and VPN MOC.

**Expected result:** Repeated audits update the same ledger and create bounded run evidence without vault sprawl.

### Task 9: Final vault and repository verification

**Files:**
- Read: all three skills, `_Skills.md`, `E2E VPN.md`, first run note, E2E index, VPN features, VPN strategy, and MOC.
- Modify: only files with failed checks.

**Interfaces:**
- Consumes: all completed artifacts.
- Produces: verified handoff ready for future audit runs.

- [ ] Check every new or modified note has required frontmatter fields and only approved tags.
- [ ] Check every active note has at least two outbound wikilinks and is reachable from an appropriate hub or MOC.
- [ ] Check no active note exceeds 250 lines.
- [ ] Check exactly one canonical VPN ledger exists; no competing feature matrix was created.
- [ ] Check all three skill names appear in `Meta/Skills/_Skills.md` with trigger-focused descriptions.
- [ ] Check every ledger row has a stable feature key, route value, role, status fields, source pointer, and evidence placeholder or reference.
- [ ] Check no row claims `surfaceState: verified` or `readiness: ready` without evidence.
- [ ] Check blocked runtime/auth conditions are not labeled missing or failed.
- [ ] Check strategy notes link to the ledger without duplicating its rows.
- [ ] Run `graphify update .` only if repository code changed; vault-only changes do not require a code graph update.
- [ ] Run `bun run typecheck` only if a TypeScript file changed; for vault-only changes, check frontmatter, wikilinks, and line counts directly with `read` and `wc -l`, and do not claim repository tests for documentation-only work.

**Expected result:** The audit skill family, ledger, and first run are internally consistent and ready for repeat use.

## Completion criteria

The implementation is complete when Tasks 1–9 pass and the following are true:

- Three skills exist in `Meta/Skills/` and are discoverable from `_Skills.md`.
- Existing E2E verification covers portal and console roles.
- `E2E VPN.md` is outcome-level and bounded.
- First dated VPN run records static evidence, manual evidence or blockers, and state transitions.
- `VPN Strategy.md` remains roadmap-only and links to the ledger.
- No secrets are recorded.
- No feature is marked verified or ready without evidence.
- A second run can update existing feature keys without duplicate rows or oversized notes.
