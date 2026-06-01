# WhatsApp Module: Tenant → WorkOS Organization Migration

## Problem Statement

The WhatsApp dashboard (`/console/whatsapp/dashboard`) returns a 403 error: `requireTenantAdmin failed — tenant admin role required.` The root cause:

1. WhatsApp auth uses `tenantRole` terminology and guards (`guardTenantAdmin`, `guardTenantMember`) that are tightly coupled to a legacy `Tenant` billing model
2. Users with valid WorkOS organization membership (e.g. `user_owner`) are blocked because the guard names and error messages are misleading
3. The UI shows a generic error card with no information about the user's current role or what role is required
4. The `Tenant` Prisma model is a billing-only entity that creates an unnecessary identity layer — all 19 WhatsApp models already use `organizationId` (WorkOS) directly
5. Guards are coupled to `lib/whatsapp/auth.ts` and cannot be reused by other modules

## Design Goals

- Remove the `Tenant` model and `tenantId` references from billing
- Replace tenant-based guards with organization-based guards usable across all modules
- Implement 3-tier permission model: read / write / full
- Show clear role information in the UI when access is denied
- Single source of truth for role types (extracted from const array)

---

## Section 1: Auth Guard Renaming & Role Tiers

### New Guard Hierarchy

```typescript
guardOrgRead   → requires: any org membership (owner/admin/member)     → read dashboard, view data
guardOrgWrite  → requires: admin or owner role                        → send messages, manage devices
guardOrgFull   → requires: owner role                                 → delete devices, delete contacts
```

Renamed from `guardTenantAdmin` / `guardTenantMember` to `guardOrgRead` / `guardOrgWrite` / `guardOrgFull`.

### Route Guard Mapping (10 WhatsApp route files)

| Route | Current Guard | New Guard |
|---|---|---|
| `devices.route.ts` GET | guardTenantAdmin | guardOrgRead |
| `devices.route.ts` POST | guardSuperAdmin | guardOrgWrite |
| `devices.route.ts` PATCH | guardTenantAdmin | guardOrgWrite |
| `devices.route.ts` DELETE | guardSuperAdmin | guardOrgFull |
| `messages.route.ts` GET | guardTenantAdmin | guardOrgRead |
| `messages.route.ts` POST | guardTenantAdmin | guardOrgWrite |
| `broadcasts.route.ts` GET | guardTenantAdmin | guardOrgRead |
| `broadcasts.route.ts` POST | guardTenantAdmin | guardOrgWrite |
| `contacts.route.ts` GET | guardTenantAdmin | guardOrgRead |
| `contacts.route.ts` POST | guardTenantAdmin | guardOrgWrite |
| `groups.route.ts` GET | guardTenantAdmin | guardOrgRead |
| `groups.route.ts` POST | guardTenantAdmin | guardOrgWrite |
| `conversations.route.ts` GET | guardTenantAdmin | guardOrgRead |
| `conversations.route.ts` POST | guardTenantAdmin | guardOrgWrite |
| `templates.route.ts` GET | guardTenantAdmin | guardOrgRead |
| `templates.route.ts` POST | guardTenantAdmin | guardOrgWrite |
| `templates.route.ts` DELETE | guardSuperAdmin | guardOrgFull |
| `tokens.route.ts` GET | guardTenantAdmin | guardOrgRead |
| `tokens.route.ts` POST | guardTenantAdmin | guardOrgWrite |
| `tokens.route.ts` DELETE | guardSuperAdmin | guardOrgFull |
| `users.route.ts` GET | guardTenantMember | guardOrgRead |
| `users.route.ts` POST | guardTenantAdmin | guardOrgWrite |
| `users.route.ts` DELETE | guardTenantAdmin | guardOrgFull |
| `webhooks.route.ts` GET | guardTenantAdmin | guardOrgRead |
| `webhooks.route.ts` POST | guardTenantAdmin | guardOrgWrite |
| `webhooks.route.ts` DELETE | guardSuperAdmin | guardOrgFull |

---

## Section 2: Error Response Structure & UI Component

### New 403 Error Response

Every guard returns a structured 403 response:

```typescript
{
  ok: false,
  error: "FORBIDDEN",
  message: "Access restricted",
  required: "admin",          // required org role
  current: "member",          // user's actual org role (null if no membership)
  action: "Request an upgrade from your organization owner."
}
```

