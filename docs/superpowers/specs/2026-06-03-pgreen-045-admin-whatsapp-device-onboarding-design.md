# PGREEN-045: Admin WhatsApp Device Onboarding — Design

**Task ID:** PGREEN-045
**Date:** 2026-06-03
**Branch:** `feat/pgreen-045-admin-whatsapp-device-onboarding`
**Worktree:** `~/.config/superpowers/worktrees/projects-green/feat-pgreen-045-admin-whatsapp-device-onboarding`
**Source spec:** `JuniYadi/ide-projects` → `projects-green/_tasks/active/PGREEN-045-admin-whatsapp-device-onboarding.md`
**Source gap analysis:** `JuniYadi/ide-projects` → `projects-green/_features/admin-whatsapp-device-onboarding.md`

---

## Problem Statement

The super admin page at `/admin/whatsapp/devices` is read-only. It lists every device across every organization and exposes top-up actions, but the admin cannot **onboard a new device on behalf of an organization**. Console members (`/console/whatsapp/devices`) can only create devices for their own organization and the request schema (`createDeviceSchema`) only accepts `name`, `phoneNumber`, `environment` — there is no path to set the WA Business Account, WA Phone ID, WA Application ID, or Callback URL that production deployments require.

**Symptoms:**

- `POST /api/admin/devices` does not exist
- No UI for adding a device from the admin surface
- No endpoint to list organizations for the admin's org-picker
- `createDeviceSchema` does not capture the optional WA Business Account fields even though the `WhatsappDevice` Prisma model has those columns (`schema.prisma:920-926`)
- `devicesService.create()` writes none of those fields to the database, so even if the route accepted them they would be silently dropped

**Outcome:** Super admin can create a device from `/admin/whatsapp/devices`, choose the target organization, and capture the full WA Business Account context. The platform-level oversight loop is completed.

---

## Goals

1. Add `POST /api/admin/devices` that creates a device on behalf of any organization, accepting optional WA Business Account fields.
2. Add `GET /api/admin/organizations` so the UI can populate the organization dropdown.
3. Migrate all handlers in `admin-devices.route.ts` from the loose `resolveAuthContext` check to the strict `requireSuperAdmin` guard so the entire file has one consistent authorization model.
4. Persist the optional WA Business Account fields in the database by extending `devicesService.create()` — keep the service the single source of truth for device creation logic.
5. Add an `Add Device` button and dialog to the admin page that matches the styling and patterns of the console create dialog.
6. Update `FEATURES.md` section 3.2 to reflect the completed oversight row.

## Non-Goals

- PATCH / DELETE handlers on the admin route (out of scope; tracked separately).
- Persisting the device `environment` (no column exists; per existing `devices.service.ts:5-8` comment, follow-up migration is intentionally deferred).
- Persisting the WhatsApp `name` field (no column; replaced with a "WhatsApp Display Name" stored in `whatsappProfile` JSON — see Section 4).
- Pagination of the WorkOS organizations list (capped at 100; matches `support-tickets.route.ts:611` precedent; not relevant to PGREEN-045).
- Console create flow changes.
- Any Prisma migration.

---

## Section 1: Schema & Service Extension

### 1.1 `adminCreateDeviceSchema`

**File:** `modules/whatsapp/devices/devices.schemas.ts`

Add a new Zod schema that extends `createDeviceSchema` (lines 19-23) with admin-only fields:

```ts
export const adminCreateDeviceSchema = createDeviceSchema.extend({
  organizationId: z.string().trim().min(1, "Organization ID is required"),
  displayName: z.string().trim().max(120).optional(),
  whatsappBusinessAccountId: z.string().trim().max(64).optional(),
  whatsappPhoneId: z.string().trim().max(64).optional(),
  whatsappApplicationId: z.string().trim().max(64).optional(),
  callbackUrl: z.string().url().optional().or(z.literal("")),
})

export type AdminCreateDeviceInput = z.infer<typeof adminCreateDeviceSchema>
```

Notes:
- `organizationId` is the new required field; everything else is optional.
- `displayName` is the user-facing name shown in the admin/console list. The Prisma model has no `name` column, so this is persisted into `whatsappProfile` JSON (see 1.2).
- Empty-string callbackUrl is allowed (same pattern as `updateDeviceSchema:34`).

### 1.2 `devicesService.create()` extension

**File:** `modules/whatsapp/devices/devices.service.ts`

