# PGREEN-034 + PGREEN-035: Console & Portal Bugfix Design

**Created:** 2026-06-03
**Status:** Approved
**Related tasks:** PGREEN-034 (Console sidebar + dashboard), PGREEN-035 (Portal sidebar + docs CRUD + members fix)

---

## Overview

Two companion tasks addressing Console and Portal UI gaps:

- **PGREEN-034:** Make Console dashboard dynamic with live billing/ticket data (WhatsApp sidebar already done on main).
- **PGREEN-035:** Implement full Docs CRUD (list/edit/delete), fix Members page auth error (Portal sidebar WhatsApp already done on main; "Applications" entry skipped — "App Hosting" covers it).

---

## Changes

### 1. Console Dashboard (PGREEN-034)

**File:** `app/[lang]/console/page.tsx`

Convert from static server component to async client component that fetches 4 data points in parallel:

| Card | Endpoint | Data |
|------|----------|------|
| Current Balance | `GET /api/billing/account` | `formattedBalance`, `accountAge` |
| Spent This Month | `GET /api/usage` | `totalSpend` for current period |
| Last Invoice | `GET /api/billing/invoices` | First invoice (most recent): status, amount, period |
| Open Tickets | support tickets API | Count of open tickets |

**Layout:** `grid gap-6 md:grid-cols-2 lg:grid-cols-4` using existing `<Card>` + shadcn `<Skeleton>` for loading.

**State machine:** loading → populated / partial-error / all-error / empty. Graceful fallback ("Unavailable") per card if its API fails.

### 2. Docs CRUD (PGREEN-035 Part 2)

**Service** (`modules/docs/docs.service.ts`):
- Add `listDocs(organizationId: string | null)` — returns docs ordered by `updatedAt desc`
- Add `deleteDocById(id: string)` — deletes by ID

**API** (`modules/docs/api/docs.route.ts`):
- `GET /docs/list` — list all docs for authenticated org
- `DELETE /docs/:id` — delete by ID, super_admin guard (same as POST)

**UI** (`app/[lang]/portal/documentations/page.tsx`):
- List view: table with Title, Path, Updated columns
- Click row → populate `DocumentationForm` for editing
- Delete button per row → confirmation dialog
- Search/filter by title or path
- Loading skeleton, empty state, error banner

### 3. Members Auth Fix (PGREEN-035 Part 3)

**File:** `modules/tenants/api/tenants.guards.ts`

In `ensureTenantContextAccess`: when `actor.tenantRole` is null but the user has a valid `actor.organizationId` (confirmed WorkOS org member), default to `"member"` role instead of rejecting with "No valid tenant role is present."

This is safe because:
- `actor.organizationId` must still match the target org
- Super admins bypass entirely
- Other pages with stricter guards remain protected
- The role is not persisted — only used for this request context

---

## Files Changed

| File | Change |
|------|--------|
| `app/[lang]/console/page.tsx` | Convert to dynamic dashboard client component |
| `modules/docs/docs.service.ts` | Add `listDocs()`, `deleteDocById()` |
| `modules/docs/api/docs.route.ts` | Add `GET /docs/list`, `DELETE /docs/:id` |
| `app/[lang]/portal/documentations/page.tsx` | Add list/edit/delete UI |
| `modules/tenants/api/tenants.guards.ts` | Fallback to member role when role claims missing |

---

## States Covered

| Component | Loading | Empty | Error | Edge Cases |
|-----------|---------|-------|-------|------------|
| Dashboard cards | Skeleton per card | "No invoices yet" | "Unavailable" badge | Partial API failure (some cards OK) |
| Docs list | Skeleton table | "No documentation entries yet" | Error banner | Network failure, search yields no results |
| Docs delete | Button spinner | N/A | Error toast | Double-click prevention (pending state) |
| Members page | N/A | N/A | Auth fallback to member | User with no role claim sees limited actions |

---

## Testing

- Dashboard: mock API responses for loading, populated, partial-error, all-error, empty states
- Docs service: unit tests for `listDocs()`, `deleteDocById()`
- Docs API: integration tests for `GET /docs/list`, `DELETE /docs/:id`
- Docs UI: render with mock data, test select/edit/delete flow
- Members guard: test that null tenantRole with valid orgId defaults to member (does not reject)
