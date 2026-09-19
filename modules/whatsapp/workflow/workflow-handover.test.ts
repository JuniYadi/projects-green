import { beforeEach, describe, expect, mock, test } from "bun:test"
import { SupportTicketDepartment, SupportTicketPriority } from "@prisma/client"

const mockSendMessage = mock(async () => ({ jobId: "job-1" }))
const mockTicketCreate = mock(async (args: unknown) => {
  const data = (args as { data: Record<string, unknown> }).data
  return {
    id: "ticket-123",
    ticketNumber: data.ticketNumber as string,
    organizationId: data.organizationId as string,
    department: data.department as SupportTicketDepartment,
    priority: data.priority as SupportTicketPriority,
    status: data.status as string,
    subject: data.subject as string,
    description: data.description as string,
  }
})

mock.module("@/lib/prisma", () => ({
  prisma: {
    supportTicket: {
      create: mockTicketCreate,
    },
  },
}))

mock.module("@/modules/whatsapp/messages/messages.service", () => ({
  messageService: {
    sendMessage: mockSendMessage,
  },
}))

const {
  executeChannelRedirectNode,
  executeCsTicketEscalateNode,
  executePaymentLinkDispatchNode,
  dispatchTelegramNotification,
  executeWorkflowNode,
} = await import("./workflow-executor")

const makeContext = (
  node: { type: string; id: string; name: string; config: unknown },
  overrides: Record<string, unknown> = {}
) => ({
  organizationId: "org-test-1",
  deviceId: "dev-test-1",
  phoneNumber: "+628123456789",
  node: node as never,
  templateContext: {
    variables: {},
    steps: {},
    session: {
      sessionId: "sess-abc-123",
      phone_number: "+628123456789",
    },
  },
  ...overrides,
})

describe("Workflow Handover - Channel Redirect Node", () => {
  beforeEach(() => {
    mockSendMessage.mockClear()
    mockTicketCreate.mockClear()
  })

  test(
    "executes channel_redirect, appends query params, dispatches CTA button",
    async () => {
    const context = makeContext({
      type: "channel_redirect",
      id: "node_redirect_1",
      name: "Redirect ke Web",
      config: {
        targetChannel: "WEB_LIVECHAT",
        redirectUrl: "https://chat.example.com/live",
        message: "Silakan lanjutkan ke livechat kami di tautan berikut:",
        buttonText: "Buka LiveChat",
        includeContext: true,
      },
    })

    const result = await executeChannelRedirectNode(context)

    expect(result.status).toBe("COMPLETED")
    expect(result.outputPort).toBe("default")
    expect(result.stepOutput?.offloaded).toBe(true)
    expect(result.stepOutput?.terminateWorkflow).toBe(true)
    expect(result.stepOutput?.targetChannel).toBe("WEB_LIVECHAT")

    const expectedUrl =
      "https://chat.example.com/live?phone=%2B628123456789" +
      "&sessionId=sess-abc-123&orgId=org-test-1"
    expect(result.stepOutput?.redirectUrl).toBe(expectedUrl)

    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    expect(mockSendMessage).toHaveBeenCalledWith({
      organizationId: "org-test-1",
      phoneNumber: "+628123456789",
      deviceId: "dev-test-1",
      type: "interactive",
      interactivePayload: {
        type: "button",
        body: {
          text: "Silakan lanjutkan ke livechat kami di tautan berikut:",
        },
        action: {
          buttons: [
            {
              type: "cta_url",
              cta_url: {
                display_text: "Buka LiveChat",
                url: expectedUrl,
              },
            },
          ],
        },
      },
    })
  })

  test(
    "appends query params with ampersand if URL already contains query",
    async () => {
    const context = makeContext({
      type: "channel_redirect",
      id: "node_redirect_2",
      name: "Redirect Form",
      config: {
        targetChannel: "WEB_FORM",
        redirectUrl: "https://forms.example.com/survey?ref=promo",
        message: "Isi form lengkap kami:",
        buttonText: "Isi Form",
        includeContext: true,
      },
    })

    const result = await executeWorkflowNode(context)
    expect(result.status).toBe("COMPLETED")
    expect(result.stepOutput?.redirectUrl).toContain("ref=promo")
    expect(result.stepOutput?.redirectUrl).toContain("phone=%2B628123456789")
  })

  test(
    "does not append query params when includeContext is false",
    async () => {
    const context = makeContext({
      type: "channel_redirect",
      id: "node_redirect_3",
      name: "Telegram Handover",
      config: {
        targetChannel: "TELEGRAM",
        redirectUrl: "https://t.me/CustomerCareBot",
        message: "Hubungi bot telegram kami:",
        buttonText: "Buka Telegram",
        includeContext: false,
      },
    })

    const result = await executeChannelRedirectNode(context)
    expect(result.status).toBe("COMPLETED")
    expect(result.stepOutput?.redirectUrl).toBe("https://t.me/CustomerCareBot")
  })

  test("fails gracefully on invalid config", async () => {
    const context = makeContext({
      type: "channel_redirect",
      id: "node_invalid",
      name: "Invalid Node",
      config: {
        targetChannel: "INVALID_CHANNEL",
      },
    })

    const result = await executeChannelRedirectNode(context)
    expect(result.status).toBe("FAILED")
    expect(result.outputPort).toBe("error")
  })
})

