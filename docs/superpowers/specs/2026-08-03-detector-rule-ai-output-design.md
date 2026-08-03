# Detector Rule and AI Output Reliability Design

**Date:** 2026-08-03

## Problem

`POST /api/framework-detection/github` returns `422 DETECTION_FAILED` for the Laravel repository because the AI response fails `AI_DECISION_SCHEMA`:

- `confidence` is greater than `1`.
- `requiredRuntimeIds` contains an invalid value.
- `reasoning` is a string instead of a non-empty string array.

The request payload is valid. The route reaches the detection service, loads active `DetectorRule` rows, and then fails while validating AI output.

## DetectorRule behavior today

`DetectorRule` is a policy layer, not an AI-output repair layer.

1. GitHub file listing runs.
2. Active rules load from Prisma.
3. `BLOCK` rules match exact file paths before AI. A match returns a blocked result and skips AI.
4. If no block matches, all active rules become text hints in the AI prompt.
5. AI tool calling runs and its decision must satisfy `AI_DECISION_SCHEMA`.
6. Only after valid AI output do runtime mappings and `LAUNCH` rules run.
7. `HINT` rules never deterministically select a framework.
8. `confidenceWeight` is stored but is not used in the GitHub detection decision path.
9. `patternJson.dependencies` is included in prompt hints but is not used by deterministic BLOCK matching.

A database row therefore does not prove that the row is active, semantically valid, matched by the repository, or capable of preventing an AI schema failure.

## Goals

- Prevent valid repository detection from failing because raw model text is parsed unreliably.
- Preserve existing `BLOCK`, `HINT`, and `LAUNCH` policy boundaries.
- Make rule loading, matching, and AI schema failures observable in inspection logs.
- Validate DetectorRule semantics at the admin API boundary instead of accepting arbitrary JSON shapes.
- Keep failure safe: invalid model output must not become an unverified successful deployment.

## Non-goals

- Do not make DetectorRule override repository evidence by default.
- Do not create a second rules-first framework detector.
- Do not silently coerce malformed model values such as `95` into `0.95`.
- Do not make dependency-pattern matching part of this fix without a deterministic dependency inventory.
- Do not change deployment authorization, billing, or GitHub installation-token behavior.

## Design

### 1. Use structured AI output with tool calling

Update `resolveWithAiToolCalling` to use the installed AI SDK 6 structured-output API:

```ts
const result = await generateText({
  model: provider(modelName),
  tools: toolDefinitions,
  output: Output.object({ schema: AI_DECISION_SCHEMA }),
  stopWhen: stepCountIs(16),
  system: systemPrompt,
  prompt: userPrompt,
})
```

Use `result.output` as the typed decision. Remove regex JSON extraction and manual `JSON.parse` from this path. Keep the schema as the server-side contract.

The extra step allowance covers tool execution plus the final structured-output step. If the provider still cannot produce the schema, preserve the existing safe error path and log the structured-output error.

### 2. Preserve DetectorRule policy order

Keep this order in `detectFrameworkFromGithubApi`:

- load active rules;
- exact deterministic BLOCK check;
- return blocked result before AI when a BLOCK rule matches;
- pass active rules as prompt hints when no BLOCK rule matches;
- validate structured AI output;
- apply runtime mappings;
- evaluate LAUNCH policy and confidence.

Do not use HINT or LAUNCH rules to bypass AI schema validation.

### 3. Validate rule semantics at the admin boundary

Replace generic `z.record(z.string(), z.unknown())` validation with schemas for the supported rule contract:

```ts
patternJson: z.object({
  files: z.array(z.string().trim().min(1)).optional(),
  dependencies: z.array(z.string().trim().min(1)).optional(),
  frameworkId: z.string().trim().min(1).optional(),
}),
implicationsJson: z.object({
  framework: z.string().trim().min(1).optional(),
  runtime: z.string().trim().min(1).optional(),
  impact: z.enum(["BLOCK", "HINT", "LAUNCH"]),
  minConfidence: z.number().min(0).max(1).optional(),
}),
```

Require at least one pattern field and reject unsupported combinations at the API boundary. Keep `dependencies` as prompt metadata for this change; deterministic BLOCK matching remains file-based until dependency inventory exists.

### 4. Add rule and failure observability

Extend the inspection failure record or its metadata so operators can distinguish:

- active rule count;
- matched BLOCK rule ID/name and matched files;
- rule impacts loaded into the prompt;
- AI schema failure details safe for internal logs;
- request identity: installation, repository, ref, and subdirectory.

Keep verbose model/schema details out of the public API response. The public response remains actionable and generic.

### 5. Keep UI retry behavior unchanged initially

The UI may continue retrying three times. After the structured-output fix, repeated retries should no longer fail for the observed schema-shape errors. Do not add fallback deployment configuration or silent model-value coercion in this scope.

## Verification strategy

- Unit tests for `resolveWithAiToolCalling` or its structured-output adapter prove the schema is passed to the AI SDK and typed output reaches the service.
- Service tests prove active HINT rules do not block, matching BLOCK rules skip AI, and valid output reaches LAUNCH evaluation.
- Service regression test proves malformed AI output records an error and never returns a successful detection.
- Admin route tests prove malformed rule pattern/implication shapes return 400.
- Route test proves AI schema failure remains `422 DETECTION_FAILED` with sanitized public message.
- Focused Bun tests run through the repository test runner with preload.
- `bun run typecheck` verifies AI SDK 6 API types.
- Browser smoke retries the same authenticated Laravel repository and confirms the Detect step reaches a valid result or a deliberate policy result instead of repeating the same schema 422.

## Acceptance criteria

- The Laravel detection request no longer fails because the model emits unstructured JSON with the three observed shape errors.
- A matching active BLOCK rule still returns blocked without an AI call.
- HINT rules remain advisory and visible to the AI prompt.
- LAUNCH rules still gate supported framework and minimum confidence after valid AI output.
- Invalid DetectorRule JSON semantics cannot be saved through the admin API.
- Public errors remain sanitized; internal inspection evidence identifies whether failure occurred in rule matching, AI output generation, or policy evaluation.
