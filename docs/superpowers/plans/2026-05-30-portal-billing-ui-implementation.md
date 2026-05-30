# Portal Billing UI Implementation Plan

**Goal:** Implement admin-facing billing portal UI (PGREEN-025) with tabbed navigation, member billing tables, subscription management, adjustment tracking, and invoice handling.

**Architecture:** 
- Tabbed page under `/portal/billing` with 5 tabs: Overview, Members, Subscriptions, Adjustments, Invoices
- New admin API routes for members list/detail and adjustments list
- Reuse existing billing components (BalanceCard, SubscriptionCard, InvoiceTable)
- Follow existing Elysia factory pattern for new API routes

**Tech Stack:** Next.js 16, React 19, TypeScript, TanStack Table, Tailwind CSS, shadcn/ui, Phosphor Icons, Prisma

---

## Task 1: API Routes - Members List & Detail

**Files to create/modify:**
- Create: `modules/billing/api/admin/members.route.ts`
- Modify: `modules/billing/api/index.ts`
- Test: `modules/billing/api/admin/members.route.test.ts`

### Steps:
1. Create `members.route.ts` with GET /admin/members and GET /admin/members/:userId handlers
2. Register route in `modules/billing/api/index.ts`
3. Run `bun run typecheck`
4. Write unit tests following `adjust.route.test.ts` pattern
5. Run tests
6. Commit

---

## Task 2: API Routes - Adjustments List

**Files to create/modify:**
- Create: `modules/billing/api/admin/adjustments.route.ts`
- Modify: `modules/billing/api/index.ts`
- Test: `modules/billing/api/admin/adjustments.route.test.ts`

### Steps:
1. Create `adjustments.route.ts` with GET /admin/adjustments handler (with pagination and filtering)
2. Register route in `modules/billing/api/index.ts`
3. Run `bun run typecheck`
4. Write unit tests
5. Run tests
6. Commit

---

## Task 3: Client Helpers - Admin Billing Functions

**Files to modify:**
- Modify: `lib/billing-client.ts`

### Steps:
1. Add AdminMember, AdminMemberDetail, AdminAdjustment, AdjustmentsResponse types
2. Add getAdminMembers(), getAdminMember(userId), getAdminAdjustments(params?) functions
3. Run `bun run typecheck`
4. Commit

---

## Task 4: Sidebar - Add Billing Navigation

**Files to modify:**
- Modify: `components/app-sidebar.tsx`

### Steps:
1. Add Billing nav item to `buildPortalProjects` function
2. Use WalletIcon from Phosphor
3. Set isActive for `/portal/billing` routes
4. Run `bun run typecheck`
5. Commit

---

## Task 5: Components - Adjustment Form Modal

**Files to create:**
- Create: `components/billing/admin/adjustment-form.tsx`

### Steps:
1. Create modal with CREDIT/DEBIT type selector, amount input, reason textarea
2. Use react-hook-form for validation
3. Call POST /api/billing/admin/adjust on submit
4. Show success/error toasts
5. Run `bun run typecheck`
6. Commit

---

## Task 6: Components - Adjustment Table

**Files to create:**
- Create: `components/billing/admin/adjustment-table.tsx`

### Steps:
1. Create TanStack Table with columns: Date, Type (CREDIT/DEBIT with badges), Amount, Description, Admin
2. CREDIT = green badge, DEBIT = red badge
3. Use DataTable component
4. Run `bun run typecheck`
5. Commit

---

## Task 7: Components - Member Billing Table

**Files to create:**
- Create: `components/billing/admin/member-billing-table.tsx`

### Steps:
1. Create TanStack Table with columns: Member (avatar+name+email), Role, Subscriptions count, Monthly Spend, Actions
2. Actions: "View Billing" button linking to `/portal/billing/members/:userId`
3. Use DataTable component
4. Run `bun run typecheck`
5. Commit

---

## Task 8: Components - Resource Slider

**Files to create:**
- Create: `components/billing/admin/resource-slider.tsx`

### Steps:
1. Create slider for CPU (100-2000 mCPU) and Memory (128-8192 MB)
2. Snap to step values (CPU: 100, Memory: 128)
3. Show current value and price estimate
4. Run `bun run typecheck`
5. Commit

---

## Task 9: Components - Invoice Actions

**Files to create:**
- Create: `components/billing/admin/invoice-actions.tsx`

### Steps:
1. Create Finalize button (only for DRAFT status)
2. Create Void button with confirmation dialog (only for FINAL, within 7 days)
3. Call POST /api/billing/admin/invoice-finalize and invoice-void
4. Show success/error toasts
5. Run `bun run typecheck`
6. Commit

---

## Task 10: Components - Subscription Manager

**Files to create:**
- Create: `components/billing/admin/subscription-manager.tsx`

### Steps:
1. Create cards for App Hosting, VPN, WhatsApp subscriptions
2. App Hosting: plan dropdown, billing mode toggle, resource sliders for CUSTOM/PAYG
3. VPN/WhatsApp: show "Contact us for pricing"
4. Effective date notice: "Changes take effect next billing cycle"
5. Call PATCH /api/billing/admin/subscriptions/:id on update
6. Run `bun run typecheck`
7. Commit

---

## Task 11: Page - Portal Billing (Tabbed)

**Files to create:**
- Create: `app/[lang]/portal/billing/page.tsx`
- Create: `app/[lang]/portal/billing/billing-tabs.tsx`
- Create: `app/[lang]/portal/billing/tabs/overview-tab.tsx`
- Create: `app/[lang]/portal/billing/tabs/members-tab.tsx`
- Create: `app/[lang]/portal/billing/tabs/subscriptions-tab.tsx`
- Create: `app/[lang]/portal/billing/tabs/adjustments-tab.tsx`
- Create: `app/[lang]/portal/billing/tabs/invoices-tab.tsx`

### Steps:
1. Create page with redirect to overview tab
2. Create BillingTabs client component with Tabs
3. Create Overview tab with BalanceCard, quick actions, recent adjustments
4. Create Members tab with MemberBillingTable
5. Create Subscriptions tab with SubscriptionManager
6. Create Adjustments tab with AdjustmentTable and AdjustmentForm
7. Create Invoices tab with DataTable showing invoices
8. Run `bun run typecheck`
9. Run `bun run lint`
10. Commit

---

## Task 12: Page - Invoice Detail

**Files to create:**
- Create: `app/[lang]/portal/billing/invoices/[id]/page.tsx`

### Steps:
1. Create invoice detail page with line items table
2. Show InvoiceActions component for finalize/void
3. Show status, amount, due date cards
4. Run `bun run typecheck`
5. Run `bun run build`
6. Commit

---

## Task 13: Final Validation

### Steps:
1. Run `bun run typecheck` - 0 errors
2. Run `bun run lint` - 0 errors
3. Run `bun run test` - all pass
4. Run `bun run build` - succeeds
5. Create PR