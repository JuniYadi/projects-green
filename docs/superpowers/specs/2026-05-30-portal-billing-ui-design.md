# Spec: Portal Billing UI (PGREEN-025)

**Created:** 2026-05-30
**Task ID:** PGREEN-025
**Priority:** P1
**Milestone:** M4 — Billing Foundation

---

## Context

Admins and Owners need full control over billing under `/portal/billing` — viewing all tenant members' usage, adjusting balances, managing subscriptions (upgrade/downgrade/cancel), and generating/finalizing invoices. This is the Portal (admin-facing) surface.

## Design Decisions

- **Navigation:** Nested tabs within `/portal/billing` — one sidebar item keeps navigation clean; tab state in URL search params for shareability
- **Invoice detail:** Standalone page `/portal/billing/invoices/[id]` for stable URL sharing
- **API structure:** `members.route.ts` with GET / and GET /:userId, separate `adjustments.route.ts` — follows Elysia factory pattern

---

## API Routes

### Existing (PGREEN-023)
- `POST /api/billing/admin/adjust` — Balance adjustment ✓
- `PATCH /api/billing/admin/subscriptions/:id` — Subscription update ✓

### New Routes

#### `modules/billing/api/admin/members.route.ts`
- `GET /admin/members` — List all tenant members with billing data (balance, subscriptions count, monthly spend)
- `GET /admin/members/:userId` — Individual member billing detail

#### `modules/billing/api/admin/adjustments.route.ts`
- `GET /admin/adjustments` — List all billing adjustments for tenant with pagination, filter by type/date/admin

#### `modules/billing/api/admin/invoice.route.ts` (new file)
- `POST /admin/invoice-finalize` — Finalize a DRAFT invoice
- `POST /admin/invoice-void` — Void a FINAL invoice (within 7 days)

### Client Helpers (`lib/billing-client.ts`)
```typescript
getAdminMembers(): Promise<AdminMember[]>
getAdminMember(userId: string): Promise<AdminMemberDetail>
getAdminAdjustments(params?: AdjustmentsQuery): Promise<Adjustment[]>
finalizeInvoice(id: string): Promise<Invoice>
voidInvoice(id: string): Promise<Invoice>
```

---

## Pages

### `/portal/billing` — Tabbed Container

Tabs: **Overview** | **Members** | **Subscriptions** | **Adjustments** | **Invoices**

#### Overview Tab
- Tenant Balance Overview Card (balance, total spent this month, top consumers)
- Quick Actions: Top Up, Manage Subscriptions, View Invoices
- Recent Adjustments Table (last 20)
- Subscription Summary

#### Members Tab
- Member Billing Table (avatar, name, role, balance, subscriptions, monthly spend)
- View Billing action per row → `/portal/billing/members/:userId`
- Bulk Topup (select multiple → same amount)

#### Subscriptions Tab
- App Hosting: tier card + change plan dropdown + billing mode toggle + custom resource sliders (CPU 100-2000, Memory 128-8192) + effective date notice
- VPN: region selector + status toggle
- WhatsApp: plan selector + quota display + status toggle
- Cancel Subscription with confirmation dialog

#### Adjustments Tab
- Full adjustments table with TanStack: Date, Member, Type (CREDIT/DEBIT), Amount, Description, Admin
- Filters: type, date range, admin, amount range
- Export CSV button
- Add Adjustment button → modal

#### Invoices Tab
- Invoice table: Invoice #, Period, Amount, Status, Actions (View, Finalize, Void)
- Status filter tabs: All / DRAFT / FINAL / VOID
- Period filter

### `/portal/billing/invoices/[id]` — Invoice Detail
- All invoice line items
- Finalize button (if DRAFT)
- Void button (if FINAL, within 7 days)
- Audit log: who finalized/voided and when

---

## Components

```
components/billing/admin/
  adjustment-form.tsx        // Modal: CREDIT/DEBIT, amount, reason
  adjustment-table.tsx       // TanStack table
  member-billing-table.tsx    // TanStack table with actions
  subscription-manager.tsx    // Upgrade/downgrade/cancel UI
  resource-slider.tsx        // CPU/Memory sliders with price estimate
  invoice-actions.tsx        // Finalize/void buttons + confirm dialogs
  audit-log.tsx             // Audit trail display
```

**Reuse existing:** `BalanceCard`, `SubscriptionCard`, `InvoiceStatusBadge`, `InvoiceTable`

---

## Sidebar Update

Update `buildPortalProjects` in `components/app-sidebar.tsx`:
```typescript
{
  name: "Billing",
  url: "/portal/billing",
  icon: <WalletIcon />,
  isActive: startsWithRoute(pathname, "/portal/billing"),
}
```

---

## Validation Checklist

- [ ] `bun run typecheck` — 0 errors
- [ ] `bun run lint` — 0 errors
- [ ] `bun run build` — succeeds
- [ ] Resource sliders enforce min/max (CPU: 100–2000 mCPU, Memory: 128–8192 MB)
- [ ] Subscription changes show "next billing cycle" notice
- [ ] Balance adjustment modal validates amount > 0
- [ ] Invoice finalize disabled if not DRAFT
- [ ] Invoice void disabled after 7 days
- [ ] Audit log records all admin actions
- [ ] Members page shows correct per-member spend
- [ ] Responsive mobile layout

---

## Constraints

- Only admins/owners/super_admin can access
- VPN and WhatsApp pricing: show "Contact us"
- No actual payment gateway — simulated topup only
- Super_admin sees all tenants; admins see only their tenant

---

## Dependencies

- Requires PGREEN-023 API routes
- Requires existing billing components
- Uses portal layout pattern from `app/[lang]/portal/layout.tsx`