# Portal WhatsApp Meta App Management UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a super-admin-only portal screen at `/portal/whatsapp/meta-apps` to create, inspect, rotate, and delete `WhatsappMetaApp` webhook credentials, closing Order 2 of the "PRD - Setup Meta Webhook at Portal WhatsApp" delivery tracking table.

**Architecture:** The backend admin API (`/api/admin/whatsapp/meta-apps`) already exists and is fully tested; this plan adds one small backend field (attached-device count on the list endpoint) and a new client-side inventory component + thin server-component page + one sidebar nav entry. No new backend endpoints.

**Tech Stack:** Next.js App Router (Server + Client Components), Elysia route handlers, Prisma, bun:test + @testing-library/react + userEvent, Tailwind, shadcn/ui primitives.

**Spec:** Obsidian vault notes "PRD - Setup Meta Webhook at Portal WhatsApp" (Order 2 row) and "Issue - Build Portal WhatsApp Meta App Management UI".

## Global Constraints

- Use `bun` for all commands. Never `npm`/`yarn`.
- Create a new git branch before starting implementation; commit each changed/created file individually with its own commit (hard project rule).
- TypeScript strict, 2-space indent, no semicolons, double quotes, 80-char line width, `@/*` imports.
- Prisma types must come from `@prisma/client`; no manual model/delegate/enum mirror types.
- API responses use explicit DTOs (`*.dto.ts` + `toDTO` mapper); internal service-to-service calls use Prisma types directly.
- Follow the shared portal Card/Table pattern already used in `modules/whatsapp/organization-api-keys/ui/organization-api-key-inventory.tsx` and its page wrapper `app/[lang]/portal/whatsapp/api-keys/page.tsx` — this is the closest existing precedent (super-admin CRUD-style inventory, plain `fetch`, 403-as-access-denied-card, no server-side redirect).
- Bun tests: mock leaf infrastructure only, `mock.module()` before imports, `mockClear()` + explicit defaults in `beforeEach`.
- Secret/verify-token fields must NEVER be pre-filled from a fetched value on any form — this is a security requirement and needs its own test assertion, not just manual review.
- `requireSuperAdmin` gating on the existing `/admin/whatsapp/meta-apps` API routes is unchanged — do not weaken or bypass it.

---
### Task 1: Return attached-device count from the Meta App list endpoint

**Files:**
- Modify: `modules/whatsapp/meta-apps/meta-apps.dto.ts`
- Modify: `modules/whatsapp/meta-apps/meta-apps.service.ts`
- Modify: `modules/whatsapp/meta-apps/api/meta-apps.route.ts`
- Test: `modules/whatsapp/meta-apps/meta-apps.service.test.ts`
- Test: `modules/whatsapp/meta-apps/api/meta-apps.route.test.ts`

**Interfaces:**
- Consumes: `WhatsappMetaApp` Prisma model with `devices WhatsappDevice[]` relation (see `prisma/schema.prisma`).
- Produces: `WhatsappMetaAppListItemDTO` (all fields of the existing `WhatsappMetaAppDTO` plus `deviceCount: number`), returned only by `MetaAppsService.list()` and only by the route's `GET /` handler. `get`/`create`/`update`/`delete` keep returning the existing `WhatsappMetaAppDTO` shape unchanged (no `deviceCount`).

- [ ] **Step 1: Write the failing service test**

In `modules/whatsapp/meta-apps/meta-apps.service.test.ts`, replace the existing `it("lists active metadata and resolves credentials by webhook key", ...)` block's list-related assertions with:

```ts
it("lists metadata with attached device counts", async () => {
  mockFindMany.mockResolvedValueOnce([
    { ...appRecord, _count: { devices: 3 } },
  ])
  const listed = await service.list()
  expect(mockFindMany.mock.calls[0]?.[0]).toEqual({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { devices: true } } },
  })
  expect(listed[0]).not.toHaveProperty("appSecretEncrypted")
  expect(listed[0]?.deviceCount).toBe(3)
})
```

Leave the rest of that original test's body (the `resolveCredentialsByWebhookKey` assertions further down) in a separate `it` block if they were combined — split them so each `it` tests one behavior.

- [ ] **Step 2: Run it, confirm it fails**

Run: `bun test modules/whatsapp/meta-apps/meta-apps.service.test.ts`
Expected: FAIL — `include` missing from the call args, and/or `deviceCount` is `undefined`.

- [ ] **Step 3: Implement the DTO change**

In `modules/whatsapp/meta-apps/meta-apps.dto.ts`, add after `toWhatsappMetaAppDTO`:

```ts
export type WhatsappMetaAppListItemDTO = WhatsappMetaAppDTO & {
  deviceCount: number
}

export function toWhatsappMetaAppListItemDTO(
  app: Prisma.WhatsappMetaAppGetPayload<{
    include: { _count: { select: { devices: true } } }
  }>
): WhatsappMetaAppListItemDTO {
  return {
    ...toWhatsappMetaAppDTO(app),
    deviceCount: app._count.devices,
  }
}
```

- [ ] **Step 4: Implement the service change**

In `modules/whatsapp/meta-apps/meta-apps.service.ts`, update the import line to also bring in `toWhatsappMetaAppListItemDTO` and `type WhatsappMetaAppListItemDTO` from `./meta-apps.dto`, then replace the `list` method body:

