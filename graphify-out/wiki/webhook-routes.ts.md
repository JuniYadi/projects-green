# webhook-routes.ts

> 68 nodes · cohesion 0.05

## Key Concepts

- **webhook-routes.ts** (17 connections) — `lib/whatsapp/webhook-routes.ts`
- **whatsapp-webhook.ts** (15 connections) — `lib/queue/whatsapp-webhook.ts`
- **idempotency-repository.ts** (13 connections) — `lib/whatsapp/idempotency-repository.ts`
- **handle-event.ts** (12 connections) — `lib/whatsapp/handle-event.ts`
- **WebhookMetricsCollector** (9 connections) — `modules/health/webhook-metrics.service.ts`
- **webhook-dispatch.test.ts** (8 connections) — `lib/whatsapp/__tests__/webhook-dispatch.test.ts`
- **whatsapp-webhook.test.ts** (6 connections) — `lib/queue/whatsapp-webhook.test.ts`
- **handleEventUseCase()** (6 connections) — `lib/whatsapp/handle-event.ts`
- **getAvailableRedisClient()** (6 connections) — `lib/whatsapp/idempotency-repository.ts`
- **hasProcessedEvent()** (6 connections) — `lib/whatsapp/idempotency-repository.ts`
- **markEventProcessed()** (6 connections) — `lib/whatsapp/idempotency-repository.ts`
- **warnAndUseFallback()** (6 connections) — `lib/whatsapp/idempotency-repository.ts`
- **getWhatsAppWebhookRedisConnection()** (5 connections) — `lib/queue/whatsapp-webhook.ts`
- **WhatsAppWebhookJobData** (5 connections) — `lib/queue/whatsapp-webhook.ts`
- **verify-webhook.ts** (5 connections) — `lib/whatsapp/verify-webhook.ts`
- **dispatchWebhookEvents()** (5 connections) — `lib/whatsapp/webhook-routes.ts`
- **enqueueWhatsAppWebhook()** (4 connections) — `lib/queue/whatsapp-webhook.ts`
- **QueueMock** (4 connections) — `lib/queue/whatsapp-webhook.test.ts`
- **getRedisClient()** (4 connections) — `lib/whatsapp/idempotency-repository.ts`
- **resetIdempotencyStore()** (4 connections) — `lib/whatsapp/idempotency-repository.ts`
- **webhook-metrics.service.ts** (4 connections) — `modules/health/webhook-metrics.service.ts`
- **createWebhookEvent()** (4 connections) — `modules/whatsapp/webhooks/webhooks.service.ts`
- **getSharedQueue()** (3 connections) — `lib/queue/whatsapp-webhook.ts`
- **.add()** (3 connections) — `lib/queue/whatsapp-webhook.test.ts`
- **contracts.ts** (3 connections) — `lib/whatsapp/contracts.ts`
- *... and 43 more nodes in this community*

## Relationships

- [webhooks.service.ts](webhooks.service.ts.md) (6 shared connections)
- [api.ts](api.ts.md) (4 shared connections)
- [whatsapp-broadcast-worker.ts](whatsapp-broadcast-worker.ts.md) (3 shared connections)
- [prisma.ts](prisma.ts.md) (1 shared connections)

## Source Files

- `lib/queue/whatsapp-webhook.test.ts`
- `lib/queue/whatsapp-webhook.ts`
- `lib/whatsapp/__tests__/webhook-dispatch.test.ts`
- `lib/whatsapp/contracts.ts`
- `lib/whatsapp/debug-repository.ts`
- `lib/whatsapp/handle-event.ts`
- `lib/whatsapp/idempotency-repository.ts`
- `lib/whatsapp/verify-webhook.ts`
- `lib/whatsapp/webhook-routes.ts`
- `lib/whatsapp/webhook.ts`
- `modules/health/webhook-metrics.service.ts`
- `modules/whatsapp/webhooks/webhooks.service.ts`

## Audit Trail

- EXTRACTED: 226 (99%)
- INFERRED: 2 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*