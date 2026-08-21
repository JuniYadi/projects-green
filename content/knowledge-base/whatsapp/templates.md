---
path: /whatsapp/templates
title: Message Templates & Meta Approval Workflow
category: WhatsApp
purpose: Create, configure, preview, and synchronize Meta-approved WhatsApp Message Templates.
howTo:
  - "Navigate to Console > WhatsApp > Templates (/console/whatsapp/templates)."
  - "Review synced templates and approval statuses (APPROVED, PENDING, REJECTED)."
  - "Click Create Template to draft headers, body parameters {{1}}, footers, and CTA buttons."
  - "Click Sync Templates to pull the latest approval status from Meta."
notes:
  - "Templates must be approved by Meta before they can be sent as outbound business-initiated messages."
  - "Dynamic parameters ({{1}}, {{2}}) must be substituted with valid values at send time."
---

# Message Templates & Meta Approval Workflow

The **Templates** console (`/console/whatsapp/templates`) enables businesses to draft, submit, and synchronize pre-approved WhatsApp message templates for notifications, marketing, and authentication.

![Templates List](/kb-assets/whatsapp/guides/02-journey1-templates-list.png)

---

## 1. Template Overview & Lifecycle Statuses

WhatsApp requires all business-initiated conversations outside the 24-hour customer service window to use Meta-approved templates.

- **SYNCED / APPROVED**: Template is reviewed, approved by Meta, and ready for outbound messaging.
- **PENDING**: Submitted to Meta and currently undergoing automated/manual review.
- **REJECTED**: Did not meet Meta Business Messaging policies (e.g., incorrect category classification or policy violations).

---

## 2. Creating a Message Template

1. Click **"Create Template"** (or **"Buat Template"**) at the top of the templates table.
2. Complete the template definition modal:
   - **Template Name**: Lowercase alphanumeric identifier without spaces (e.g. `order_delivery_update`).
   - **Category**:
     - `UTILITY`: Transactional updates, order confirmations, account alerts.
     - `MARKETING`: Promotions, product announcements, discount offers.
     - `AUTHENTICATION`: One-time passcodes (OTP) and verification codes.
   - **Language**: Select supported language codes (e.g., Indonesian `id`, English `en_US`).
   - **Header** *(Optional)*: Text title, image attachment, video, or PDF document.
   - **Body**: Main text with dynamic placeholders (e.g., `Hello {{1}}, your order #{{2}} has been shipped!`).
   - **Footer & Buttons** *(Optional)*: Add Quick Reply buttons or Call-to-Action buttons (Website URL or Phone Call).

![Create Template Dialog](/kb-assets/whatsapp/guides/03-journey1-create-template-dialog.png)

3. Click **Submit** to dispatch the template definition to Meta Cloud API for review.

---

## 3. Synchronizing Templates

Click **"Sync Templates"** (**"Sinkronisasi Template"**) to pull real-time template approvals, status changes, and newly registered languages from Meta Cloud into your console.
