# PGREEN-065 — AI Detector Toolchain: Detailed Implementation Plan

## Overview

Replace mock framework detection in the Deploy Wizard with real API calls to the `framework-detection` backend module. Add governance (DetectorRule) and runtime resolution (RuntimeMapping) as supporting capabilities.

---

## 065-prisma — Verify Prisma Schema

**Status:** Validated ✓ (no changes needed)

| Model | Table | Key Fields | Notes |
|---|---|---|---|
| `DetectorRule` | `DetectorRule` | `patternJson`, `implicationsJson`, `confidenceWeight`, `isActive`, `priority` | Rule-based deterministic matching |
| `RuntimeMapping` | `RuntimeMapping` | `frameworkId`, `frameworkVersion`, `runtimeId`, `runtimeVersion`, `buildVersion`, `isActive`, `priority` | Maps framework→runtime |
| `InspectionLog` | `InspectionLog` | `repoUrl`, `detectedFramework`, `confidence`, `reasoning[]`, `durationMs`, `status`, `blockedByRuleId` | Audit trail per detection run |

All three exist and are complete. No migration needed.

---

## 065-service — Framework Detection Service

**Status:** Already exists at `modules/framework-detection/framework-detection.service.ts`

Exposes:
- `detectFrameworkFromGitRepo(input)` — Git clone + scan (legacy)
- `detectFrameworkFromGithubApi(input)` — GitHub API via Octokit (AI-first, preferred)

**Key characteristics (audited):**
- Uses `@ai-sdk/openai` with zod tool calling for AI fallback
- Two-phase: deterministic pattern scan → AI fallback on low confidence
- Falls back to deterministic if AI unavailable
- Writes `InspectionLog` on each run
- Enforces `DetectorRule` governance before returning result
- Resolves `RuntimeMapping` into `enforcedRuntimes` on the result

**No new code needed** — the service is production-ready (~1200+ lines of test code).

---

## 065-governance — DetectorRule Governance

**Status:** Already exists at `modules/framework-detection/detector-admin.service.ts`

The governance layer is invoked inside `framework-detection.service.ts`:
1. On detection complete, checks all active `DetectorRule` records
2. A matching rule can: block deployment, adjust confidence, force a framework
3. The decision is recorded in `InspectionLog.blockedByRuleId`

**No new code needed.**

---

## 065-runtime — RuntimeMapping Resolution

**Status:** Already exists inside `framework-detection.service.ts`

After detection, the service resolves the best `RuntimeMapping`:
1. Finds active mappings for the detected framework
2. Picks the highest-priority match
3. Returns `enforcedRuntimes: [{ runtimeId, version }]` on the DTO

**No new code needed.**

---

## 065-api — API Routes

**Status:** Already exists at `modules/framework-detection/api/framework-detection.route.ts`

| Endpoint | Method | Input | Purpose |
|---|---|---|---|
| `/framework-detection` | POST | `{ repoUrl, ref?, subdir? }` | Git clone mode (legacy) |
| `/framework-detection/github` | POST | `{ installationId, owner, repo, ref?, subdir? }` | GitHub API mode (preferred) |

Admin routes at `detector-admin.route.ts`:
- CRUD for `DetectorRule`
- CRUD for `RuntimeMapping`
- Inspection log viewer

**No new code needed.**

---

## 065-wire — Wire Detection API to Deploy Wizard ★

**This is the core implementation task.**

### Current State

```
deploy-wizard.tsx
  └─ imports from deploy.mock.ts:
       ├─ getDetectionForRepository(repoId)       → synchronous, mock data
       ├─ buildInitialBuildState(repoId)           → synchronous, mock data
       ├─ getDefaultBranchName(repoId)             → synchronous, mock data
       └─ getRepositoryBranches(repoId)            → synchronous, mock data

  └─ handleRepositorySelect(repositoryId):
       ├─ dispatch set-source (sync)
       ├─ const detection = getDetectionForRepository(repoId)  ← MOCK
       ├─ dispatch set-detection
       └─ dispatch set-build via buildInitialBuildState         ← MOCK
```

### Target State

```
deploy-wizard.tsx
  └─ new: deploy-detection.service.ts (or inline hook)
       └─ fetchFrameworkDetection(installationId, owner, repo, ref?)
            → POST /api/framework-detection/github
            → map DTO → wizard DetectionResult

  └─ handleRepositorySelect(repositoryId):
       ├─ dispatch set-source (sync)
       ├─ dispatch set-detection null
       ├─ setDetecting(true)
       ├─ const result = await fetchFrameworkDetection(...)
       ├─ dispatch set-detection (from API response)
       ├─ dispatch set-build (derive from API)
       └─ setDetecting(false) on error
```

### Sub-tasks

#### 5a — Extend types to carry `installationId`

