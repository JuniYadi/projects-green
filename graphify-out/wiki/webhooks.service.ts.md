# webhooks.service.ts

> 53 nodes · cohesion 0.06

## Key Concepts

- **webhooks.service.ts** (30 connections) — `modules/whatsapp/webhooks/webhooks.service.ts`
- **webhooks.route.ts** (18 connections) — `modules/whatsapp/webhooks/api/webhooks.route.ts`
- **whatsapp-webhook-worker.ts** (16 connections) — `scripts/whatsapp-webhook-worker.ts`
- **webhook-retry.job.ts** (12 connections) — `modules/whatsapp/webhooks/jobs/webhook-retry.job.ts`
- **webhook-dead-letter.service.ts** (12 connections) — `modules/whatsapp/webhooks/services/webhook-dead-letter.service.ts`
- **processInboundMessage()** (11 connections) — `modules/whatsapp/webhooks/webhooks.service.ts`
- **contacts.service.ts** (9 connections) — `modules/whatsapp/contacts/contacts.service.ts`
- **webhook-dead-letter.route.ts** (9 connections) — `modules/whatsapp/webhooks/api/webhook-dead-letter.route.ts`
- **upsertWhatsappContactFromMessage()** (8 connections) — `modules/whatsapp/contacts/contacts.service.ts`
- **WebhookRetryJob** (7 connections) — `modules/whatsapp/webhooks/jobs/webhook-retry.job.ts`
- **processDeliveryStatus()** (7 connections) — `modules/whatsapp/webhooks/webhooks.service.ts`
- **webhooks.dto.ts** (5 connections) — `modules/whatsapp/webhooks/webhooks.dto.ts`
- **handleIncomingWebhook()** (5 connections) — `modules/whatsapp/webhooks/webhooks.service.ts`
- **.handle()** (4 connections) — `modules/whatsapp/webhooks/jobs/webhook-retry.job.ts`
- **createDeadLetter()** (4 connections) — `modules/whatsapp/webhooks/services/webhook-dead-letter.service.ts`
- **resolveWhatsappContactGroupId()** (3 connections) — `modules/whatsapp/contacts/contacts.service.ts`
- **replayDeadLetter()** (3 connections) — `modules/whatsapp/webhooks/services/webhook-dead-letter.service.ts`
- **toWebhookEventDTO()** (3 connections) — `modules/whatsapp/webhooks/webhooks.dto.ts`
- **listWebhookEvents()** (3 connections) — `modules/whatsapp/webhooks/webhooks.service.ts`
- **getDeviceOrganization()** (3 connections) — `scripts/whatsapp-webhook-worker.ts`
- **handleMessageEvent()** (3 connections) — `scripts/whatsapp-webhook-worker.ts`
- **handleStatusEvent()** (3 connections) — `scripts/whatsapp-webhook-worker.ts`
- **webhookDeadLetterRoutes** (2 connections) — `modules/whatsapp/webhooks/api/webhook-dead-letter.route.ts`
- **.dispatch()** (2 connections) — `modules/whatsapp/webhooks/jobs/webhook-retry.job.ts`
- **getDeadLetterById()** (2 connections) — `modules/whatsapp/webhooks/services/webhook-dead-letter.service.ts`
- *... and 28 more nodes in this community*

## Relationships

- [prisma.ts](prisma.ts.md) (7 shared connections)
- [webhook-routes.ts](webhook-routes.ts.md) (6 shared connections)
- [AdminApiError](AdminApiError.md) (5 shared connections)
- [workers.ts](workers.ts.md) (5 shared connections)
- [whatsapp.module.ts](whatsapp.module.ts.md) (4 shared connections)
- [resolve-proxy-auth.ts](resolve-proxy-auth.ts.md) (4 shared connections)
- [whatsapp-broadcast-worker.ts](whatsapp-broadcast-worker.ts.md) (3 shared connections)
- [media.route.ts](media.route.ts.md) (3 shared connections)
- [messages.service.ts](messages.service.ts.md) (2 shared connections)
- [api.ts](api.ts.md) (2 shared connections)
- [whatsapp-template-sync-worker.ts](whatsapp-template-sync-worker.ts.md) (1 shared connections)

## Source Files

- `modules/whatsapp/contacts/contacts.service.ts`
- `modules/whatsapp/webhooks/api/webhook-dead-letter.route.ts`
- `modules/whatsapp/webhooks/api/webhooks.route.ts`
- `modules/whatsapp/webhooks/jobs/webhook-retry.job.ts`
- `modules/whatsapp/webhooks/services/webhook-dead-letter.service.ts`
- `modules/whatsapp/webhooks/services/webhook-hmac.service.ts`
- `modules/whatsapp/webhooks/webhooks.dto.ts`
- `modules/whatsapp/webhooks/webhooks.service.ts`
- `scripts/whatsapp-webhook-worker.ts`

## Audit Trail

- EXTRACTED: 217 (99%)
- INFERRED: 3 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*