describe("Workflow Handover - CS Ticket Escalate Node", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    mockSendMessage.mockClear()
    mockTicketCreate.mockClear()
  })

  test(
    "creates SupportTicket, emits Telegram alert, and sends auto-reply",
    async () => {
      const fetchMock = mock(
        async () => new Response(JSON.stringify({ ok: true }))
      )
      globalThis.fetch = fetchMock as never

      const context = makeContext(
        {
          type: "cs_ticket_escalate",
          id: "node_escalate_1",
          name: "Eskalasi CS",
          config: {
            department: "SUPPORT",
            priority: "HIGH",
            subject: "Kendala Transaksi {{variables.order_id}}",
            description:
              "Customer {{variables.customer_name}} mengalami kendala.",
          notifyTelegram: true,
          telegramChatId: "-100123456789",
          autoReplyMessage:
            "Halo, tiket #{{variables.ticketNumber}} berhasil dibuat!",
        },
      },
      {
        templateContext: {
          variables: {
            order_id: "ORD-999",
            customer_name: "Budi Santoso",
          },
          steps: {},
          session: {
            sessionId: "sess-1",
            phone_number: "+628123456789",
          },
        },
      }
    )

    const result = await executeCsTicketEscalateNode(context)

    expect(result.status).toBe("COMPLETED")
    expect(result.outputPort).toBe("default")
    expect(result.capturedVariable?.name).toBe("ticketNumber")
    expect(result.capturedVariable?.value).toMatch(/^TCK-/)

    expect(mockTicketCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-test-1",
          department: SupportTicketDepartment.TECHNICAL,
          priority: SupportTicketPriority.HIGH,
          status: "OPEN",
          subject: "Kendala Transaksi ORD-999",
          description: "Customer Budi Santoso mengalami kendala.",
        }),
      })
    )

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("https://api.telegram.org/bot"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("-100123456789"),
      })
    )

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: "+628123456789",
        message: expect.stringContaining("berhasil dibuat!"),
      })
    )

    globalThis.fetch = originalFetch
  })

  test("maps departments and priorities accurately", async () => {
    const context = makeContext({
      type: "cs_ticket_escalate",
      id: "node_escalate_prio",
      name: "Eskalasi Billing",
      config: {
        department: "BILLING",
        priority: "NORMAL",
        subject: "Tagihan Belum Masuk",
        description: "Rincian billing",
        notifyTelegram: false,
      },
    })

    const result = await executeWorkflowNode(context)
    expect(result.status).toBe("COMPLETED")
    expect(result.stepOutput?.telegramNotified).toBe(false)
    expect(mockTicketCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          department: SupportTicketDepartment.BILLING,
          priority: SupportTicketPriority.MEDIUM,
        }),
      })
    )
  })

  test(
    "dispatchTelegramNotification blocks internal SSRF IP addresses",
    async () => {
      const ssrfResult = await dispatchTelegramNotification({
        chatId: "123",
        text: "Alert",
        webhookUrl: "https://127.0.0.1/webhook",
      })

      expect(ssrfResult.sent).toBe(false)
      expect(ssrfResult.reason).toContain(
        "Targeting private internal IP blocked"
      )

      const ssrf172 = await dispatchTelegramNotification({
        chatId: "123",
        text: "Alert",
        webhookUrl: "https://172.20.0.1/webhook",
      })
      expect(ssrf172.sent).toBe(false)
      expect(ssrf172.reason).toContain(
        "Targeting private internal IP blocked"
      )
    }
  )

  test("explicitly maps SUPPORT department and URGENT priority", async () => {
    const context = makeContext({
      type: "cs_ticket_escalate",
      id: "node_urgent_support",
      name: "Eskalasi Urgent",
      config: {
        department: "SUPPORT",
        priority: "URGENT",
        subject: "Kendala Server",
        description: "Darurat",
        notifyTelegram: false,
      },
    })

    const result = await executeWorkflowNode(context)
    expect(result.status).toBe("COMPLETED")
    expect(mockTicketCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          department: SupportTicketDepartment.TECHNICAL,
          priority: SupportTicketPriority.HIGH,
        }),
      })
    )
  })
})

