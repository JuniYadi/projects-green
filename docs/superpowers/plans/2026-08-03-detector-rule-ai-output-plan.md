# Detector Rule and AI Output Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop GitHub framework detection 422s caused by malformed AI decision output while preserving `DetectorRule` BLOCK, HINT, and LAUNCH policy behavior.

**Architecture:** Keep `DetectorRule` as a policy layer. Run exact file-based BLOCK checks before AI, provide active rules as HINT context, validate AI output with AI SDK 6 structured output, then apply runtime mappings and LAUNCH policy. Record rule context in internal inspection failure logs without exposing it in the public error response.

**Tech Stack:** Bun 1.3.14, TypeScript 5.9, Elysia, Zod 4, Prisma 7, Vercel AI SDK 6, Bun test, Next.js console UI.

## Global Constraints

- Use `bun` for all project commands; do not use `npm` or `yarn`.
- Do not run destructive Prisma commands.
- Keep Prisma types imported from `@prisma/client`; do not add manual model mirrors.
- Preserve explicit DTO mapping and sanitized public API errors.
- Follow TypeScript style: strict types, 2-space indent, no semicolons, double quotes, `@/*` imports.
- Do not make DetectorRule override repository evidence by default.
- Do not silently coerce malformed AI values such as `95` into `0.95`.
- Do not add dependency-pattern BLOCK matching without a deterministic dependency inventory.
- Run focused tests through the repository Bun preload runner.

---

### Task 1: Lock AI and DetectorRule contracts with failing tests

**Files:**
- Modify: `modules/framework-detection/framework-detection.service.test.ts`
- Modify: `modules/framework-detection/api/framework-detection.route.test.ts`
- Modify: `modules/framework-detection/api/detector-admin.route.test.ts`

**Interfaces:**
- Consumes: `detectFrameworkFromGithubApi`, `__testables`, `createFrameworkDetectionRoutes`, `createDetectorAdminRoutes`.
- Produces: failing regression coverage for structured AI output, policy ordering, internal rule context, and semantic rule validation.

- [ ] **Step 1: Add a failing service test for malformed AI output with active rules**

Use `detectFrameworkFromGithubApi` with:

```ts
const mockPrisma = {
  detectorRule: {
    findMany: async () => [
      {
        id: "rule-laravel-hint",
        name: "Laravel Detection",
        description: null,
        patternJson: { files: ["artisan"] },
        implicationsJson: { framework: "laravel", impact: "HINT" },
        confidenceWeight: 1,
        isActive: true,
        priority: 10,
      },
    ],
  },
  detectorInspectionLog: { create: async () => ({}) },
  detectorRuntimeMapping: { findMany: async () => [] },
}
```

Inject `resolveWithAiToolCalling` that throws an invalid-schema error. Assert the service rejects with `Detection failed`, the inspection log receives `status: "error"`, and the log includes rule context. Assert no successful `DetectionResult` is returned.

- [ ] **Step 2: Add a failing service test proving BLOCK skips AI**

Return `fileList: ["wp-config.php"]` and an active BLOCK rule whose `patternJson.files` contains that path. Inject an AI resolver that throws if called. Assert the result has `decision.status === "blocked"`, `isLaunchable === false`, `blocked` evidence, and `blockedByRuleId` in the created inspection log.

- [ ] **Step 3: Add a failing service test proving HINT remains advisory**

Return `fileList: ["artisan", "composer.json"]` and an active HINT rule. Inject a valid AI decision for Laravel. Assert the AI resolver is called, the result reaches policy evaluation, and the HINT rule does not directly set `decision.status`.

- [ ] **Step 4: Add a failing admin-route test for malformed rule semantics**

Submit these payloads to `POST /admin/detector/rules` and assert HTTP 400:

```json
{
  "name": "Empty rule",
  "patternJson": {},
  "implicationsJson": { "impact": "HINT" }
}
```

