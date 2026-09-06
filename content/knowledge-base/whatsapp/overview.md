---
path: /whatsapp
locale: en
title: WhatsApp Overview & Connected Device Management
category: WhatsApp
purpose: Overview of WhatsApp Business Platform capabilities, metrics dashboard, device health, official Meta profile management, and conversation monitoring.
howTo:
  - "Navigate to Console > WhatsApp > Dashboard (/console/whatsapp/dashboard)."
  - "Monitor active device connections, conversation volumes, message delivery metrics, and real-time chat feeds."
  - "Manage verified WhatsApp devices, official business profiles, and daily message limits (/console/whatsapp/devices)."
  - "Explore upgraded modules: Analytics, Visual Bot Workflows, Templates & Ask P Copilot, Interactive Logs, and Pricing Calculator."
notes:
  - "Dashboard statistics reflect real-time active devices and message processing across your organization."
  - "Multi-device support allows connecting multiple phone numbers under one organization."
  - "Official business profiles sync verified display names, logos, websites, and business categories directly from Meta."
---

# WhatsApp Business Platform Overview & Connected Devices

The **WhatsApp Console** serves as the unified control plane for WhatsApp messaging operations, connected devices, AI automation workflows, and conversation analytics across your organization.

![WhatsApp Dashboard](/kb-assets/whatsapp/guides/01-whatsapp-dashboard.png)

---

## 1. Key Metrics & Status Cards

The dashboard presents immediate high-level health indicators:

- **Active Devices (Perangkat Aktif)**: Total connected WhatsApp numbers ready for sending and receiving messages.
- **Total Conversations (Total Percakapan)**: Aggregate number of distinct customer threads handled.
- **Messages Sent (Pesan Terkirim)**: Number of outbound messages successfully dispatched during the current billing period.
- **Device Health (Kesehatan Perangkat)**: Real-time socket connection stability and heartbeat monitoring.

---

## 2. Connected Device Management & Meta Profile Preview

Navigate to **Console** > **WhatsApp** > **Devices** (`/console/whatsapp/devices`) and click on any active device to access the detailed management workspace:

![WhatsApp Connected Device Details](/kb-assets/whatsapp/guides/10-menu-devices-detail.png)

### Key Device Parameters:
1. **Official Meta WhatsApp Profile**: View live synchronized preview of your Meta-verified business profile including avatar photo, display name status (**Approved**), business category, email, and verified websites.
2. **Quota Consumption Gauge**: Real-time counter showing exact message quota utilized vs assigned base quota (e.g. `10.5 / 1,000` with remaining message alerts).
3. **Daily Limit Monitoring**: Current tier sending velocity limit (e.g. `1,000 msgs / day` up to unlimited tier).
4. **Lifecycle & Sync**: Track registration dates and trigger manual profile syncs from Meta Graph API.

---

## 3. Upgraded Feature Modules

Explore our dedicated documentation guides for each upgraded capability:

- [**Visual Canvas & AI Bot Builder**](/docs/whatsapp/workflows): Build multi-step chatbot workflows with input prompts, live catalog HTTP requests, LLM generative replies, and an interactive chat simulator.
- [**Message Templates & "Ask P" AI Copilot**](/docs/whatsapp/templates): Design pre-approved WhatsApp templates with dynamic formatting and pre-screen text using the Ask P AI compliance auditor.
- [**Logs, Webhooks & Message Journey**](/docs/whatsapp/webhooks-and-audits): Investigate delivery receipts with one-click WA Message ID copying and full end-to-end message lifecycle journey visualization.
- [**Pricing, Rates & Transaction Ledger**](/docs/whatsapp/pricing): Simulate monthly expenses with the interactive cost estimator and audit per-message credit deductions in real-time.
