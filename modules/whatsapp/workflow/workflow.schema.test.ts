import { describe, expect, test } from "bun:test"
import {
  WorkflowNodeTypeSchema,
  ChannelRedirectNodeConfigSchema,
  CsTicketEscalateNodeConfigSchema,
  PaymentLinkDispatchNodeConfigSchema,
  WORKFLOW_NODE_CATALOG,
  WorkflowDefinitionSchema,
} from "./workflow.schema"

describe("Workflow Schema - Node Types & Catalog", () => {
  test("validates all supported node types including offload nodes", () => {
    const expectedTypes = [
      "prompt_input",
      "send_message",
      "send_interactive",
      "http_request",
      "ai_generate",
      "condition",
      "channel_redirect",
      "cs_ticket_escalate",
      "payment_link_dispatch",
    ]

    for (const type of expectedTypes) {
      const parsed = WorkflowNodeTypeSchema.safeParse(type)
      expect(parsed.success).toBe(true)
    }

    expect(WorkflowNodeTypeSchema.safeParse("unknown_node").success).toBe(false)
  })

  test(
    "contains catalog metadata with deprecation notice for prompt_input",
    () => {
    expect(WORKFLOW_NODE_CATALOG.prompt_input.deprecated).toBe(true)
    expect(
      WORKFLOW_NODE_CATALOG.prompt_input.deprecationNotice
    ).toBeDefined()
    expect(
      WORKFLOW_NODE_CATALOG.channel_redirect.badgeText
    ).toBe("Cost-Saving Offload")
    expect(
      WORKFLOW_NODE_CATALOG.cs_ticket_escalate.badgeText
    ).toBe("Human Handover")
    expect(
      WORKFLOW_NODE_CATALOG.payment_link_dispatch.badgeText
    ).toBe("Single Utility")
  })
})

describe("Workflow Schema - ChannelRedirectNodeConfigSchema", () => {
  test("parses valid config and applies defaults", () => {
    const parsed = ChannelRedirectNodeConfigSchema.parse({
      targetChannel: "WEB_LIVECHAT",
      redirectUrl: "https://chat.example.com",
      message: "Silakan lanjut di web",
    })

    expect(parsed.targetChannel).toBe("WEB_LIVECHAT")
    expect(parsed.buttonText).toBe("Lanjutkan di Web")
    expect(parsed.includeContext).toBe(true)
  })

  test("accepts all valid target channels", () => {
    const channels = ["WEB_LIVECHAT", "WEB_FORM", "TELEGRAM"] as const
    for (const targetChannel of channels) {
      const parsed = ChannelRedirectNodeConfigSchema.safeParse({
        targetChannel,
        redirectUrl: "https://example.com",
        message: "Lanjut",
      })
      expect(parsed.success).toBe(true)
    }
  })

  test("rejects invalid target channel and missing fields", () => {
    expect(
      ChannelRedirectNodeConfigSchema.safeParse({
        targetChannel: "DISCORD",
        redirectUrl: "https://example.com",
        message: "Lanjut",
      }).success
    ).toBe(false)

    expect(
      ChannelRedirectNodeConfigSchema.safeParse({
        targetChannel: "WEB_LIVECHAT",
      }).success
    ).toBe(false)
  })
})

describe("Workflow Schema - CsTicketEscalateNodeConfigSchema", () => {
  test("parses valid config and applies default values", () => {
    const parsed = CsTicketEscalateNodeConfigSchema.parse({
      subject: "Kendala",
      description: "Deskripsi",
    })

    expect(parsed.department).toBe("SUPPORT")
    expect(parsed.priority).toBe("HIGH")
    expect(parsed.notifyTelegram).toBe(true)
  })

  test("accepts priority levels", () => {
    const priorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const
    for (const priority of priorities) {
      const parsed = CsTicketEscalateNodeConfigSchema.safeParse({
        priority,
        subject: "Sub",
        description: "Desc",
      })
      expect(parsed.success).toBe(true)
    }
  })

  test("rejects missing subject or description", () => {
    expect(
      CsTicketEscalateNodeConfigSchema.safeParse({
        subject: "Subjek saja",
      }).success
    ).toBe(false)
  })
})

describe("Workflow Schema - PaymentLinkDispatchNodeConfigSchema", () => {
  test("parses valid config with gateway defaults", () => {
    const parsed = PaymentLinkDispatchNodeConfigSchema.parse({
      amountVariable: "total",
      orderIdVariable: "orderId",
      fallbackText: "Silakan bayar",
    })

    expect(parsed.gateway).toBe("MANUAL")
    expect(parsed.buttonTitle).toBe("Bayar Sekarang")
  })

  test("accepts supported gateways", () => {
    const gateways = ["MIDTRANS", "XENDIT", "MANUAL"] as const
    for (const gateway of gateways) {
      const parsed = PaymentLinkDispatchNodeConfigSchema.safeParse({
        gateway,
        amountVariable: "total",
        orderIdVariable: "orderId",
        fallbackText: "Bayar",
      })
      expect(parsed.success).toBe(true)
    }
  })

  test("rejects missing amount or order ID variables", () => {
    expect(
      PaymentLinkDispatchNodeConfigSchema.safeParse({
        amountVariable: "total",
        fallbackText: "Bayar",
      }).success
    ).toBe(false)
  })
})

describe("Workflow Schema - Backward Compatibility", () => {
  test("validates workflows containing legacy prompt_input nodes", () => {
    const legacyWorkflow = {
      id: "wf-legacy",
      organizationId: "org-1",
      name: "Legacy Prompt Workflow",
      trigger: {
        id: "trig-1",
        type: "whatsapp_inbound",
        keywords: [],
      },
      nodes: [
        {
          id: "node-1",
          type: "prompt_input",
          name: "Minta Nama",
          config: {
            question: "Siapa nama Anda?",
            captureVariable: "customer_name",
          },
        },
        {
          id: "node-2",
          type: "send_message",
          name: "Terima Kasih",
          config: {
            text: "Terima kasih, {{variables.customer_name}}!",
          },
        },
      ],
      edges: [
        {
          id: "e-1",
          sourceNodeId: "node-1",
          sourcePort: "default",
          targetNodeId: "node-2",
        },
      ],
    }

    const parsed = WorkflowDefinitionSchema.safeParse(legacyWorkflow)
    expect(parsed.success).toBe(true)
  })

  test("validates workflows containing cost-saving offload nodes", () => {
    const offloadWorkflow = {
      id: "wf-offload",
      organizationId: "org-1",
      name: "Offload Workflow",
      trigger: {
        id: "trig-1",
        type: "keyword_match",
        keywords: ["bantuan", "help"],
      },
      nodes: [
        {
          id: "node-redir",
          type: "channel_redirect",
          name: "Redirect ke Web",
          config: {
            targetChannel: "WEB_LIVECHAT",
            redirectUrl: "https://chat.example.com",
            message: "Lanjut di webchat gratis:",
          },
        },
      ],
      edges: [],
    }

    const parsed = WorkflowDefinitionSchema.safeParse(offloadWorkflow)
    expect(parsed.success).toBe(true)
  })
})
