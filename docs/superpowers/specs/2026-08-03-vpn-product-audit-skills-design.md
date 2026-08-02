# VPN Product Audit Skills Design

**Date:** 2026-08-03  
**Status:** Approved for specification review  
**Scope:** Projects Green VPN `/portal/vpn/**` and `/console/vpn/**`

## Problem

VPN knowledge is split across source code, feature notes, strategy stories, and a console-only E2E checklist. The current material mixes implementation presence, UI exposure, runtime proof, and roadmap gaps. A feature can appear implemented in code while its route is missing, its permission boundary is wrong, or its end-to-end flow remains unverified.

The audit must answer four questions for every VPN product outcome:

1. What exists in source?
2. What is exposed on the correct admin or user surface?
3. What has been manually verified with evidence?
4. What gap blocks product readiness?

The process must be repeatable and must not create one oversized Obsidian note.

## Decisions

- Use a small skill family, not one large workflow.
- Scope the first audit to Green portal admin and console user surfaces.
- Treat UniVPN as a downstream contract dependency, not a full first-pass client audit.
- Keep three independent evidence states: source presence, surface verification, and end-to-end readiness.
- Keep the Obsidian vault as the durable audit ledger. Do not add a repo JSON manifest in the first version.
- Reuse `E2E VPN.md` as the canonical VPN feature ledger.
- Keep `VPN Strategy.md` as roadmap and prioritization; link to the ledger instead of copying its rows.
- Record dated verification runs separately from the canonical ledger.

## Goals

- Inventory VPN outcomes from source, routes, APIs, tests, and vault notes.
- Cover portal admin, console user, and cross-surface workflows.
- Distinguish missing implementation from missing route, broken contract, failed verification, and blocked runtime access.
- Require evidence before marking a browser result as pass.
- Make repeated audits produce a small, comparable diff instead of duplicate prose.
- Keep active notes below the vault's 200-line soft and 250-line hard limits.

## Non-goals

- Full UniVPN mobile or desktop audit.
- Automatic browser login or credential storage.
- Replacing unit, integration, or Playwright tests.
- Rewriting VPN product behavior during an audit.
- Creating a second copy of every service or test in Obsidian.
- Automatically archiving or deleting notes without explicit confirmation.
- Building a repository-owned JSON synchronization format in the first version.

## Skill family

### `Skill - VPN Product Audit`

Use for static product inventory and gap analysis. It reads the current repository and relevant vault hubs, maps source artifacts to user outcomes, and updates candidate ledger rows. It must not call an implementation complete merely because a service or test exists.

Required stages:

1. Load repository rules, the Obsidian entry flow, `SCHEMA`, the VPN MOC, Green and Uni hubs, and existing VPN feature/E2E notes.
2. Query the existing graph before broad source search when `graphify-out/graph.json` exists.
3. Enumerate portal routes, console routes, API groups, workers, components, and tests.
4. Normalize implementation artifacts into outcome-level rows. A service, DTO, worker, or test is evidence for a row; it is not automatically a row.
5. Assign `sourceState` from source evidence.
6. Assign expected surface, role, route, preconditions, and expected visible outcome.
7. Classify gaps without marking manual verification as complete.
8. Produce a compact change summary for the ledger and a list of candidates for manual verification.

### `Skill - E2E Feature Verification`

Extend the existing console-only procedure to support both portal and console. The skill remains the authority for manual browser evidence.

Each browser candidate requires:

- fresh authenticated session;
- explicit role and organization;
- exact route and URL;
- happy-path interaction;
- one meaningful failure or permission boundary;
- visible expected result;
- timestamp and screenshot, log, or equivalent evidence;
- status update in the owning VPN ledger row.

No credentials or secrets may enter the vault, repository, screenshots, or logs. Runtime and authentication failures use `blocked`, not `missing` or `pass`.

### `Skill - Maintain Feature Audit Ledger`

Use after static or browser verification. It owns vault hygiene:

- update only changed rows;
- keep one canonical row per user/admin outcome;
- cite source paths and verification evidence;
- bump `updated` on edits and `lastVerified` only after human confirmation;
- split notes before the 250-line hard limit;
- keep `log.md` to its latest ten top-level entries and place durable run detail in dated run notes under `Projects/Projects Green/Testing/E2E Testing/`;
- link new notes from a project hub, local index, Area hub, or MOC;
- do not duplicate full feature descriptions between `VPN Features.md`, `VPN Strategy.md`, and the ledger;
- archive only after explicit confirmation that content is superseded.

## Vault artifacts

```text
Meta/Skills/
  Skill - VPN Product Audit.md
  Skill - E2E Feature Verification.md
  Skill - Maintain Feature Audit Ledger.md

Projects/Projects Green/
  Features/
    VPN Features.md
    VPN Subscriptions & Packages.md
    VPN Mobile Pairing & WireGuard.md
    VPN Strategy.md
  Testing/E2E Testing/
    E2E VPN.md
    E2E VPN Run - YYYY-MM-DD.md
```

`E2E VPN.md` is the canonical ledger. A run note records what was checked, what changed, and the evidence used. `VPN Features.md` remains an index. Existing detailed feature notes remain source-oriented. `VPN Strategy.md` remains prioritized roadmap material.

## Ledger schema

Each row describes a product outcome, not a source file.