```json
{
  "name": "Unsupported block",
  "patternJson": { "dependencies": ["laravel/framework"] },
  "implicationsJson": { "framework": "laravel", "impact": "BLOCK" }
}
```

- [ ] **Step 5: Run tests and verify the new tests fail for the intended reasons**

Run:

```bash
bun run test -- modules/framework-detection/framework-detection.service.test.ts modules/framework-detection/api/framework-detection.route.test.ts modules/framework-detection/api/detector-admin.route.test.ts
```

Expected: new tests fail because the GitHub AI path still parses raw model text, error logs lack rule context, and admin schemas accept generic JSON.

- [ ] **Step 6: Commit the failing contract tests**

```bash
git add modules/framework-detection/framework-detection.service.test.ts modules/framework-detection/api/framework-detection.route.test.ts modules/framework-detection/api/detector-admin.route.test.ts
git commit -m "test: lock detector reliability contracts"
```

---

### Task 2: Replace raw AI JSON parsing with structured output

**Files:**
- Modify: `modules/framework-detection/framework-detection.service.ts:7-9,845-969`
- Modify: `modules/framework-detection/framework-detection.service.test.ts`

**Interfaces:**
- Consumes: `AI_DECISION_SCHEMA`, `toolDefinitions`, `GithubApiDetectorDependencies`.
- Produces: `resolveWithAiToolCalling` returning a typed `AiDecisionResult` from `result.output`.

- [ ] **Step 1: Add the AI SDK structured-output import**

Change the `ai` import to retain `generateObject` for the legacy file-based detector and add `Output`:

```ts
import { generateObject, generateText, Output, stepCountIs, tool } from "ai"
```

Do not remove `generateObject`; `resolveWithAi` at `framework-detection.service.ts:708-740` still uses it.

- [ ] **Step 2: Replace `parseAiDecision` usage in `resolveWithAiToolCalling`**

Keep tool definitions and tool-call audit mapping. Change the `generateText` call to:

```ts
const result = await generateText({
  model: provider(modelName),
  system: systemPrompt,
  prompt: userPrompt,
  tools: toolDefinitions,
  output: Output.object({ schema: AI_DECISION_SCHEMA }),
  stopWhen: stepCountIs(16),
})
```

Return:

```ts
return {
  decision: result.output,
  toolCalls,
}
```

Do not regex-match `result.text`, call `JSON.parse`, or coerce values. The AI SDK and `AI_DECISION_SCHEMA` remain the validation boundary.

- [ ] **Step 3: Remove obsolete raw-parser code and tests**

Delete `parseAiDecision` from `framework-detection.service.ts` and from `__testables`. Replace raw JSON parser tests with a test of the injected resolver contract and the service rejection path. Keep the legacy `generateObject` path unchanged.

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```bash
bun run test -- modules/framework-detection/framework-detection.service.test.ts
bun run typecheck
```

Expected: structured-output tests pass; no TypeScript errors for AI SDK 6 `Output.object` or `result.output`.

- [ ] **Step 5: Commit the AI boundary fix**

```bash
git add modules/framework-detection/framework-detection.service.ts modules/framework-detection/framework-detection.service.test.ts
git commit -m "fix: use structured detector output"
```

---

### Task 3: Preserve policy order and add internal rule diagnostics

**Files:**
- Modify: `modules/framework-detection/framework-detection.service.ts:1032-1064,1345-1484`
- Modify: `modules/framework-detection/framework-detection.service.test.ts`
- Modify: `modules/framework-detection/framework-detection.dto.ts` only if the existing inspection DTO needs a typed diagnostic field; prefer no DTO/schema change.

**Interfaces:**
- Consumes: active `DetectorRuleRecord[]`, `fileList`, existing `DetectorInspectionLog` fields.
- Produces: safe public response plus internal log context identifying rule state and AI failure phase.

- [ ] **Step 1: Add a pure rule-summary helper**

Add a private/testable helper that summarizes active rules without including raw prompt content:

