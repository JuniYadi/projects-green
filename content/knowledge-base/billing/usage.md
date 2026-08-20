---
path: /billing/usage
locale: en
title: Resource Usage Tracking & Cost Analytics Guide
category: Billing
purpose: Monitor resource usage metrics, inspect product-level cost breakdowns, and track daily consumption trends.
howTo:
  - "Navigate to Console > Billing > Usage (/console/billing/usage)."
  - "Select a date range (Last 7 days, Current Month, Current Quarter)."
  - "Inspect consumption trend charts for WhatsApp messages, compute hours, and network egress."
  - "Analyze per-product cost allocations for budget optimization."
notes:
  - Usage data is refreshed near real-time from infrastructure telemetry.
  - Overages beyond included subscription quotas are billed at standard pay-as-you-go rates.
---

This guide explains how to monitor resource consumption and analyze service costs across your organization.

---

## 1. Usage Analytics Overview

The **Usage** page (`/console/billing/usage`) provides granular insights into compute allocation and API invocation metrics.

![Usage & Cost Analytics](/kb-assets/billing/06-billing-usage.png)

### Key Monitored Metrics:
- **WhatsApp Cloud API**: Outbound message counts categorized by template tier (marketing, utility, authentication, service) and active device connections.
- **App Hosting Compute**: Container runtime duration (vCPU-hours), memory allocation (RAM-GB-hours), and outbound network transfer (egress).
- **WireGuard VPN**: Total encrypted throughput and concurrent active client sessions.

---

## 2. Cost Analysis & Budget Optimization

1. **Daily Consumption Trends**: Pinpoint traffic spikes and unusual workload patterns.
2. **Per-Service Cost Allocation**: Understand exact cost drivers across your tech stack.
3. **Quota Planning**: Forecast upcoming monthly spend to optimize plan selections and cost efficiency.