Extend the existing service so the new fields are actually persisted. Today the `create` handler (lines 92-103) only writes `organizationId`, `phoneNumber`, `status`:

```ts
async create(input) {
  const device = await db.whatsappDevice.create({
    data: {
      organizationId: input.organizationId ?? "",
      phoneNumber: input.phoneNumber,
      status: "ACTIVE",
      whatsappBusinessAccountId: input.whatsappBusinessAccountId ?? null,
      whatsappPhoneId: input.whatsappPhoneId ?? null,
      whatsappApplicationId: input.whatsappApplicationId ?? null,
      callbackUrl: input.callbackUrl || null,
      ...(input.displayName
        ? { whatsappProfile: { name: input.displayName } }
        : {}),
    },
  })
  return _toDeviceDetail(device as PrismaDeviceFields)
}
```

Type widening: add the four optional WA fields and the optional `displayName` to `CreateDeviceInput` so the service has a single typed signature for both console and admin callers. The console service caller simply doesn't pass them.

### 1.3 Mapper & detail type

`_toDeviceDetail` (lines 60-67) already returns the `whatsappProfile` and `callbackUrl` from the row, so no mapper changes are needed. The `DeviceListItem` returned from the existing `GET /admin/devices` handler will pick up the new fields through the next refresh.

---

## Section 2: API Routes

### 2.1 Migrate `admin-devices.route.ts` to `requireSuperAdmin`

**File:** `modules/whatsapp/devices/api/admin-devices.route.ts`

Convert `createAdminDevicesRoutes` to a factory that accepts a `deps` bag (matching the precedent in `admin-organizations.route.ts:11-12` and `admin-invitations.route.ts:12-13`) and replaces `resolveAuthContext` with `requireSuperAdmin` in **all four handlers**:

| Handler | Today | After |
|---|---|---|
| `GET /` | `resolveAuthContext` → 401 | `requireSuperAdmin` → 401 / 403 |
| `GET /:id` | `resolveAuthContext` → 401 | `requireSuperAdmin` → 401 / 403 |
| `POST /:id/top-up` | `resolveAuthContext` → 401 | `requireSuperAdmin` → 401 / 403 |
| `POST /` (new) | — | `requireSuperAdmin` → 401 / 403 |

`requireSuperAdmin` is imported from `modules/admin/api/admin.guards.ts` and uses the established `AdminApiError` envelope from `admin.guards.ts:15-21`.

The `resolveAuthContext` import and `mockResolveAuthContext` are dropped.

### 2.2 New `POST /api/admin/devices`

```ts
.post(
  "/",
  async ({ body, set }) => {
    const actor = await guard(set)
    if ("ok" in actor && !actor.ok) return actor

    const parsed = adminCreateDeviceSchema.safeParse(body)
    if (!parsed.success) {
      set.status = 422
      return {
        ok: false,
        error: "VALIDATION_ERROR",
        message: "Please fix the highlighted fields and try again.",
        fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
      }
    }

    try {
      const device = await createDeviceService().create({
        ...parsed.data,
        organizationId: parsed.data.organizationId,
      })
      set.status = 201
      return { ok: true, device }
    } catch (error) {
      console.error("[AdminDevices] Create error:", error)
      set.status = 500
      return { ok: false, error: "INTERNAL_SERVER_ERROR", message: "Unable to create device." }
    }
  },
  { body: adminCreateDeviceSchema },
)
```

`createDeviceService` is the existing factory from `devices.service.ts:71`. The new handler delegates fully — no Prisma calls in the route layer.

### 2.3 New `GET /api/admin/organizations`

**File:** `modules/admin/api/routes/admin-organizations.route.ts`

Add a `.get("/admin/organizations", ...)` to `createAdminOrganizationsRoutes` that calls a new `listAdminOrganizations()` service helper and returns the summaries:

```ts
.get(
  "/admin/organizations",
  async ({ set }) => {
    const actor = await guard(set)
    if ("ok" in actor && !actor.ok) return actor

    try {
      const organizations = await listAdminOrganizations()
      return { ok: true, organizations }
    } catch (error) {
      console.error("[AdminOrganizations] List error:", error)
      set.status = 500
      return { ok: false, error: "INTERNAL_SERVER_ERROR", message: "Unable to list organizations." }
    }
  },
)
```

### 2.4 `listAdminOrganizations()` service helper

**File:** `modules/admin/admin.service.ts`