### Action Messages by Role Gap

- `member → admin`: "Request an upgrade from your organization owner."
- `member → owner`: "Request ownership transfer from your organization owner."
- `null → any`: "You need to join an organization first."
- Platform API key blocks: "API keys do not support org-scoped access. Use a WorkOS session."

### UI Component — `<AccessRestricted>`

Located at `modules/whatsapp/ui/access-restricted.tsx`. Uses existing shadcn/ui primitives (Alert/Card).

```
┌────────────────────────────────────────────────────┐
│ ⚠️  Access restricted                              │
│                                                    │
│  Current role: member                              │
│  Required role: admin                              │
│                                                    │
│  Request an upgrade from your organization owner.  │
└────────────────────────────────────────────────────┘
```

### Dashboard Integration

In `app/[lang]/console/whatsapp/dashboard/page.tsx`:

```typescript
// Before
setErrorMessage(err.message)
setState("error")

// After
if (isForbiddenWithRoleInfo(err)) {
  setAccessDenied(err)  // { required, current, action }
  setState("access_denied")
} else {
  setErrorMessage(err.message)
  setState("error")
}
```

Render path:
```typescript
if (state === "access_denied") return <AccessRestricted {...accessDenied} />
```

---

## Section 3: Tenant Model Removal & Billing Migration

### Current State

`Tenant` model is a billing entity linked via `BillingAccount` (bridges `tenantId` ↔ `organizationId`). Four billing models reference `tenantId`:

- `BillingAccount`: `tenantId String @unique` (also has `organizationId String @unique`)
- `Subscription`: `tenantId String`
- `UsageLedger`: `tenantId String`
- `Invoice`: `tenantId String?`

`messages.service.ts` reaches through the billing bridge:
```typescript
const billingAccount = await prisma.billingAccount.findUnique({ where: { organizationId } })
const tenantId = billingAccount.tenantId
await balanceGate.isBalancePositive(tenantId)
```

### Migration Plan

1. **Drop `tenantId` from billing models.** All billing queries switch to `organizationId` directly:
   - `BillingAccount`: remove `tenantId` column (already has `organizationId` unique)
   - `Subscription`: remove `tenantId`, use `billingAccountId` (already FK)
   - `UsageLedger`: change `tenantId` → `organizationId`
   - `Invoice`: change `tenantId` → `billingAccountId`

2. **Drop `Tenant` model** entirely from Prisma schema.

3. **Prisma migration** that:
   - Copies data via `BillingAccount` join where needed
   - Drops `tenantId` columns
   - Drops `Tenant` table

4. **Service layer changes** (~20 files):
   - `balance-gate.service.ts`: accepts `organizationId`
   - `quota-gate.service.ts`: accepts `organizationId`
   - `usage-ledger.service.ts`: accepts `organizationId`
   - `billing-account.service.ts`: remove tenant lookups
   - `messages.service.ts` (WhatsApp): remove `billingAccount.tenantId` chain
   - All payment module services: `tenantId` → `organizationId` parameter rename

---

## Section 4: Global Guard Architecture

### File Structure

```
lib/
├── auth/
│   ├── guards.ts          # guardOrgRead, guardOrgWrite, guardOrgFull, guardSuperAdmin
│   ├── org-role.ts        # OrgRole type, resolveOrgRole, ORG_ROLES constant
│   ├── session.ts         # getWorkOSSession, resolveApiKey, extractBearerToken
│   └── types.ts           # AuthContext, WorkOSScope, PlatformScope
├── whatsapp/
│   └── auth.ts            # WhatsApp-specific Elysia plugin only (derive, onBeforeHandle)
```

### `lib/auth/org-role.ts`

```typescript
export const ORG_ROLES = ["owner", "admin", "member"] as const
export type OrgRole = (typeof ORG_ROLES)[number]

export const resolveOrgRole = async (
  userId: string,
  organizationId: string
): Promise<OrgRole | null> => {
  // Queries WorkOS organization memberships, maps role slugs:
  // user_owner → owner, user_admin → admin, user_member → member
}
```

### `lib/auth/guards.ts`

```typescript
export type AuthContext = PlatformScope | WorkOSScope

export const guardOrgRead = (route: GuardedRoute) => ...
export const guardOrgWrite = (route: GuardedRoute) => ...
export const guardOrgFull = (route: GuardedRoute) => ...
export const guardSuperAdmin = (route: GuardedRoute) => ...
```

