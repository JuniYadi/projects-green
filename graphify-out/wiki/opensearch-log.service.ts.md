# opensearch-log.service.ts

> 40 nodes · cohesion 0.11

## Key Concepts

- **opensearch-log.service.ts** (19 connections) — `modules/deploy/opensearch/opensearch-log.service.ts`
- **deploy/opensearch/index.ts** (13 connections) — `modules/deploy/opensearch/index.ts`
- **getOpenSearchClient()** (12 connections) — `lib/opensearch.ts`
- **opensearch-logs.route.ts** (11 connections) — `modules/deploy/api/routes/opensearch-logs.route.ts`
- **opensearch-ingest-worker.ts** (11 connections) — `scripts/opensearch-ingest-worker.ts`
- **opensearch-ingest.ts** (10 connections) — `lib/queue/opensearch-ingest.ts`
- **opensearch.ts** (8 connections) — `lib/opensearch.ts`
- **opensearch-index.service.ts** (8 connections) — `modules/deploy/opensearch/opensearch-index.service.ts`
- **ensureLogIndex()** (8 connections) — `modules/deploy/opensearch/opensearch-index.service.ts`
- **deploy/opensearch/opensearch.types.ts** (8 connections) — `modules/deploy/opensearch/opensearch.types.ts`
- **getLogIndexName()** (7 connections) — `modules/deploy/opensearch/opensearch-index.service.ts`
- **getDeployAggregation()** (6 connections) — `modules/deploy/opensearch/opensearch-log.service.ts`
- **ingestLog()** (6 connections) — `modules/deploy/opensearch/opensearch-log.service.ts`
- **LogEntry** (6 connections) — `modules/deploy/opensearch/opensearch.types.ts`
- **rotateIndices()** (5 connections) — `modules/deploy/opensearch/opensearch-index.service.ts`
- **logError()** (5 connections) — `modules/deploy/opensearch/opensearch-log.service.ts`
- **queryLogs()** (5 connections) — `modules/deploy/opensearch/opensearch-log.service.ts`
- **ingestLogBatch()** (4 connections) — `modules/deploy/opensearch/opensearch-log.service.ts`
- **createOpenSearchClient()** (3 connections) — `lib/opensearch.ts`
- **opensearch.test.ts** (3 connections) — `lib/opensearch.test.ts`
- **DeployAggregation** (3 connections) — `modules/deploy/opensearch/opensearch.types.ts`
- **LogLevel** (3 connections) — `modules/deploy/opensearch/opensearch.types.ts`
- **LogQueryParams** (3 connections) — `modules/deploy/opensearch/opensearch.types.ts`
- **LogQueryResult** (3 connections) — `modules/deploy/opensearch/opensearch.types.ts`
- **getRegionConfig()** (2 connections) — `lib/opensearch.ts`
- *... and 15 more nodes in this community*

## Relationships

- [workers.ts](workers.ts.md) (9 shared connections)
- [getPlatformRoleForUser](getPlatformRoleForUser.md) (2 shared connections)
- [prisma.ts](prisma.ts.md) (2 shared connections)

## Source Files

- `lib/opensearch.test.ts`
- `lib/opensearch.ts`
- `lib/queue/opensearch-ingest.ts`
- `modules/deploy/api/routes/opensearch-logs.route.ts`
- `modules/deploy/opensearch/index.ts`
- `modules/deploy/opensearch/opensearch-index.service.ts`
- `modules/deploy/opensearch/opensearch-log.service.ts`
- `modules/deploy/opensearch/opensearch.types.ts`
- `scripts/opensearch-ingest-worker.ts`

## Audit Trail

- EXTRACTED: 187 (99%)
- INFERRED: 2 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*