```ts
export const listAdminOrganizations = async (): Promise<AdminOrganizationSummary[]> => {
  const workos = getWorkOS()
  const response = await workos.organizations.listOrganizations({ limit: 100 })
  return response.data.map(toOrganizationSummary)
}
```

Reuses the existing `toOrganizationSummary` mapper (line 45) and `AdminOrganizationSummary` type (line 3). Matches the precedent in `support-tickets.route.ts:611`.

---

## Section 3: UI — Add Device Dialog

**File:** `app/[lang]/admin/whatsapp/devices/page.tsx`

Restructure the page from a single-fetch list to a small client app:

1. Convert the page (already `"use client"`) to also fetch `GET /api/admin/organizations` on mount and cache the list in state.
2. Add an `Add Device` button in the `CardHeader` row (right-aligned, matching the console pattern in `console/whatsapp/devices/page.tsx:347-350`).
3. Add a `Dialog` (shadcn) with the following fields, in order:

| # | Field | Component | Required | Notes |
|---|---|---|---|---|
| 1 | Organization | `<Select>` from shadcn | yes | Filled from `GET /api/admin/organizations`; first item preselected on dialog open |
| 2 | Phone Number | `<Input>` | yes | `inputMode="tel"`, `autoComplete="tel"` |
| 3 | WhatsApp Display Name | `<Input>` | no | Free-form label for the admin UI list; persisted to `whatsappProfile.name` |
| 4 | Environment | `<Select>` SANDBOX / LIVE | yes | Default `LIVE` |
| 5 | WA Business Account ID | `<Input>` | no | |
| 6 | WA Phone ID | `<Input>` | no | |
| 7 | WA Application ID | `<Input>` | no | |
| 8 | Callback URL | `<Input type="url">` | no | |

4. Dialog footer: `Cancel` (outline) + `Add Device` (primary, `disabled` while submitting).
5. On submit: `POST /api/admin/devices` with the form state, toast success on 201, toast error on failure, close dialog, refresh the device list (`loadDevices`).

Imports added: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`, `Label`, `Plus` (phosphor). `toast` from `sonner`.

**Loading organization list:** if the org fetch is still in flight when the user clicks `Add Device`, the dialog opens with an empty Select and shows an inline skeleton. The Select is `disabled` until the list resolves.

---

## Section 4: Display Name Storage

The form exposes a "WhatsApp Display Name" field. The Prisma `WhatsappDevice` model has no `name` column. The chosen home is the existing `whatsappProfile Json?` field (`schema.prisma:924`).

**Service behavior** (`devices.service.ts:92`):

```ts
const whatsappProfile = input.displayName
  ? { name: input.displayName }
  : undefined
```

When the admin does not provide a display name, no `whatsappProfile` is written and the field stays `null` (preserving existing behavior).

**UI display:** the admin device list (`admin/whatsapp/devices/page.tsx`) currently shows `device.phoneNumber` as the link text. The updated list will prefer `device.whatsappProfile?.name` (cast to string) and fall back to `phoneNumber`. This makes the new field visible without a Prisma migration.

---

## Section 5: Test Strategy

### 5.1 `admin-devices.route.test.ts` rewrite

The existing tests assert `resolveAuthContext` 401 responses. With the migration to `requireSuperAdmin`, semantics change: the same `401` is still returned (when not signed in) but a non-super-admin user now gets `403 FORBIDDEN`. The test file is rewritten with a guard dep-injection pattern so tests can supply a mock guard:

```ts
const mockGuard = mock<(...args: any[]) => any>(async (set) => ({
  userId: "u-1",
  platformRole: "super_admin",
}))

const { createAdminDevicesRoutes } = await import("./admin-devices.route")