| Field | Allowed values or content |
|---|---|
| `feature` | Human-readable admin or user outcome |
| `surface` | `portal`, `console`, `cross-surface`, `backend-only` |
| `role` | `super_admin`, `owner/admin`, `member`, `system` |
| `route` | Exact route or `route unknown` |
| `preconditions` | Required account, subscription, server, balance, or auth state |
| `expected` | Observable result |
| `sourceState` | `present`, `partial`, `missing` |
| `surfaceState` | `verified`, `failed`, `route-unknown`, `not-console`, `blocked`, `not-applicable` |
| `readiness` | `ready`, `gap`, `blocked`, `unknown` |
| `gapType` | `none`, `implementation`, `route`, `permission`, `contract`, `runtime`, `operations`, `evidence` |
| `sources` | Repository paths, vault notes, or test references |
| `evidence` | URL, timestamp, screenshot/log reference, or explicit `—` |
| `lastVerified` | Date of last human confirmation |
| `playwrightTag` | Exact existing E2E tag or `—` |

`sourceState`, `surfaceState`, and `readiness` are independent. For example, a backend route may be `present`, its portal route may be `route-unknown`, and readiness may be `gap`.

## Gap taxonomy

- **Implementation gap:** required behavior has no supporting source.
- **Route gap:** source/API exists but the intended portal or console surface is absent or unconfirmed.
- **Permission gap:** the wrong role can see or execute an action, or the correct role is denied.
- **Contract gap:** portal, console, API, billing, provisioning, or Uni dependency disagree on shape or lifecycle.
- **Runtime gap:** deployment, worker, database, SSH, auth, or environment prevents the expected behavior.
- **Operations gap:** missing reconciliation, health visibility, audit trail, retry behavior, recovery, or observability.
- **Evidence gap:** behavior may exist but has no current manual or automated proof.

`blocked` means the audit could not execute because of an external prerequisite. It does not mean the feature is absent. `failed` means the expected behavior was exercised and did not work.

## Initial outcome inventory

The first ledger pass should normalize these areas, then confirm or split them using current source evidence.

### Portal admin

- Regions management.
- SSH key management.
- Server inventory and protocol capabilities.
- Package management.
- Subscription portfolio and detail.
- Provisioning retry, validate, recreate, revoke, and retry-all actions.
- VPN audit logs.
- WireGuard or VPN health and connection operations.

### Console user

- VPN dashboard.
- Package catalog and purchase.
- Subscription list and detail.
- OpenVPN/WireGuard config download and proxy credentials.
- Cancellation and reinstatement.
- Device pairing QR.
- Paired device list and revoke.
- User-visible provisioning, billing, and access errors.

### Cross-surface

- Admin package/server changes appear in the user catalog.
- Purchase debits billing, creates accounts, provisions servers, and exposes usable credentials/configuration.
- Admin retry, recreate, or revoke changes user-visible state and access.
- Cancellation and renewal state enforce the documented access boundary.
- Green API profile/pairing contracts match UniVPN expectations.

## Verification flow

```text
Static inventory
  → outcome ledger
  → portal/console route selection
  → authenticated manual check
  → happy path + boundary case
  → evidence capture
  → ledger update
  → dated run summary
  → gap/roadmap links
```

Static inventory can run without live access. Browser verification must record `blocked` when authentication, browser dependencies, or an authorized runtime are unavailable. The current repository history already records absent auth states and blocked live browser checks; the new workflow must preserve that distinction.

Cross-surface scenarios have higher value than isolated page checks:

1. Admin creates or activates region/server/package; user sees expected catalog result.
2. User purchases package; billing, subscription, provisioning, and config/pairing states progress correctly.
3. Admin retries, recreates, or revokes an account; user sees the corresponding state and access restriction.
4. User cancels or reinstates; renewal and access rules match the subscription state.
5. User pairs a device; profile delivery, session lifecycle, and device revoke behave consistently.

## Repeatability and comparison

Every run has a date and a stable feature key. A rerun:

1. loads the previous ledger;
2. rechecks source and route evidence;
3. executes only pending, failed, stale, or changed rows when live access exists;
4. records a new run note;
5. changes `lastVerified` only for rows actually confirmed;
6. reports state transitions such as `route-unknown → verified` or `blocked → pending`.

Unchanged evidence is referenced, not copied. A run note must state what was skipped and why.

## Acceptance criteria for the eventual implementation

- Three skills exist under `Meta/Skills/` with discoverable descriptions and no duplicated workflow rules.
- Existing `Skill - E2E Feature Verification` supports both portal and console roles.
- `E2E VPN.md` contains outcome-level rows for portal, console, and cross-surface scenarios.
- Each row separates source presence, surface verification, readiness, gap type, and evidence.
- No row has `surfaceState: verified` or `readiness: ready` without evidence appropriate to its state.
- Blocked runtime/auth conditions remain visibly distinct from missing implementation.
- Dated VPN run notes preserve evidence and state transitions.
- Vault links, frontmatter dates, and note-size rules remain valid.
- UniVPN is linked as a dependency without expanding the first audit into a full client audit.
- The workflow can be rerun without creating duplicate rows or an oversized note.

## Related sources

- `modules/vpn/admin/api/index.ts`
- `modules/vpn/subscriptions/api/index.ts`
- `modules/vpn/mobile/api/index.ts`
- `app/[lang]/portal/vpn/**`
- `app/[lang]/console/vpn/**`
- `Projects/Projects Green/Features/VPN Subscriptions & Packages.md`
- `Projects/Projects Green/Features/VPN Mobile Pairing & WireGuard.md`
- `Projects/Projects Green/Strategy/VPN Strategy.md`
- `Projects/Projects Green/Testing/E2E Testing/E2E VPN.md`
- `Meta/Skills/Skill - E2E Feature Verification.md`
- `MOCs/MOC - VPN.md`