```ts
type DetectorRuleSummary = {
  activeCount: number
  impacts: string[]
  blockRuleNames: string[]
  launchRuleNames: string[]
}
```

Return sorted unique impact values and rule names. Export through `__testables` for deterministic tests.

- [ ] **Step 2: Record rule context only in internal inspection logs**

Before AI resolution, compute the summary. On the AI error path, append a concise internal context to `DetectorInspectionLog.errorMessage` or the existing internal log payload:

```text
DetectorRule context: activeCount=<n>; impacts=<...>; blockRules=<...>; launchRules=<...>
```

Keep `getDetectionErrorMessage()` unchanged so the public API continues returning the sanitized message. Do not add diagnostic context to public `DetectionResult.warnings`.

- [ ] **Step 3: Keep BLOCK behavior unchanged and explicit**

`checkForBlockedFrameworks` must continue to:

- sort by descending priority;
- inspect only active rules passed by the caller;
- require `implicationsJson.impact === "BLOCK"`;
- match exact `patternJson.files` entries;
- return before any AI resolver call.

Do not add dependency matching in this task.

- [ ] **Step 4: Keep HINT and LAUNCH behavior unchanged**

`buildDetectorRuleHints` continues to provide prompt context. `evaluateSupportDecision` continues to evaluate only BLOCK evidence and LAUNCH rules after a valid AI result. Do not apply `confidenceWeight` in this fix.

- [ ] **Step 5: Run the policy tests**

Run:

```bash
bun run test -- modules/framework-detection/framework-detection.service.test.ts modules/framework-detection/api/framework-detection.route.test.ts
```

Expected: BLOCK, HINT, LAUNCH, malformed-AI, and sanitized-422 tests pass.

- [ ] **Step 6: Commit policy diagnostics**

```bash
git add modules/framework-detection/framework-detection.service.ts modules/framework-detection/framework-detection.service.test.ts modules/framework-detection/api/framework-detection.route.test.ts
 git commit -m "fix: expose detector policy failure context"
```

---

### Task 4: Enforce DetectorRule semantic contracts at admin API boundary

**Files:**
- Modify: `modules/framework-detection/api/detector-admin.route.ts:16-35`
- Modify: `modules/framework-detection/api/detector-admin.route.test.ts`
- Modify: `app/[lang]/portal/app/detector/_components/rules-table.tsx:37-99`

**Interfaces:**
- Consumes: existing `DetectorRule` JSON fields and admin CRUD payloads.
- Produces: validated rule payloads with supported `BLOCK`, `HINT`, and `LAUNCH` semantics.

- [ ] **Step 1: Define reusable Zod schemas in the admin route**

Replace generic records with schemas equivalent to:

```ts
const detectorRulePatternSchema = z
  .object({
    files: z.array(z.string().trim().min(1)).optional(),
    dependencies: z.array(z.string().trim().min(1)).optional(),
    frameworkId: z.string().trim().min(1).optional(),
  })
  .refine(
    (pattern) =>
      Boolean(
        pattern.files?.length ||
          pattern.dependencies?.length ||
          pattern.frameworkId
      ),
    "At least one rule pattern is required."
  )

const detectorRuleImplicationsSchema = z.object({
  framework: z.string().trim().min(1).optional(),
  runtime: z.string().trim().min(1).optional(),
  impact: z.enum(["BLOCK", "HINT", "LAUNCH"]),
  minConfidence: z.number().min(0).max(1).optional(),
})
```

Add cross-field validation:

- `BLOCK` requires `pattern.files` because current deterministic BLOCK matching is file-based.
- `LAUNCH` requires either `pattern.frameworkId` or `implications.framework`.
- `HINT` requires either `pattern` evidence or `implications.framework`.

Use the same schemas for create and update routes. Preserve HTTP 400 with `fieldErrors` for rejected payloads.

- [ ] **Step 2: Add admin route tests for valid and invalid combinations**

Assert:

