---
path: /billing/subscriptions
locale: en
title: Service Subscriptions & Recurring Plan Management
category: Billing
purpose: Manage recurring cloud service subscriptions, inspect plan renewal dates and charges, review order metadata, and configure renewal policies.
howTo:
  - "Navigate to Console > Billing > Subscriptions (/console/billing/subscriptions)."
  - "Search and filter subscriptions by product (WhatsApp, App Hosting, VPN) and status (Active, Expired, Cancelled)."
  - "Click on any active subscription to open the detailed lifecycle and renewal workspace."
  - "Review renewal dates, recurring cycle costs, and automated organization balance deduction rules."
  - "Configure subscription lifecycle actions including automatic renewal cancellation."
notes:
  - "Active subscriptions automatically renew on their scheduled date by debiting your organization balance."
  - "Cancelling a subscription's renewal allows the service to remain fully operational until the end of the current paid period."
  - "Each subscription links directly to its parent service console (e.g. WhatsApp Console, VPN Profiles) and initial order invoice."
---

# Service Subscriptions & Recurring Plan Management

The **Subscriptions** console (`/console/billing/subscriptions`) manages all recurring cloud services, volume packages, and platform tiers provisioned for your organization.

![Subscriptions Management Dashboard](/kb-assets/billing/subscriptions/01-subscriptions-list.png)

---

## 1. Subscriptions Overview Table

Navigate to **Console** > **Billing** > **Subscriptions** (`/console/billing/subscriptions`).

The subscriptions table organizes all your recurring services in one view:

- **Product & Plan**: Identifies the service family (e.g. `WHATSAPP`, `VPN`, `APP_HOSTING`) and specific subscribed tier (e.g. `PRIVATE`, `PRIVATESHARE`, `STANDARD`).
- **Status Badges**:
  - `Active`: Service is running normally with automated renewal enabled.
  - `Expiring / Expired`: Subscription term has elapsed or renewal was stopped.
- **Term & Cycle**: Shows whether the service bills on a **Monthly**, **Quarterly**, or **Annual** schedule.
- **Renewal Date**: Upcoming scheduled renewal date or expiration milestone.
- **Invoice Status**: Verification that current billing period charges are fully settled (**PAID**).
- **Next Action**: Highlights required user intervention (e.g. *No action needed* or *Top up required*).

---

## 2. Subscription Details & Renewal Configuration

Click any subscription row to access the dedicated detail and management workspace (`/console/billing/subscriptions/[id]`):

![Subscription Details & Renewal](/kb-assets/billing/subscriptions/02-subscription-detail.png)

### What You Can Inspect & Manage:
1. **Subscription & Renewal Details**:
   - **First Order Date & Cost**: Original activation date and initial invoice charge.
   - **Next Renewal Date**: Scheduled auto-charge date (debited directly from your organization balance).
   - **Renewal Cost**: Exact recurring amount per billing cycle (e.g. `IDR 1,800,000 / quarterly`).
   - **Plan & Cycle**: Active plan specification and billing frequency.
2. **Signup Form Data at Order**:
   - Inspect captured setup metadata such as verified business display names, registered phone numbers, and profile assets.
3. **Quick Navigation Links**:
   - **Go to Product Console**: Jumps directly to the service workspace (e.g. WhatsApp Dashboard).
   - **View Invoice**: Direct link to the official invoice generated for this subscription term.
4. **Lifecycle Management (Cancel Renewal)**:
   - Click **"Cancel Renewal"** to stop automated recurring charges.
   - The service remains **100% operational** until the current renewal date, after which it will safely shut down without penalty.
