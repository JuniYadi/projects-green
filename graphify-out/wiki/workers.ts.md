# workers.ts

> 101 nodes · cohesion 0.03

## Key Concepts

- **workers.ts** (99 connections) — `scripts/workers.ts`
- **BaseJob** (21 connections) — `lib/queue/base-job.ts`
- **queue-config.ts** (20 connections) — `lib/queue/queue-config.ts`
- **getQueueRuntimeConfig()** (20 connections) — `lib/queue/queue-config.ts`
- **whatsapp-template-sync.ts** (18 connections) — `lib/queue/whatsapp-template-sync.ts`
- **email.ts** (14 connections) — `lib/queue/email.ts`
- **vpn-provisioning.ts** (13 connections) — `lib/queue/vpn-provisioning.ts`
- **base-job.ts** (11 connections) — `lib/queue/base-job.ts`
- **whatsapp-webhook-outgoing-worker.ts** (11 connections) — `scripts/whatsapp-webhook-outgoing-worker.ts`
- **VpnProvisioningJob** (10 connections) — `lib/queue/vpn-provisioning.ts`
- **vpn-server-sync.ts** (8 connections) — `lib/queue/vpn-server-sync.ts`
- **vpn-reconciliation.service.ts** (8 connections) — `modules/vpn/provisioning/vpn-reconciliation.service.ts`
- **getQueue()** (7 connections) — `lib/queue/queue-config.ts`
- **enqueueWhatsAppTemplateSync()** (7 connections) — `lib/queue/whatsapp-template-sync.ts`
- **whatsapp-webhook-outgoing.ts** (7 connections) — `lib/queue/whatsapp-webhook-outgoing.ts`
- **VpnServerSyncJob** (6 connections) — `lib/queue/vpn-server-sync.ts`
- **EmailJob** (5 connections) — `lib/queue/email.ts`
- **getRedisConnection()** (5 connections) — `lib/queue/queue-config.ts`
- **queue-config.test.ts** (5 connections) — `lib/queue/queue-config.test.ts`
- **createWhatsAppTemplateSyncQueue()** (4 connections) — `lib/queue/whatsapp-template-sync.ts`
- **getWhatsAppTemplateSyncRedisConnection()** (4 connections) — `lib/queue/whatsapp-template-sync.ts`
- **whatsapp-template-sync.test.ts** (4 connections) — `lib/queue/whatsapp-template-sync.test.ts`
- **WhatsAppTemplateSyncJobData** (4 connections) — `lib/queue/whatsapp-template-sync.ts`
- **VpnReconciliationService** (4 connections) — `modules/vpn/provisioning/vpn-reconciliation.service.ts`
- **.runCycle()** (4 connections) — `modules/vpn/provisioning/vpn-reconciliation.service.ts`
- *... and 76 more nodes in this community*

## Relationships

- [vpn-subscriptions.route.ts](vpn-subscriptions.route.ts.md) (16 shared connections)
- [scripts/billing-cron.ts](scripts-billing-cron.ts.md) (12 shared connections)
- [opensearch-log.service.ts](opensearch-log.service.ts.md) (9 shared connections)
- [whatsapp-template-sync-worker.ts](whatsapp-template-sync-worker.ts.md) (7 shared connections)
- [whatsapp-health.tsx](whatsapp-health.tsx.md) (6 shared connections)
- [prisma.ts](prisma.ts.md) (6 shared connections)
- [github.webhook.ts](github.webhook.ts.md) (5 shared connections)
- [webhooks.service.ts](webhooks.service.ts.md) (5 shared connections)
- [vpn/email.service.tsx](vpn-email.service.tsx.md) (5 shared connections)
- [vpn-servers.route.ts](vpn-servers.route.ts.md) (5 shared connections)
- [BillingTransactionService](BillingTransactionService.md) (4 shared connections)
- [devices/api/admin-devices.route.ts](devices-api-admin-devices.route.ts.md) (3 shared connections)

## Source Files

- `lib/queue/base-job.ts`
- `lib/queue/email.test.ts`
- `lib/queue/email.ts`
- `lib/queue/queue-config.test.ts`
- `lib/queue/queue-config.ts`
- `lib/queue/vpn-provisioning.ts`
- `lib/queue/vpn-server-sync.ts`
- `lib/queue/whatsapp-template-sync.test.ts`
- `lib/queue/whatsapp-template-sync.ts`
- `lib/queue/whatsapp-webhook-outgoing.ts`
- `modules/vpn/provisioning/vpn-reconciliation.service.ts`
- `scripts/whatsapp-webhook-outgoing-worker.ts`
- `scripts/workers.ts`

## Audit Trail

- EXTRACTED: 420 (98%)
- INFERRED: 7 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*