describe("Workflow Handover - Payment Link Dispatch Node", () => {
  beforeEach(() => {
    mockSendMessage.mockClear()
  })

  test(
    "interpolates variables, generates gateway URL, and dispatches CTA",
    async () => {
    const context = makeContext(
      {
        type: "payment_link_dispatch",
        id: "node_pay_midtrans",
        name: "Bayar Midtrans",
        config: {
          gateway: "MIDTRANS",
          amountVariable: "total_bill",
          orderIdVariable: "invoice_number",
          buttonTitle: "Bayar Sekarang",
          fallbackText:
            "Tagihan Rp {{variables.total_bill}} untuk order " +
            "{{variables.invoice_number}}.",
        },
      },
      {
        templateContext: {
          variables: {
            total_bill: "250000",
            invoice_number: "INV-2026-001",
          },
          steps: {},
          session: {},
        },
      }
    )

    const result = await executePaymentLinkDispatchNode(context)

    expect(result.status).toBe("COMPLETED")
    expect(result.outputPort).toBe("default")
    expect(result.capturedVariable?.value).toBe(
      "https://app.midtrans.com/snap/v2/vtweb/INV-2026-001"
    )
    expect(result.stepOutput).toEqual({
      gateway: "MIDTRANS",
      orderId: "INV-2026-001",
      amount: "250000",
      paymentUrl: "https://app.midtrans.com/snap/v2/vtweb/INV-2026-001",
    })

    expect(mockSendMessage).toHaveBeenCalledWith({
      organizationId: "org-test-1",
      phoneNumber: "+628123456789",
      deviceId: "dev-test-1",
      type: "interactive",
      interactivePayload: {
        type: "button",
        body: {
          text: "Tagihan Rp 250000 untuk order INV-2026-001.",
        },
        action: {
          buttons: [
            {
              type: "cta_url",
              cta_url: {
                display_text: "Bayar Sekarang",
                url: "https://app.midtrans.com/snap/v2/vtweb/INV-2026-001",
              },
            },
          ],
        },
      },
    })
  })

  test("supports custom paymentUrl with template interpolation", async () => {
    const context = makeContext(
      {
        type: "payment_link_dispatch",
        id: "node_pay_custom",
        name: "Custom Gateway",
        config: {
          gateway: "MANUAL",
          amountVariable: "amt",
          orderIdVariable: "ord",
          paymentUrl: "https://checkout.myshop.com/pay/{{variables.ord}}",
          buttonTitle: "Checkout Sekarang",
          fallbackText: "Silakan bayar pesanan Anda.",
        },
      },
      {
        templateContext: {
          variables: { amt: "100000", ord: "ORD-XYZ" },
          steps: {},
          session: {},
        },
      }
    )

    const result = await executeWorkflowNode(context)
    expect(result.status).toBe("COMPLETED")
    expect(result.capturedVariable?.value).toBe(
      "https://checkout.myshop.com/pay/ORD-XYZ"
    )
  })

  test(
    "generates Xendit URL when gateway is XENDIT and paymentUrl is omitted",
    async () => {
    const context = makeContext(
      {
        type: "payment_link_dispatch",
        id: "node_pay_xendit",
        name: "Xendit Link",
        config: {
          gateway: "XENDIT",
          amountVariable: "amt",
          orderIdVariable: "ord",
          fallbackText: "Bayar via Xendit",
        },
      },
      {
        templateContext: {
          variables: { amt: "50000", ord: "XEN-123" },
          steps: {},
          session: {},
        },
      }
    )

    const result = await executePaymentLinkDispatchNode(context)
    expect(result.status).toBe("COMPLETED")
    expect(result.capturedVariable?.value).toBe(
      "https://checkout.xendit.co/web/XEN-123"
    )
  })
})
