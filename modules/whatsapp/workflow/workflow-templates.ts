import type { WorkflowDefinition } from "./workflow.schema"

export type WorkflowTemplateItem = {
  id: string
  titleKey: string
  descKey: string
  category: "support" | "sales" | "utility"
  workflow: WorkflowDefinition
}

export const WORKFLOW_TEMPLATES: WorkflowTemplateItem[] = [
  {
    id: "template_customer_support",
    titleKey: "customerSupportTitle",
    descKey: "customerSupportDesc",
    category: "support",
    workflow: {
      id: "wf_tpl_support",
      organizationId: "",
      name: "Customer Support AI Assistant",
      description:
        "Auto-answer inquiries, collect ticket info, and triage issues",
      isActive: true,
      isDefault: false,
      trigger: {
        id: "trig_support",
        type: "keyword_match",
        keywords: ["help", "bantuan", "support", "halo", "tanya"],
      },
      nodes: [
        {
          id: "node_start",
          name: "Welcome Greeting",
          type: "send_message",
          config: {
            text:
              "Hello! Welcome to Customer Support. " +
              "How can we assist you today?",
          },
          position: { x: 250, y: 50 },
        },
        {
          id: "node_ask_issue",
          name: "Ask Issue Details",
          type: "prompt_input",
          config: {
            question: "Please describe your issue or inquiry in detail:",
            captureVariable: "customer_issue",
            validation: { type: "text" },
          },
          position: { x: 250, y: 220 },
        },
        {
          id: "node_ai_solution",
          name: "AI Solution Resolver",
          type: "ai_generate",
          config: {
            prompt:
              "User issue: {{variables.customer_issue}}. " +
              "Provide a friendly, concise solution.",
            systemPrompt: "You are a professional customer support agent.",
            captureVariable: "ai_solution",
          },
          position: { x: 250, y: 400 },
        },
      ],
      edges: [
        {
          id: "e_start_to_issue",
          sourceNodeId: "node_start",
          targetNodeId: "node_ask_issue",
          sourcePort: "default",
        },
        {
          id: "e_issue_to_ai",
          sourceNodeId: "node_ask_issue",
          targetNodeId: "node_ai_solution",
          sourcePort: "default",
        },
      ],
      version: 1,
    },
  },
  {
    id: "template_ai_sales_catalog",
    titleKey: "leadGenTitle",
    descKey: "leadGenDesc",
    category: "sales",
    workflow: {
      id: "wf_tpl_sales_catalog",
      organizationId: "",
      name: "AI Sales & Pricing Consultant (Live API)",
      description:
        "Fetch live catalog via HTTP API, analyze customer inquiry, and auto-recommend packages",
      isActive: true,
      isDefault: true,
      trigger: {
        id: "trig_sales",
        type: "whatsapp_inbound",
        keywords: [],
      },
      nodes: [
        {
          id: "node_greet",
          name: "Salam & Tanya Kebutuhan",
          type: "prompt_input",
          config: {
            question:
              "Halo! Selamat datang di Layanan Konsultasi PFNApp.\n\nBoleh tahu produk atau paket apa yang sedang Anda cari untuk bisnis Anda?",
            captureVariable: "customer_inquiry",
            validation: { type: "text" },
          },
          position: { x: 250, y: 50 },
        },
        {
          id: "node_fetch_pricing",
          name: "Ambil Katalog Harga (HTTP API)",
          type: "http_request",
          config: {
            url: "https://pfnapp.my.id/api/demo/whatsapp/pricing",
            method: "GET",
            timeoutMs: 5000,
          },
          position: { x: 250, y: 240 },
        },
        {
          id: "node_ai_sales_recommend",
          name: "AI Sales Recommendation",
          type: "ai_generate",
          config: {
            prompt:
              "Customer inquiry: {{variables.customer_inquiry}}.\n\nKatalog Harga Resmi:\n{{steps.node_fetch_pricing.body}}\n\nTugas Anda: Berikan rekomendasi paket yang paling cocok berdasarkan kebutuhan customer di atas secara ringkas, profesional, dan cantumkan harganya.",
            systemPrompt:
              "Anda adalah Konsultan Sales AI ramah dan persuasif dari PFNApp.",
            captureVariable: "ai_sales_recommendation",
            sendReply: true,
          },
          position: { x: 250, y: 440 },
        },
      ],
      edges: [
        {
          id: "e_greet_to_pricing",
          sourceNodeId: "node_greet",
          targetNodeId: "node_fetch_pricing",
          sourcePort: "default",
        },
        {
          id: "e_pricing_to_ai",
          sourceNodeId: "node_fetch_pricing",
          targetNodeId: "node_ai_sales_recommend",
          sourcePort: "success",
        },
      ],
      version: 1,
    },
  },
  {
    id: "template_order_tracking",
    titleKey: "orderTrackingTitle",
    descKey: "orderTrackingDesc",
    category: "utility",
    workflow: {
      id: "wf_tpl_order",
      organizationId: "",
      name: "Order Tracking & Status Bot",
      description: "Check parcel delivery and tracking numbers instantly",
      isActive: true,
      isDefault: false,
      trigger: {
        id: "trig_order",
        type: "keyword_match",
        keywords: ["resi", "lacak", "track", "order", "status"],
      },
      nodes: [
        {
          id: "node_ask_resi",
          name: "Prompt Tracking Number",
          type: "prompt_input",
          config: {
            question: "Please enter your Order / Tracking Number:",
            captureVariable: "tracking_number",
            validation: { type: "text" },
          },
          position: { x: 250, y: 50 },
        },
        {
          id: "node_send_status",
          name: "Send Tracking Status",
          type: "send_message",
          config: {
            text:
              "📦 Status for Order *{{variables.tracking_number}}*" +
              ":\n*Status:* In Transit (Out for Delivery)\n" +
              "Thank you for shopping with us! 🙏",
          },
          position: { x: 250, y: 240 },
        },
      ],
      edges: [
        {
          id: "e_resi_to_status",
          sourceNodeId: "node_ask_resi",
          targetNodeId: "node_send_status",
          sourcePort: "default",
        },
      ],
      version: 1,
    },
  },
  {
    id: "template_lead_qualification",
    titleKey: "leadGenTitle",
    descKey: "leadGenDesc",
    category: "sales",
    workflow: {
      id: "wf_tpl_lead",
      organizationId: "",
      name: "Lead Qualification & Sales Triage",
      description:
        "Qualify inbound leads with interactive buttons " +
        "before booking demo",
      isActive: true,
      isDefault: false,
      trigger: {
        id: "trig_lead",
        type: "keyword_match",
        keywords: ["price", "harga", "sales", "demo", "info"],
      },
      nodes: [
        {
          id: "node_greet_sales",
          name: "Sales Welcome",
          type: "send_message",
          config: {
            text:
              "Welcome to our Sales Center! " +
              "Let's find the best solution for your business.",
          },
          position: { x: 250, y: 50 },
        },
        {
          id: "node_ask_budget",
          name: "Ask Budget Range",
          type: "send_interactive",
          config: {
            bodyText: "What is your monthly messaging volume " + "expectation?",
            interactiveType: "button",
            buttons: [
              { id: "tier_starter", title: "< 10k messages" },
              {
                id: "tier_growth",
                title: "10k - 50k messages",
              },
              {
                id: "tier_enterprise",
                title: "> 50k messages",
              },
            ],
          },
          position: { x: 250, y: 220 },
        },
      ],
      edges: [
        {
          id: "e_greet_to_budget",
          sourceNodeId: "node_greet_sales",
          targetNodeId: "node_ask_budget",
          sourcePort: "default",
        },
      ],
      version: 1,
    },
  },
]
