# whatsapp-broadcast-worker.ts

> 64 nodes · cohesion 0.05

## Key Concepts

- **whatsapp-broadcast-worker.ts** (24 connections) — `scripts/whatsapp-broadcast-worker.ts`
- **broadcasts.route.ts** (22 connections) — `modules/whatsapp/broadcasts/api/broadcasts.route.ts`
- **whatsapp-broadcast.ts** (15 connections) — `lib/queue/whatsapp-broadcast.ts`
- **broadcast-schedule.service.ts** (11 connections) — `modules/whatsapp/broadcasts/broadcast-schedule.service.ts`
- **dispatchBroadcast()** (10 connections) — `scripts/whatsapp-broadcast-worker.ts`
- **getWhatsAppBroadcastRedisConnection()** (7 connections) — `lib/queue/whatsapp-broadcast.ts`
- **broadcasts.dto.ts** (7 connections) — `modules/whatsapp/broadcasts/broadcasts.dto.ts`
- **quota-credit.service.ts** (7 connections) — `modules/whatsapp/messages/quota-credit.service.ts`
- **whatsapp-broadcast.test.ts** (6 connections) — `lib/queue/whatsapp-broadcast.test.ts`
- **broadcast-schedule.dto.ts** (6 connections) — `modules/whatsapp/broadcasts/broadcast-schedule.dto.ts`
- **getHourlyMessageLimit()** (6 connections) — `modules/whatsapp/devices/devices.constants.ts`
- **WhatsAppBroadcastJobData** (5 connections) — `lib/queue/whatsapp-broadcast.ts`
- **resolveWhatsappQuotaCredit()** (5 connections) — `modules/whatsapp/messages/quota-credit.service.ts`
- **QueueMock** (4 connections) — `lib/queue/whatsapp-broadcast.test.ts`
- **getDeviceBroadcastCapacity()** (4 connections) — `modules/whatsapp/broadcasts/broadcast-schedule.service.ts`
- **enforceDeviceLimit()** (4 connections) — `scripts/whatsapp-broadcast-worker.ts`
- **enforceThrottle()** (4 connections) — `scripts/whatsapp-broadcast-worker.ts`
- **enqueueWhatsAppBroadcast()** (3 connections) — `lib/queue/whatsapp-broadcast.ts`
- **getSharedQueue()** (3 connections) — `lib/queue/whatsapp-broadcast.ts`
- **.add()** (3 connections) — `lib/queue/whatsapp-broadcast.test.ts`
- **computeRecommendedSchedule()** (3 connections) — `modules/whatsapp/broadcasts/broadcast-schedule.service.ts`
- **validateSchedule()** (3 connections) — `modules/whatsapp/broadcasts/broadcast-schedule.service.ts`
- **toWhatsappBroadcastCampaignDTO()** (3 connections) — `modules/whatsapp/broadcasts/broadcasts.dto.ts`
- **devices.constants.ts** (3 connections) — `modules/whatsapp/devices/devices.constants.ts`
- **enqueueBroadcastJob()** (3 connections) — `scripts/whatsapp-broadcast-worker.ts`
- *... and 39 more nodes in this community*

## Relationships

- [prisma.ts](prisma.ts.md) (4 shared connections)
- [webhook-routes.ts](webhook-routes.ts.md) (3 shared connections)
- [webhooks.service.ts](webhooks.service.ts.md) (3 shared connections)
- [workers.ts](workers.ts.md) (2 shared connections)
- [resolve-proxy-auth.ts](resolve-proxy-auth.ts.md) (2 shared connections)
- [whatsapp.module.ts](whatsapp.module.ts.md) (2 shared connections)
- [messages.service.ts](messages.service.ts.md) (2 shared connections)
- [meta-cloud/types.ts](meta-cloud-types.ts.md) (2 shared connections)
- [analytics.service.ts](analytics.service.ts.md) (1 shared connections)

## Source Files

- `lib/queue/whatsapp-broadcast.test.ts`
- `lib/queue/whatsapp-broadcast.ts`
- `modules/whatsapp/broadcasts/api/broadcasts.route.ts`
- `modules/whatsapp/broadcasts/broadcast-schedule.dto.ts`
- `modules/whatsapp/broadcasts/broadcast-schedule.service.ts`
- `modules/whatsapp/broadcasts/broadcasts.dto.ts`
- `modules/whatsapp/devices/devices.constants.ts`
- `modules/whatsapp/messages/quota-credit.service.ts`
- `scripts/whatsapp-broadcast-worker.ts`

## Audit Trail

- EXTRACTED: 227 (99%)
- INFERRED: 2 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*