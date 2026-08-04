# GitOpsRepositoryService

> 48 nodes · cohesion 0.08

## Key Concepts

- **GitOpsRepositoryService** (17 connections) — `modules/gitops/gitops.service.ts`
- **ManifestBuilder** (17 connections) — `modules/gitops/stack-sync.service.ts`
- **stack-sync.service.ts** (11 connections) — `modules/gitops/stack-sync.service.ts`
- **.syncStack()** (11 connections) — `modules/gitops/stack-sync.service.ts`
- **.buildContainerDeployment()** (9 connections) — `modules/gitops/stack-sync.service.ts`
- **.commitFiles()** (8 connections) — `modules/gitops/gitops.service.ts`
- **.baseLabels()** (8 connections) — `modules/gitops/stack-sync.service.ts`
- **StackSyncService** (7 connections) — `modules/gitops/stack-sync.service.ts`
- **.updateManifests()** (7 connections) — `modules/gitops/stack-sync.service.ts`
- **gitops.service.ts** (6 connections) — `modules/gitops/gitops.service.ts`
- **.githubFetch()** (6 connections) — `modules/gitops/gitops.service.ts`
- **.buildConfigMaps()** (4 connections) — `modules/gitops/stack-sync.service.ts`
- **.buildIngresses()** (4 connections) — `modules/gitops/stack-sync.service.ts`
- **.buildPVCs()** (4 connections) — `modules/gitops/stack-sync.service.ts`
- **.buildSecrets()** (4 connections) — `modules/gitops/stack-sync.service.ts`
- **.createBlob()** (3 connections) — `modules/gitops/gitops.service.ts`
- **.createCommit()** (3 connections) — `modules/gitops/gitops.service.ts`
- **.createInstallationToken()** (3 connections) — `modules/gitops/gitops.service.ts`
- **.createTree()** (3 connections) — `modules/gitops/gitops.service.ts`
- **.getAccessToken()** (3 connections) — `modules/gitops/gitops.service.ts`
- **.getRef()** (3 connections) — `modules/gitops/gitops.service.ts`
- **.updateRef()** (3 connections) — `modules/gitops/gitops.service.ts`
- **gitops.service.test.ts** (3 connections) — `modules/gitops/gitops.service.test.ts`
- **HelmChartRenderer** (3 connections) — `modules/gitops/helm-template.ts`
- **.buildContainerService()** (3 connections) — `modules/gitops/stack-sync.service.ts`
- *... and 23 more nodes in this community*

## Relationships

- [prisma.ts](prisma.ts.md) (5 shared connections)

## Source Files

- `modules/gitops/gitops.service.test.ts`
- `modules/gitops/gitops.service.ts`
- `modules/gitops/helm-template.ts`
- `modules/gitops/stack-sync.service.ts`

## Audit Trail

- EXTRACTED: 189 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*