All guards accept `AuthContext` (not WhatsApp-specific). Return structured 403 with `required`/`current`/`action`.

### `lib/auth/types.ts`

```typescript
export type WorkOSScope = {
  type: "workos"
  userId: string
  email: string | null
  organizationId: string | null
  orgRole: OrgRole | null       // renamed from tenantRole
  platformRole: "none" | "super_admin"
}

export type PlatformScope = {
  type: "platform"
  keyId: string
  keyName: string
  environment: "SANDBOX" | "LIVE"
  scopes: string[]
}

export type AuthContext = PlatformScope | WorkOSScope
```

### `lib/whatsapp/auth.ts` (reduced)

Keeps only the Elysia plugin that:
1. Calls `getWorkOSSession` from `@/lib/auth/session`
2. Calls `resolveOrgRole` from `@/lib/auth/org-role`
3. Builds `WorkOSScope` with `orgRole` field
4. Applies `onBeforeHandle` for 401 rejection

Guard functions are imported from `@/lib/auth/guards`, not defined locally.

### Cross-Module Usage

```typescript
// Any module can now import and use:
import { guardOrgRead, guardOrgWrite, guardOrgFull } from "@/lib/auth/guards"
import type { AuthContext } from "@/lib/auth/types"

// In any Elysia route:
guardOrgRead(getHandler)      // member+ can read
guardOrgWrite(postHandler)    // admin+ can write
guardOrgFull(deleteHandler)   // owner only can delete
```

Modules that can adopt these guards incrementally (no change required in this PR):
- `modules/deploy/` — environment variable routes
- `modules/invoices/` — invoice policy and routes
- `modules/support-tickets/` — ticket routes
- `modules/billing/` — admin billing routes

---

## Execution Sequence

Each step produces a working system. Run `bun run test` + `bun run typecheck` + `bun run lint` + `bun run build` after each step.

### Step 1: Guard Rename & Role Tiers (WhatsApp module only)

- Move shared auth code from `lib/whatsapp/auth.ts` → `lib/auth/` (session, types, org-role)
- Create `lib/auth/guards.ts` with `guardOrgRead`, `guardOrgWrite`, `guardOrgFull`
- Rename `WorkOSScope.tenantRole` → `orgRole`
- Update all 10 WhatsApp route files with new guard assignments
- Update `auth.test.ts` and `auth-mock.ts`
- No DB changes. No billing changes.

### Step 2: Error Response & UI

- Update guard functions to return structured 403 with `required`/`current`/`action`
- Update WhatsApp client (`whatsapp-client.ts`) to parse new error fields
- Add `<AccessRestricted>` component in `modules/whatsapp/ui/`
- Update `dashboard/page.tsx` to render role-aware errors
- Add tests for guard error responses and UI component
- No DB changes. No billing changes.

### Step 3: Billing tenantId → organizationId

- Prisma schema migration: drop `tenantId`, drop `Tenant` model
- Update billing services to accept `organizationId`
- Update `messages.service.ts` to pass `organizationId` directly
- Update payment module references
- Run `bun run prisma:generate && bun run prisma:migrate:dev`

### Step 4: Cleanup & Rename

- Rename `modules/tenants/tenant-policy.ts` → `modules/tenants/org-policy.ts`
- Rename `TenantRole` → `OrgRole`, `TENANT_ROLES` → `ORG_ROLES` (use from `lib/auth/org-role.ts`)
- Update all imports across codebase
- Keep `modules/tenants/ui/organization-admin-surface.tsx` (portal org management UI) — only policy/types move to `lib/auth/`
- Remove empty files from `modules/tenants/` that were absorbed into `lib/auth/`

---

## Testing

- **Guard tests:** Every guard tested for all 3 role tiers + super_admin bypass + API key rejection + null org
- **Error response tests:** Verify 403 returns structured `required`/`current`/`action` fields
- **Dashboard component test:** Verify `<AccessRestricted>` renders correct role info for each role gap
- **Billing integration tests:** Update mocks from `tenantId` to `organizationId`
- **Full suite:** `bun run test` + `bun run typecheck` + `bun run lint` + `bun run build` must pass

## Key Risk

Step 3 (DB migration) drops `Tenant` table. Mitigated by: first project, no production data to preserve.
