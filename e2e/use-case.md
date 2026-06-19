# User Case Verify : E2E Testing

## Admin Side (Portal)

| # | Feature | Description | Page | Status | Comment |
|---|---------|-------------|------|--------|---------|
| 1 | billing-overview | As admin, I can see platform-wide stats (total balance, active orgs, monthly spend, low-balance orgs) | /portal/billing | - | - |
| 2 | billing-overview | As admin, I can search and browse all orgs with billing accounts | /portal/billing | - | - |
| 3 | billing-overview | As admin, I can click an org to view its billing detail | /portal/billing/org/[orgId] | - | - |
| 4 | org-balance | As admin, I can view an org's current balance and low-balance warnings | /portal/billing/org/[orgId] | - | balance tab |
| 5 | org-topup | As admin, I can credit balance to any org (super_admin only) | /portal/billing/org/[orgId] | - | topup tab |
| 6 | org-invoices | As admin, I can view all invoices for an org | /portal/billing/org/[orgId] | - | invoices tab |
| 7 | org-invoices | As admin, I can issue a DRAFT invoice (DRAFT → ISSUED) | /portal/billing/org/[orgId] | - | invoices tab |
| 8 | org-invoices | As admin, I can cancel a DRAFT or ISSUED invoice | /portal/billing/org/[orgId] | - | invoices tab |
| 9 | org-invoices-detail | As admin, I can view invoice line items grouped by service | /portal/billing/invoices/[id] | - | - |
| 10 | org-usage | As admin, I can view an org's usage breakdown by category and 30-day trend | /portal/billing/org/[orgId] | - | usage tab |
| 11 | org-subscriptions | As admin, I can view and update an org's subscriptions (plan, pricing, status) | /portal/billing/org/[orgId] | - | subscriptions tab |
| 12 | org-adjustments | As admin, I can create CREDIT or DEBIT adjustments for an org | /portal/billing/org/[orgId] | - | adjustments tab |
| 13 | org-adjustments | As admin, I can view adjustment history for an org | /portal/billing/org/[orgId] | - | adjustments tab |
| 14 | org-alerts | As admin, I can configure balance/usage alert thresholds for an org | /portal/billing/org/[orgId] | - | alerts tab |
| 15 | org-contacts | As admin, I can manage billing contacts for an org | /portal/billing/org/[orgId] | - | contacts tab |
| 16 | org-settings | As admin, I can view and manage an org's currency preference | /portal/billing/org/[orgId] | - | settings tab |
| 17 | voucher-list | As admin, I can list all vouchers with status filter and search by prefix | /portal/billing/voucher | - | - |
| 18 | voucher-create | As admin, I can create a new voucher (prefix, maxClaims, expiry, amount, currency, optional targeting to user/org) | /portal/billing/voucher | - | - |
| 19 | voucher-detail | As admin, I can view voucher detail (code, status, amount, claims count, expiry, targeting, created date) | /portal/billing/voucher/[id] | - | - |
| 20 | voucher-disable | As admin, I can disable a voucher to prevent further claims | /portal/billing/voucher/[id] | - | - |
| 21 | voucher-claims | As admin, I can view claim history for a voucher (user, org, date, adjustment) | /portal/billing/voucher/[id] | - | - |
| 22 | all-invoices | As admin, I can list all invoices across all orgs with status filter | /portal/billing | - | invoices feed |
| 23 | platform-usage | As admin, I can view platform-wide usage trend chart | /portal/billing | - | - |
| 24 | admin-adjust | As admin, I can create manual balance adjustments via API (super_admin) | /billing/admin/adjust | - | - |
| 25 | admin-subscriptions | As admin, I can list and update all subscriptions across orgs | /billing/admin/subscriptions | - | - |
| 26 | admin-members | As admin, I can list all members with billing summary | /billing/admin/members | - | - |
| 27 | admin-topup | As admin, I can topup any org's balance (super_admin only) | /billing/admin/topup | - | - |

## User Side (Console)

| # | Feature | Description | Page | Status | Comment |
|---|---------|-------------|------|--------|---------|
| 1 | billing-dashboard | As user, I can see my org's balance, next invoice date, est monthly cost, active subscriptions, recent invoices | /console/billing | - | - |
| 2 | billing-dashboard | As user, I can navigate to sub-pages (topup, invoices, usage, etc.) from dashboard | /console/billing | - | - |
| 3 | topup | As user, I can top up my balance via manual bank transfer, VA, or QRIS | /console/billing/topup | - | - |
| 4 | invoices | As user, I can view my org's invoice list | /console/billing/invoices | - | - |
| 5 | invoice-detail | As user, I can view invoice detail with line items | /console/billing/invoices/[id] | - | - |
| 6 | invoice-pay | As user, I can pay an invoice with balance | /console/billing/invoices/[id] | - | - |
| 7 | invoice-pay | As user, I can top up and pay in one flow | /console/billing/invoices/[id] | - | - |
| 8 | invoice-pay | As user, I can pay via payment gateway redirect (Duitku) | /console/billing/invoices/[id] | - | - |
| 9 | usage | As user, I can view usage summary (total cost, events, services, daily avg) | /console/billing/usage | - | - |
| 10 | usage | As user, I can view cost-by-service breakdown and 30-day bar chart | /console/billing/usage | - | - |
| 11 | usage | As user, I can export usage data as CSV | /console/billing/usage | - | - |
| 12 | transactions | As user, I can view payment history with status filters (ALL/OPEN/PAID/VOID) | /console/billing/transactions | - | - |
| 13 | subscription | As user, I can view my org's subscriptions (App Hosting, VPN, WhatsApp) with plan/status | /console/billing/subscription | - | - |
| 14 | voucher-redeem | As user, I can enter a voucher code and redeem it for billing credit | /console/billing/vouchers | - | - |
| 15 | voucher-history | As user, I can view my redemption history (code, amount, date) | /console/billing/vouchers | - | - |
| 16 | contacts | As user, I can manage billing notification contacts | /console/billing/contacts | - | - |
| 17 | alerts | As user, I can configure balance/usage alert thresholds | /console/billing/alerts | - | - |
| 18 | settings | As user, I can set preferred currency (USD/IDR), locked after invoices exist | /console/billing/settings | - | - |
| 19 | payment-confirm | As user, I can confirm manual bank transfer with date, sender details, screenshot upload | /console/billing/payments/confirm | - | - |