```ts
async list(
  options: MetaAppListOptions = {}
): Promise<WhatsappMetaAppListItemDTO[]> {
  const apps = await this.database.whatsappMetaApp.findMany({
    where: options.activeOnly === false ? {} : { active: true },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { devices: true } } },
  })
  return apps.map(toWhatsappMetaAppListItemDTO)
}
```

- [ ] **Step 5: Run it, confirm it passes**

Run: `bun test modules/whatsapp/meta-apps/meta-apps.service.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add modules/whatsapp/meta-apps/meta-apps.dto.ts modules/whatsapp/meta-apps/meta-apps.service.ts modules/whatsapp/meta-apps/meta-apps.service.test.ts
git commit -m "feat(whatsapp): return attached-device count from meta app list service"
```

- [ ] **Step 7: Write the failing route test**

In `modules/whatsapp/meta-apps/api/meta-apps.route.test.ts`, change the `beforeEach` default `mockList.mockImplementation(async () => [appRecord])` to `mockList.mockImplementation(async () => [{ ...appRecord, deviceCount: 0 }])`, and change the `it("lists active and inactive metadata without credentials", ...)` test's assertion from `expect(body).toEqual({ ok: true, data: [appRecord] })` to `expect(body).toEqual({ ok: true, data: [{ ...appRecord, deviceCount: 0 }] })`.

- [ ] **Step 8: Run it, confirm it fails**

Run: `bun test modules/whatsapp/meta-apps/api/meta-apps.route.test.ts`
Expected: FAIL — route still returns `publicMetaApp(app)` without `deviceCount`.

- [ ] **Step 9: Implement the route change**

In `modules/whatsapp/meta-apps/api/meta-apps.route.ts`, change only the `.get("/", ...)` handler's success branch from:

```ts
const apps = await service.list({ activeOnly: false })
return { ok: true as const, data: apps.map(publicMetaApp) }
```

to:

```ts
const apps = await service.list({ activeOnly: false })
return {
  ok: true as const,
  data: apps.map((app) => ({
    ...publicMetaApp(app),
    deviceCount: app.deviceCount,
  })),
}
```

Leave every other handler (`GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`) untouched — they keep using `publicMetaApp(app)` as-is.

- [ ] **Step 10: Run it, confirm it passes**

Run: `bun test modules/whatsapp/meta-apps/api/meta-apps.route.test.ts`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add modules/whatsapp/meta-apps/api/meta-apps.route.ts modules/whatsapp/meta-apps/api/meta-apps.route.test.ts
git commit -m "feat(whatsapp): expose device count on admin meta app list route"
```
### Task 2: Build the Meta App inventory client component

**Files:**
- Create: `modules/whatsapp/meta-apps/ui/meta-app-inventory.tsx`
- Test: `modules/whatsapp/meta-apps/ui/meta-app-inventory.test.tsx`

**Interfaces:**
- Consumes: `GET/POST/PATCH/DELETE /api/admin/whatsapp/meta-apps[/:id]` JSON responses shaped like `{ ok: boolean, data?: {...}, message?: string }`, where list `data` items are `{ id, name, metaAppId, webhookKey, active, callbackPath, deviceCount, createdAt, updatedAt }` (from Task 1).
- Produces: `WhatsappMetaAppInventory({ baseUrl: string })` — a named-exported React client component, imported by Task 3's page as `import { WhatsappMetaAppInventory } from "@/modules/whatsapp/meta-apps/ui/meta-app-inventory"`.

- [ ] **Step 1: Write the failing component test — list renders with device count, no secrets in response**

Create `modules/whatsapp/meta-apps/ui/meta-app-inventory.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { WhatsappMetaAppInventory } from "./meta-app-inventory"

const metaApp = {
  id: "meta-1",
  name: "Primary",
  metaAppId: "12345",
  webhookKey: "webhook-key",
  active: true,
  callbackPath: "/api/whatsapp/meta-webhook/webhook-key",
  deviceCount: 2,
  createdAt: "2026-08-14T10:00:00.000Z",
  updatedAt: "2026-08-14T10:00:00.000Z",
}

const mockFetch = mock(async (input: string | Request, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.url
  const method = init?.method ?? "GET"
  if (url.includes("/api/admin/whatsapp/meta-apps") && method === "GET") {
    return new Response(
      JSON.stringify({ ok: true, data: [metaApp] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }
  return new Response(JSON.stringify({ ok: false }), { status: 404 })
})

global.fetch = mockFetch as unknown as typeof fetch

describe("WhatsappMetaAppInventory", () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders the list with device count and no secret material", async () => {
    const view = render(
      <WhatsappMetaAppInventory baseUrl="https://app.example.com" />
    )

    expect(await view.findByText("Primary")).toBeTruthy()
    expect(view.getByText("2")).toBeTruthy()
    expect(
      view.getByText("https://app.example.com/api/whatsapp/meta-webhook/webhook-key")
    ).toBeTruthy()
    const allFetchedBodies = mockFetch.mock.results
    expect(JSON.stringify(allFetchedBodies)).not.toContain("appSecret")
    expect(JSON.stringify(allFetchedBodies)).not.toContain("verifyToken")
  })
})
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `bun test modules/whatsapp/meta-apps/ui/meta-app-inventory.test.tsx`
Expected: FAIL — module `./meta-app-inventory` does not exist yet.
