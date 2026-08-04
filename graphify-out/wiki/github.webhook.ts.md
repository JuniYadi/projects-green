# github.webhook.ts

> 84 nodes · cohesion 0.04

## Key Concepts

- **github.webhook.ts** (42 connections) — `modules/github/github.webhook.ts`
- **webhook/route.ts** (15 connections) — `app/api/integrations/github/webhook/route.ts`
- **github.webhook.test.ts** (14 connections) — `modules/github/github.webhook.test.ts`
- **github-events.ts** (12 connections) — `lib/queue/github-events.ts`
- **enqueueGithubWebhookEvent()** (11 connections) — `modules/github/github.webhook.ts`
- **webhook/route.test.ts** (10 connections) — `app/api/integrations/github/webhook/route.test.ts`
- **createGithubWebhookHandler()** (10 connections) — `modules/github/github.webhook.ts`
- **processGithubWebhookEvent()** (9 connections) — `modules/github/github.webhook.ts`
- **github-event.job.ts** (8 connections) — `modules/github/jobs/github-event.job.ts`
- **github-worker.ts** (8 connections) — `scripts/github-worker.ts`
- **github-event-classifier.ts** (7 connections) — `modules/github/github-event-classifier.ts`
- **GithubEventJob** (6 connections) — `modules/github/jobs/github-event.job.ts`
- **getGithubEventsRedisConnection()** (5 connections) — `lib/queue/github-events.ts`
- **github-event-classifier.test.ts** (5 connections) — `modules/github/github-event-classifier.test.ts`
- **evaluatePushRules()** (5 connections) — `modules/github/github.webhook.ts`
- **signGithubWebhookBody()** (5 connections) — `modules/github/github.webhook.ts`
- **verifyGithubWebhookSignature()** (5 connections) — `modules/github/github.webhook.ts`
- **createGithubEventsQueue()** (4 connections) — `lib/queue/github-events.ts`
- **classifyGithubWebhookEvent()** (4 connections) — `modules/github/github-event-classifier.ts`
- **toErrorMessage()** (4 connections) — `modules/github/github.webhook.ts`
- **getSharedQueue()** (3 connections) — `lib/queue/github-events.ts`
- **extractBranchFromRef()** (3 connections) — `modules/github/github.webhook.ts`
- **getSharedQueue()** (3 connections) — `modules/github/github.webhook.ts`
- **hashPayload()** (3 connections) — `modules/github/github.webhook.ts`
- **isUniqueConstraintError()** (3 connections) — `modules/github/github.webhook.ts`
- *... and 59 more nodes in this community*

## Relationships

- [github.service.ts](github.service.ts.md) (6 shared connections)
- [workers.ts](workers.ts.md) (5 shared connections)
- [prisma.ts](prisma.ts.md) (4 shared connections)
- [github-event-normalizer.ts](github-event-normalizer.ts.md) (2 shared connections)

## Source Files

- `app/api/integrations/github/webhook/route.test.ts`
- `app/api/integrations/github/webhook/route.ts`
- `lib/queue/github-events.ts`
- `modules/github/github-event-classifier.test.ts`
- `modules/github/github-event-classifier.ts`
- `modules/github/github.webhook.test.ts`
- `modules/github/github.webhook.ts`
- `modules/github/jobs/github-event.job.ts`
- `scripts/github-worker.ts`

## Audit Trail

- EXTRACTED: 282 (100%)
- INFERRED: 1 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*