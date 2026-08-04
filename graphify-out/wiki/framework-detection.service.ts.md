# framework-detection.service.ts

> 61 nodes · cohesion 0.06

## Key Concepts

- **framework-detection.service.ts** (73 connections) — `modules/framework-detection/framework-detection.service.ts`
- **detectFrameworkFromGithubApi()** (21 connections) — `modules/framework-detection/framework-detection.service.ts`
- **framework-detection.service.test.ts** (13 connections) — `modules/framework-detection/framework-detection.service.test.ts`
- **fromInventory()** (8 connections) — `modules/framework-detection/framework-detection.service.ts`
- **detectFrameworkFromGitRepo()** (7 connections) — `modules/framework-detection/framework-detection.service.ts`
- **safeProviderDiagnostics()** (6 connections) — `modules/framework-detection/framework-detection.service.ts`
- **buildRequiredDependencies()** (5 connections) — `modules/framework-detection/framework-detection.service.ts`
- **buildInventory()** (4 connections) — `modules/framework-detection/framework-detection.service.ts`
- **resolveWithAiToolCalling()** (4 connections) — `modules/framework-detection/framework-detection.service.ts`
- **toDetectedFramework()** (4 connections) — `modules/framework-detection/framework-detection.service.ts`
- **buildAiDetectionSystemPrompt()** (3 connections) — `modules/framework-detection/framework-detection.service.ts`
- **classifyProviderFailure()** (3 connections) — `modules/framework-detection/framework-detection.service.ts`
- **cloneRepository()** (3 connections) — `modules/framework-detection/framework-detection.service.ts`
- **enforceRuntimeMappings()** (3 connections) — `modules/framework-detection/framework-detection.service.ts`
- **evaluateDeterministicCandidates()** (3 connections) — `modules/framework-detection/framework-detection.service.ts`
- **FrameworkDetectionError** (3 connections) — `modules/framework-detection/framework-detection.service.ts`
- **GithubApiDetectorDependencies** (3 connections) — `modules/framework-detection/framework-detection.service.ts`
- **inferFrameworkName()** (3 connections) — `modules/framework-detection/framework-detection.service.ts`
- **listFilesRecursively()** (3 connections) — `modules/framework-detection/framework-detection.service.ts`
- **normalizeConfidence()** (3 connections) — `modules/framework-detection/framework-detection.service.ts`
- **readProviderStatus()** (3 connections) — `modules/framework-detection/framework-detection.service.ts`
- **runGit()** (3 connections) — `modules/framework-detection/framework-detection.service.ts`
- **runWithMockClone()** (3 connections) — `modules/framework-detection/framework-detection.service.test.ts`
- **DetectionErrorCode** (3 connections) — `modules/framework-detection/framework-detection.types.ts`
- **FrameworkDetectionInput** (3 connections) — `modules/framework-detection/framework-detection.types.ts`
- *... and 36 more nodes in this community*

## Relationships

- [framework-detection.dto.ts](framework-detection.dto.ts.md) (14 shared connections)
- [github.service.ts](github.service.ts.md) (6 shared connections)
- [docs-embedding.service.ts](docs-embedding.service.ts.md) (5 shared connections)
- [prisma.ts](prisma.ts.md) (2 shared connections)

## Source Files

- `modules/framework-detection/framework-detection.service.test.ts`
- `modules/framework-detection/framework-detection.service.ts`
- `modules/framework-detection/framework-detection.types.ts`
- `modules/github/github.service.ts`

## Audit Trail

- EXTRACTED: 227 (90%)
- INFERRED: 24 (10%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*