function createTestApp() {
  return new Elysia().use(createAdminDevicesRoutes({ requireSuperAdmin: mockGuard }))
}
```

Cases (existing + new):

| Method | Path | Scenario | Expected |
|---|---|---|---|
| GET | `/` | guard returns unauthorized | 401 UNAUTHORIZED |
| GET | `/` | guard returns forbidden | 403 FORBIDDEN |
| GET | `/` | guard succeeds, no devices | 200 with empty list |
| GET | `/` | guard succeeds, devices present | 200 with list |
| GET | `/:id` | guard succeeds, device found | 200 with device |
| GET | `/:id` | guard succeeds, device not found | 404 |
| POST | `/:id/top-up` | guard succeeds, missing amount | 422 |
| POST | `/:id/top-up` | guard succeeds, device not found | 404 |
| POST | `/:id/top-up` | guard succeeds, happy path | 200 |
| POST | `/` | guard returns unauthorized | 401 |
| POST | `/` | guard returns forbidden | 403 |
| POST | `/` | guard succeeds, missing organizationId | 422 |
| POST | `/` | guard succeeds, valid body | 201 with `DeviceDetail` |

The Prisma mock layer in the existing file is extended with `whatsappDevice.create`.

### 5.2 New `admin-organizations.route.test.ts`

Covers the new GET handler:

| Scenario | Expected |
|---|---|
| guard returns unauthorized | 401 |
| guard returns forbidden | 403 |
| guard succeeds, WorkOS returns 2 orgs | 200 with mapped list |
| guard succeeds, WorkOS throws | 500 INTERNAL_SERVER_ERROR |

Mocks `getWorkOS` from `@workos-inc/authkit-nextjs` and `workos.organizations.listOrganizations` to return a fake `data` array.

### 5.3 Coverage

`bun run test:coverage` must pass with line coverage acceptable (no regression vs. baseline 1218 pass).

---

## Section 6: FEATURES.md update

**File:** `FEATURES.md`

In section 3.2, the row

```
| Admin device oversight | ✓ `admin-devices.route` | - | ✓ Admin page |
```

becomes

```
| Admin device oversight (read + top-up + create) | ✓ `admin-devices.route` | - | ✓ Admin page |
```

and the trailing `?? Feature Spec` line that mentions "missing POST `/admin/devices`" is removed.

---

## Section 7: Validation Plan

Per the repo AGENTS.md "4 PILLARS" hard requirement:

1. `bun run lint` — 0 errors
2. `bun run typecheck` — 0 errors
3. `bun run test` — all tests pass (baseline: 1218 pass / 2 skip)
4. `bun run test:coverage` — coverage acceptable
5. `bun run build` — production build succeeds

Plus manual smoke against `bun run dev`:

- `POST /api/admin/devices` with valid body (super admin) → 201 + device
- `POST /api/admin/devices` with missing `organizationId` → 422
- `POST /api/admin/devices` as non-super-admin → 403
- `GET /api/admin/organizations` → 200 + list
- Click `Add Device` → dialog opens with org dropdown populated
- Submit valid dialog → toast success, dialog closes, list refreshes with new device

---

## Section 8: Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `requireSuperAdmin` migration breaks existing consumers of `GET /api/admin/devices` and top-up | Both endpoints are super-admin-only by intent. Callers using a non-super-admin session today would be unauthorized before, and remain unauthorized after. No regression for legitimate use. |
| Extending `CreateDeviceInput` widens the type for console callers | The new fields are all `optional`; existing console `createDeviceSchema` parsing path is untouched. Console form does not send these fields. |
| Persisting `displayName` to `whatsappProfile.name` shadows any future real `name` column | Acceptable for MVP. Follow-up migration to add a dedicated `name` column can lift this from `whatsappProfile` later. |
| WorkOS list capped at 100 | Precedent in `support-tickets.route.ts:611`. Org count is small. Pagination can be added later. |
| Existing test file is rewritten | Same coverage, different shape. Net test count should not decrease. |

---

## Implementation Order

1. **Schema** — add `adminCreateDeviceSchema` and extend `CreateDeviceInput`
2. **Service** — extend `devicesService.create()` to persist 4 WA fields + `displayName` → `whatsappProfile`
3. **Admin devices route** — migrate all 3 existing handlers to `requireSuperAdmin` with deps-injection, add `POST /`
4. **Admin orgs service** — add `listAdminOrganizations()`
5. **Admin orgs route** — add `GET /admin/organizations`
6. **Admin page UI** — add `Add Device` button, dialog with 8 fields, org fetch
7. **FEATURES.md** — update section 3.2 row
8. **Tests** — rewrite `admin-devices.route.test.ts`, add `admin-organizations.route.test.ts`
9. **4-pillar validation** — lint, typecheck, test, test:coverage, build
10. **Manual smoke** — dev-server walkthrough

---

## Out of Scope (Future Tasks)

- `PATCH /api/admin/devices/:id` and `DELETE /api/admin/devices/:id` handlers
- Persisting the `environment` enum to a new column
- Persisting the `name` field to a new column
- Server-side org search and cursor pagination
- Linking the device to a billing account on creation (currently `billingAccount` is only created lazily on first top-up)