- Valid Laravel HINT `{ files: ["artisan"], dependencies: ["laravel/framework"] }` returns 201.
- Empty pattern returns 400.
- BLOCK with dependencies only returns 400.
- LAUNCH with no framework identity returns 400.
- Update rejects the same invalid combinations with 400.

- [ ] **Step 3: Make the rule form start with valid example data**

Update `EMPTY_FORM` so creating a rule does not submit `{}` by default. Keep the existing JSON editor, but use a valid Laravel HINT example matching the existing form examples:

```ts
patternJson: '{"files":["artisan"]}',
implicationsJson: '{"framework":"laravel","impact":"HINT"}',
```

Keep client JSON syntax validation. The server remains authoritative for semantic validation.

- [ ] **Step 4: Run admin tests**

Run:

```bash
bun run test -- modules/framework-detection/api/detector-admin.route.test.ts
```

Expected: valid payloads remain accepted; invalid semantic combinations return 400 with field errors.

- [ ] **Step 5: Commit admin rule validation**

```bash
git add modules/framework-detection/api/detector-admin.route.ts modules/framework-detection/api/detector-admin.route.test.ts app/[lang]/portal/app/detector/_components/rules-table.tsx
git commit -m "fix: validate detector rule semantics"
```

---

### Task 5: Verify end-to-end behavior and UI failure recovery

**Files:**
- No planned source changes.
- Browser evidence: live `/en/console/app/deploy` route.

**Interfaces:**
- Consumes: completed service/API/UI changes.
- Produces: focused test evidence, type/lint evidence, and authenticated browser evidence.

- [ ] **Step 1: Run all focused detection tests**

```bash
bun run test -- modules/framework-detection/framework-detection.service.test.ts modules/framework-detection/api/framework-detection.route.test.ts modules/framework-detection/api/detector-admin.route.test.ts
```

Expected: zero failures, including malformed-output, BLOCK/HINT/LAUNCH, sanitized-error, and admin-semantic tests.

- [ ] **Step 2: Run repository quality checks**

```bash
bun run typecheck
bun run lint
```

Expected: zero type errors and no new lint errors in changed files.

- [ ] **Step 3: Run the required repository test suite**

```bash
bun run test
```

Expected: no regressions in the logic suite. If pre-existing infrastructure failures occur, record exact failing modules and distinguish them from changed detection tests.

- [ ] **Step 4: Reproduce the authenticated browser path with MCP user-browser**

Open:

```text
https://pgreen.tunnel.juniyadi.id/en/console/app/deploy?github=connected&step=detect
```

Select the same `juniyadisocial/laravel` repository and branch `13.x`. Capture:

- Detect step accessibility snapshot;
- requests to `/api/framework-detection/github`;
- response status/body;
- console errors;
- final UI state.

Expected: no repeated 422 caused by `confidence`, `requiredRuntimeIds`, or `reasoning` shape. Final state must be either a valid detection result or a deliberate `BLOCK`/`LAUNCH` policy result.

- [ ] **Step 5: Verify DetectorRule observability**

Open the detector inspection log view as an authorized admin and verify the failed/successful inspection identifies active rule count, impacts, matched BLOCK rule when applicable, and AI failure phase without exposing internal diagnostics in the public deploy response.

- [ ] **Step 6: Update graphify after source changes**

```bash
graphify update .
```

Expected: graphify completes without AST errors and reflects changed detection symbols.


## Completion checklist

- [ ] Structured AI output replaces raw GitHub detector JSON parsing.
- [ ] AI schema remains strict; malformed values are rejected, not coerced.
- [ ] BLOCK rules still short-circuit before AI on exact file matches.
- [ ] HINT rules remain advisory prompt context.
- [ ] LAUNCH rules still gate valid AI results.
- [ ] Admin API rejects semantically ineffective DetectorRule payloads.
- [ ] Internal logs identify rule context and AI failure phase.
- [ ] Public API errors remain sanitized.
- [ ] Focused tests, typecheck, lint, full logic tests, and MCP browser smoke provide evidence.
