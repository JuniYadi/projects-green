# whatsapp-health.tsx

> 45 nodes · cohesion 0.06

## Key Concepts

- **whatsapp-health.tsx** (22 connections) — `lib/queue/whatsapp-health.tsx`
- **client.ts** (11 connections) — `lib/whatsapp/meta-cloud/client.ts`
- **meta-cloud/index.ts** (11 connections) — `lib/whatsapp/meta-cloud/index.ts`
- **checkDeviceHealth()** (8 connections) — `lib/queue/whatsapp-health.tsx`
- **MetaCloudHttpClient** (7 connections) — `lib/whatsapp/meta-cloud/client.ts`
- **errors.ts** (7 connections) — `lib/whatsapp/meta-cloud/errors.ts`
- **rate-limit.route.ts** (7 connections) — `modules/whatsapp/rate-limit/api/rate-limit.route.ts`
- **ApiCallTracker** (7 connections) — `modules/whatsapp/rate-limit/rate-limit.service.ts`
- **checkSingleDevice()** (6 connections) — `lib/queue/whatsapp-health.tsx`
- **WhatsAppHealthJob** (6 connections) — `lib/queue/whatsapp-health.tsx`
- **redis.ts** (6 connections) — `lib/redis.ts`
- **endpoints.ts** (5 connections) — `lib/whatsapp/meta-cloud/endpoints.ts`
- **MetaCloudError** (4 connections) — `lib/whatsapp/meta-cloud/errors.ts`
- **device-disconnected.tsx** (4 connections) — `modules/whatsapp/emails/device-disconnected.tsx`
- **rate-limit.service.ts** (4 connections) — `modules/whatsapp/rate-limit/rate-limit.service.ts`
- **clearMissCount()** (3 connections) — `lib/queue/whatsapp-health.tsx`
- **incrementMissCount()** (3 connections) — `lib/queue/whatsapp-health.tsx`
- **missKey()** (3 connections) — `lib/queue/whatsapp-health.tsx`
- **runHeartbeatCycle()** (3 connections) — `lib/queue/whatsapp-health.tsx`
- **sendDisconnectEmail()** (3 connections) — `lib/queue/whatsapp-health.tsx`
- **.handle()** (3 connections) — `lib/queue/whatsapp-health.tsx`
- **.request()** (2 connections) — `lib/whatsapp/meta-cloud/client.ts`
- **getEndpoint()** (2 connections) — `lib/whatsapp/meta-cloud/endpoints.ts`
- **normalizeMetaError()** (2 connections) — `lib/whatsapp/meta-cloud/errors.ts`
- **DeviceDisconnectedEmail()** (2 connections) — `modules/whatsapp/emails/device-disconnected.tsx`
- *... and 20 more nodes in this community*

## Relationships

- [meta-cloud/types.ts](meta-cloud-types.ts.md) (10 shared connections)
- [workers.ts](workers.ts.md) (6 shared connections)
- [resolve-proxy-auth.ts](resolve-proxy-auth.ts.md) (4 shared connections)
- [prisma.ts](prisma.ts.md) (3 shared connections)
- [vpn/email.service.tsx](vpn-email.service.tsx.md) (2 shared connections)
- [devices.schemas.ts](devices.schemas.ts.md) (2 shared connections)
- [whatsapp.module.ts](whatsapp.module.ts.md) (2 shared connections)
- [devices/api/admin-devices.route.ts](devices-api-admin-devices.route.ts.md) (1 shared connections)
- [cache/index.ts](cache-index.ts.md) (1 shared connections)
- [workos-directory.ts](workos-directory.ts.md) (1 shared connections)
- [github.service.ts](github.service.ts.md) (1 shared connections)
- [api.ts](api.ts.md) (1 shared connections)

## Source Files

- `lib/queue/whatsapp-health.tsx`
- `lib/redis.ts`
- `lib/whatsapp/meta-cloud/client.ts`
- `lib/whatsapp/meta-cloud/endpoints.ts`
- `lib/whatsapp/meta-cloud/errors.ts`
- `lib/whatsapp/meta-cloud/index.ts`
- `modules/whatsapp/emails/device-disconnected.tsx`
- `modules/whatsapp/rate-limit/api/rate-limit.route.ts`
- `modules/whatsapp/rate-limit/rate-limit.service.ts`

## Audit Trail

- EXTRACTED: 162 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*