**File: `modules/deploy/deploy.types.ts`**
- Add `installationId: number` to `Repository` type

**File: `modules/deploy/ui/deploy-wizard.tsx`**
- Add `installationId: number` to `GithubRepositoryApiItem` type
- Update `mapGithubRepository()` to map `installationId`

This makes `installationId` available in `repositoryById` lookups.

#### 5b — Create detection API client

**File: `modules/deploy/deploy-detection.service.ts`** _(new file)_

```
fetchFrameworkDetection(input):
  POST /api/framework-detection/github
  Body: { installationId, owner, repo, ref? }
  Response:
    ok: true → mapDetectionDTO(wizardResult)
    ok: false → throw DetectionError

mapDetectionDTO(apiResult) → DetectionResult:
  language:        mapEcosystem(primaryFramework?.ecosystem)
  framework:       primaryFramework?.name ?? null
  dockerfileDetected:  evidence has "file" with value containing "Dockerfile"
  buildCommand:    deriveBuildCommand(primaryFramework?.name, requiredDependencies)
  confidence:      apiResult.confidence
  status:          mapStatus(decision.status, confidence)
```

Mapping rules:
- `ecosystem "node"` → `"Node.js"`, `"php"` → `"PHP"`, `"python"` → `"Python"`, etc.
- `decision.status`: `"success"` → `"success"`, `"low_confidence"` → `"low_confidence"`, `"blocked"|"unsupported"` → `"failed"`
- If `primaryFramework` is null → status `"failed"`, language/framework null
- `buildCommand` derivation: well-known frameworks get defaults (Next.js → `"npm run build"`, Express → `"npm run build"`, etc.), otherwise null

#### 5c — Update `handleRepositorySelect`

**File: `modules/deploy/ui/deploy-wizard.tsx`**

Replace:
```typescript
const detectionResult = getDetectionForRepository(repositoryId)
dispatch({ type: "set-detection", payload: detectionResult })
dispatch({ type: "set-build", payload: buildInitialBuildState(repositoryId) })
```

With:
```typescript
// Clear previous detection
dispatch({ type: "set-detection", payload: null })
setDetectionError(null)

const repo = repositoryById[repositoryId]
if (!repo?.installationId) return  // no detection possible

setIsDetecting(true)
try {
  const result = await fetchFrameworkDetection({
    installationId: repo.installationId,
    owner: repo.ownerId,
    repo: repo.name,
    ref: branchName || undefined,
  })
  dispatch({ type: "set-detection", payload: result })
  dispatch({
    type: "set-build",
    payload: {
      ...DEFAULT_BUILD_STATE,
      language: result.language ?? "",
      framework: result.framework ?? "",
      buildCommand: result.buildCommand ?? "",
    },
  })
} catch (err) {
  setDetectionError(getErrorMessage(err))
  // detectionResult stays null — user will enter build values manually
} finally {
  setIsDetecting(false)
}
```

#### 5d — Add loading/error UI states

**File: `modules/deploy/ui/deploy-wizard.tsx`**
- Add state: `isDetecting: boolean`, `detectionError: string | null`
- Pass to `StepSource` / `StepBuild` as props

**File: `modules/deploy/ui/step-source.tsx`**
- Show loading spinner or skeleton when `isDetecting` is true after repo selection
- Show error banner when `detectionError` is set

**File: `modules/deploy/ui/step-build.tsx`**
- If `isDetecting`: show skeleton for detection results area
- If `detectionError`: show error banner with retry option

#### 5e — Handle fallback for `getDefaultBranchName` / `getRepositoryBranches`

Currently `getDefaultBranchName` is used as fallback when `repositoryById[repoId]?.defaultBranch` is empty. The mock `getDefaultBranchName` reads from `MOCK_BRANCHES`.

**Decision:** Keep mock for `getDefaultBranchName` and `getRepositoryBranches` for now — the real GitHub API already returns `defaultBranch`, so the mock fallback only triggers for repos without that field. Replace later in a separate task if branch listing becomes a feature.

#### 5f — Keep template flow unchanged

**File: `modules/deploy/ui/deploy-wizard.tsx`**
- `handleTemplateSelect` sets hardcoded detection data based on template
- No changes needed — templates have pre-baked build configs

---

### Edge Cases & Error Handling

| Scenario | Behavior |
|---|---|
| Repo has no `installationId` | DetectionResult stays null, user fills build manually |
| API returns `ok: false` | Dispatch null detection, show error message |
| Network failure | Catch → null detection → error text, user proceeds manually |
| `primaryFramework` null | status = "failed", language/framework = null |
| Detection in progress + user switches repo | Abort previous request (AbortController), cancel stale dispatch |
| Detecting + template switch | Cancel detection, template has own data |
| Session restore (sessionStorage) | Previously stored detection result is restored as-is (was already saved) |

