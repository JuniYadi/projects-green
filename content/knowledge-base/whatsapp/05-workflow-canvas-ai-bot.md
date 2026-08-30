---
path: /whatsapp/workflows
locale: en
title: "Visual Canvas & WhatsApp AI Bot Workflow Guide"
category: WhatsApp
purpose: Comprehensive guide for designing, testing, and publishing automated chatbot workflows, AI Copilot fallbacks, and conversation webhook routing on WhatsApp.
howTo:
  - "Create and manage visual bot flows using the Visual Canvas & AI Bot Builder."
  - "Connect Trigger Nodes, Prompt Inputs, Logic Branching, HTTP Requests, and AI Generative Nodes."
  - "Bind active WhatsApp phone numbers to AI Agent profiles or automated flows."
  - "Configure human agent escalation and fallback routing."
notes:
  - "Automated bot flows operate within customer-initiated 24-hour conversation session windows."
  - "HTTP Request Nodes support Bearer auth, custom API Keys, and dynamic JSON variable extraction."
  - "AI Generative Nodes utilize enterprise LLMs with guardrails and forensic security auditing."
---

# Visual Canvas & WhatsApp AI Bot Workflow Guide

The **AI & Bot Builder** (`/console/whatsapp/workflows`) empowers businesses to visually design conversational chatbots, auto-triage ticketing, interactive FAQ menus, and intelligent routing without authoring complex backend infrastructure.

---

## 1. Quickstart: Open the Visual Canvas

1. Navigate to **Console** > **WhatsApp** > **AI & Bot Builder** (`/console/whatsapp/workflows`).
2. Click **"+ Create New Canvas Flow"** or **"✦ Open Visual Canvas & AI Copilot"**.
3. Provide a clear flow name (e.g. `Customer Support Triage` or `Lead Qualification Bot`).

---

## 2. Available Flow Nodes

The Visual Canvas provides 6 modular node types:

| Node Type | Purpose | Common Example |
| :--- | :--- | :--- |
| **Trigger Node** | Entry point activated on incoming message | Keyword match (e.g. `menu`, `help`, `support`, `order`) |
| **Send Message Node** | Dispatches text, rich media, or interactive buttons | Presenting interactive menu buttons or greetings |
| **Prompt Input Node** | Pauses and captures user text response | Asking for invoice number, email address, or feedback |
| **Condition Node** | Evaluates variables for branching logic | If `input === "1"` route to Sales, if `"2"` route to Support |
| **HTTP Request Node** | Invokes external REST APIs in real-time | Tracking order shipment numbers or creating CRM tickets |
| **AI Generate Node** | Generates dynamic answers using AI Copilot | Answering product inquiries from company knowledge documents |

---

## 3. Binding a WhatsApp Number to an AI Agent

To enable automated AI Copilot responses on your active phone number:
1. Go to **Console** > **WhatsApp** > **Devices** (`/console/whatsapp/devices`).
2. Select your target WhatsApp device and open the **AI Agent Binding** tab.
3. Choose the desired AI Agent Profile created in AI Studio.
4. Save bindings. Incoming customer queries will now seamlessly utilize your AI knowledge base.

---

## 4. Testing & Publishing

- Use the **Test Simulator** drawer in the canvas top bar to simulate user conversations in real-time.
- Click **Publish Version** to roll out the flow to live customer conversations.