### Files Modified

| File | Change |
|---|---|
| `modules/deploy/deploy.types.ts` | Add `installationId` to `Repository` |
| `modules/deploy/deploy-detection.service.ts` | **New** — API client + DTO mapper |
| `modules/deploy/ui/deploy-wizard.tsx` | Refactor `handleRepositorySelect`, add loading/error state |
| `modules/deploy/ui/step-source.tsx` | Optional: show detection loading/error |
| `modules/deploy/ui/step-build.tsx` | Optional: show detection loading skeleton |
| `modules/deploy/deploy.mock.ts` | Remove `MOCK_DETECTION_BY_REPOSITORY_ID` (only if all tests still pass without it) |

---

## 065-tests — Unit Tests

### Existing test coverage (already passing):

| File | Coverage |
|---|---|
| `framework-detection.service.test.ts` | AI fallback, deterministic scan, edge cases |
| `detector-admin.route.test.ts` | Admin CRUD, auth guards, validation |
| `framework-detection.route.test.ts` | (check if exists) |
| `github.service.test.ts` | Repo listing with installationId |

### New tests needed:

#### Testing for `deploy-detection.service.ts`

**File: `modules/deploy/__tests__/deploy-detection.service.test.ts`**

1. **`fetchFrameworkDetection` — happy path**
   - Mock `fetch` returning full DTO
   - Verify mapped `DetectionResult` has correct `language`, `framework`, `confidence`, `status`

2. **`fetchFrameworkDetection` — API returns error**
   - Mock `fetch` returning `{ ok: false, error: "DETECTION_FAILED" }`
   - Verify throws `DetectionError`

3. **`fetchFrameworkDetection` — primaryFramework null**
   - Mock response with null primaryFramework
   - Verify mapped result has language=null, framework=null, status="failed"

4. **`fetchFrameworkDetection` — low confidence**
   - Mock response with decision.status="low_confidence"
   - Verify mapped result has status="low_confidence"

5. **`fetchFrameworkDetection` — network failure**
   - Mock `fetch` throwing `TypeError: Failed to fetch`
   - Verify throws `DetectionError` with sensible message

6. **`mapDetectionDTO` — Dockerfile detected**
   - Evidence includes `{ type: "file", value: "Dockerfile" }`
   - Verify `dockerfileDetected: true`

7. **`mapDetectionDTO` — buildCommand derivation**
   - Framework "Next.js" → `"npm run build"`
   - Framework "Express" → `"npm run build"`
   - Framework "Django" → `"pip install -r requirements.txt && python manage.py collectstatic"`
   - Unknown framework → null

8. **Ecosystem mapping**
   - `"node"` → `"Node.js"`, `"php"` → `"PHP"`, `"python"` → `"Python"`, `"unknown"` → null

#### Testing for deploy-wizard refactor

**File: `modules/deploy/ui/deploy-wizard.test.tsx`** (existing, needs updates)

9. **Repository select triggers detection**
   - Mock `fetchFrameworkDetection`
   - Select a repo with `installationId`
   - Verify dispatch `set-detection` is called with mapped result

10. **Repository select without installationId**
    - Select a repo missing installationId
    - Verify no fetch call, detection stays null

11. **Detection failure**
    - Mock fetch throwing
    - Select repo
    - Verify detection stays null, error state is set

12. **Loading state during detection**
    - Mock fetch with delay
    - Select repo
    - Verify `isDetecting` is true during fetch, false after

### Test files impacted:

| File | Action |
|---|---|
| `modules/deploy/ui/deploy-wizard.test.tsx` | Update mock imports, add test cases 9-12 |
| `modules/deploy/__tests__/deploy-detection.service.test.ts` | **New** — 8 test cases |
| `modules/deploy/deploy.mock.ts` | Remove mock detection data only after tests pass |

---

## Implementation Order

1. **`deploy.types.ts`** — Add `installationId` to `Repository`
2. **`deploy-detection.service.ts`** — API client + mapper
3. **`deploy-wizard.tsx`** — Refactor `handleRepositorySelect`, add states
4. **Test files** — New + updated tests
5. **`deploy.mock.ts`** — Cleanup mock detection (if safe)
6. **`step-source.tsx` / `step-build.tsx`** — Loading/error UI polish

---

## Risk Assessment

| Risk | Mitigation |
|---|---|
| AI detection API slow (>10s) | Loading skeleton + AbortController. User can navigate away |
| `installationId` missing on some repos | Detection stays null, user fills build manually (existing fallback) |
| DTO shape changes | Mapping function isolates changes; tests validate |
| SessionStorage has old-format DetectionResult | Backward compatible — same `DetectionResult` type, only source changes |
| No branch listing API yet | Keep mock `getRepositoryBranches`/`getDefaultBranchName` for now |
