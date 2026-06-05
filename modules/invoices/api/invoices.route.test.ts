import { describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import { createInvoicesRoutes } from "@/modules/invoices/api/invoices.route"
import type { InvoiceEmailService } from "@/modules/invoices/email.service"
import {
  InvoiceCancelNotAllowedError,
  InvoiceNotFoundError,
  type InvoiceService,
} from "@/modules/invoices/invoices.service"
import type { InvoiceDetail } from "@/modules/invoices/invoices.types"

const invoiceDetail: InvoiceDetail = {
  id: "inv_1",
  invoiceNumber: "INV-2026-0001",
  issuedAt: "2026-05-02T00:00:00.000Z",
  dueAt: "2026-05-17T00:00:00.000Z",
  totalAmount: 110,
  currency: "USD",
  status: "open",
  subtotalAmount: 100,
  taxAmount: 10,
  discountAmount: 0,
  periodStart: "2026-05-01T00:00:00.000Z",
  periodEnd: "2026-05-31T23:59:59.000Z",
  paidAt: null,
  lineItems: [
    {
      id: "line_1",
      description: "Pro Plan",
      quantity: 1,
      unitPrice: 100,
      amount: 100,
      currency: "USD",
    },
  ],
}

const createService = (): InvoiceService => {
  return {
    listInvoices: mock(async () => [
      {
        id: "inv_1",
        invoiceNumber: "INV-2026-0001",
        issuedAt: "2026-05-02T00:00:00.000Z",
        dueAt: "2026-05-17T00:00:00.000Z",
        totalAmount: 110,
        currency: "USD",
        status: "open" as const,
      },
    ]),
    getInvoiceDetail: mock(async () => invoiceDetail),
    cancelInvoice: mock(
      async () => ({ ...invoiceDetail, status: "canceled" as const })
    ),
    getPaymentMethodOptions: () => [],
  }
}

const createApp = (input: {
  service?: InvoiceService
  emailService?: InvoiceEmailService
  auth?: Partial<{
    user: { id: string; email?: string | null } | null
    organizationId?: string | null
    role?: string | null
    roles?: string[] | null
  }>
  platformRole?: "none" | "super_admin"
  getOrganizationIdByBillingAccount?: (billingAccountId: string) => Promise<string | null>
}) => {
  const service = input.service ?? createService()

  const mockEmailService: InvoiceEmailService = input.emailService ?? {
    sendInvoiceCreated: mock(async () => {}),
    sendPaymentReminder: mock(async () => {}),
    sendInvoicePaid: mock(async () => {}),
    sendInvoiceOverdue: mock(async () => {}),
    sendInvoiceCancelled: mock(async () => {}),
  }

  return new Elysia().use(
    createInvoicesRoutes({
      authenticate: async () => ({
        user: { id: "user_1", email: "owner@example.com" },
        organizationId: "org_1",
        role: "user_owner",
        roles: ["user_owner"],
        ...input.auth,
      }),
      getPlatformRole: async () => input.platformRole ?? "none",
      service,
      emailService: mockEmailService,
      getOrganizationIdByBillingAccount: input.getOrganizationIdByBillingAccount ?? (async () => "org_1"),
    })
  )
}

describe("invoices routes", () => {
  it("returns 401 when request is unauthenticated", async () => {
    const app = createApp({
      auth: {
        user: null,
      },
    })

    const response = await app.handle(new Request("http://localhost/invoices"))
    const payload = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(401)
    expect(payload.ok).toBe(false)
    expect(payload.error).toBe("UNAUTHORIZED")
  })

  it("returns 401 on cancel endpoint when unauthenticated", async () => {
    const app = createApp({
      auth: {
        user: null,
      },
    })

    const response = await app.handle(
      new Request("http://localhost/invoices/inv_1/cancel", { method: "POST" })
    )

    expect(response.status).toBe(401)
  })

  it("returns invoice list for authenticated organization", async () => {
    const service = createService()
    const app = createApp({ service })

    const response = await app.handle(
      new Request(
        "http://localhost/invoices?search=INV&status=open&sortBy=issuedAt&sortDir=desc"
      )
    )
    const payload = (await response.json()) as {
      ok: boolean
      invoices: Array<{ invoiceNumber: string }>
    }

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.invoices[0]?.invoiceNumber).toBe("INV-2026-0001")
    expect(service.listInvoices).toHaveBeenCalledTimes(1)
  })

  it("returns validation envelope for invalid list query", async () => {
    const app = createApp({})
    const response = await app.handle(
      new Request("http://localhost/invoices?sortDir=invalid")
    )
    const payload = (await response.json()) as {
      ok: boolean
      error: string
      fieldErrors?: Record<string, string[]>
    }

    expect(response.status).toBe(422)
    expect(payload.ok).toBe(false)
    expect(payload.error).toBe("VALIDATION_ERROR")
    expect(payload.fieldErrors?.sortDir?.length).toBeGreaterThan(0)
  })

  it("returns not found for missing invoice detail", async () => {
    const service = createService()
    service.getInvoiceDetail = mock(async () => {
      throw new InvoiceNotFoundError("inv_missing")
    })

    const app = createApp({ service })

    const response = await app.handle(
      new Request("http://localhost/invoices/inv_missing")
    )
    const payload = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(404)
    expect(payload.ok).toBe(false)
    expect(payload.error).toBe("NOT_FOUND")
  })

  it("returns 500 when invoice detail fails with generic error", async () => {
    const service = createService()
    service.getInvoiceDetail = mock(async () => {
      throw new Error("database connection lost")
    })

    const app = createApp({ service })

    const response = await app.handle(
      new Request("http://localhost/invoices/inv_1")
    )

    expect(response.status).toBe(500)
  })

  it("returns invoice detail with organization metadata", async () => {
    const app = createApp({})

    const response = await app.handle(
      new Request("http://localhost/invoices/inv_1")
    )
    const payload = (await response.json()) as {
      ok: boolean
      invoice: { id: string; invoiceNumber: string }
      canMarkCanceled: boolean
      organization: Record<string, unknown> | null
    }

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.invoice.invoiceNumber).toBe("INV-2026-0001")
    expect(typeof payload.canMarkCanceled).toBe("boolean")
  })

  it("returns PDF response with content-type", async () => {
    const app = createApp({})

    const response = await app.handle(
      new Request("http://localhost/invoices/inv_1/pdf")
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    const bytes = await response.arrayBuffer()
    expect(bytes.byteLength).toBeGreaterThan(200)
  })

  it("returns 401 on pdf endpoint when unauthenticated", async () => {
    const app = createApp({ auth: { user: null } })

    const response = await app.handle(
      new Request("http://localhost/invoices/inv_1/pdf")
    )

    expect(response.status).toBe(401)
  })

  it("returns 422 on pdf endpoint for invalid invoice id", async () => {
    const app = createApp({})

    const response = await app.handle(
      new Request("http://localhost/invoices/%20/pdf")
    )

    expect(response.status).toBe(422)
  })

  it("returns 404 on pdf endpoint when invoice not found", async () => {
    const service = createService()
    service.getInvoiceDetail = mock(async () => {
      throw new InvoiceNotFoundError("inv_missing")
    })
    const app = createApp({ service })

    const response = await app.handle(
      new Request("http://localhost/invoices/inv_missing/pdf")
    )

    expect(response.status).toBe(404)
  })

  it("returns 500 on pdf endpoint when generic error occurs", async () => {
    const service = createService()
    service.getInvoiceDetail = mock(async () => {
      throw new Error("pdf generation failed")
    })
    const app = createApp({ service })

    const response = await app.handle(
      new Request("http://localhost/invoices/inv_1/pdf")
    )

    expect(response.status).toBe(500)
  })

  it("returns validation envelope for invalid invoice id params", async () => {
    const app = createApp({})
    const response = await app.handle(
      new Request("http://localhost/invoices/%20", {
        method: "GET",
      })
    )
    const payload = (await response.json()) as {
      ok: boolean
      error: string
      fieldErrors?: Record<string, string[]>
    }

    expect(response.status).toBe(422)
    expect(payload.ok).toBe(false)
    expect(payload.error).toBe("VALIDATION_ERROR")
    expect(payload.fieldErrors?.invoiceId?.length).toBeGreaterThan(0)
  })

  it("forbids cancel for non owner/admin and allows for super admin", async () => {
    const memberApp = createApp({
      auth: {
        role: "user_member",
        roles: ["user_member"],
      },
    })

    const memberResponse = await memberApp.handle(
      new Request("http://localhost/invoices/inv_1/cancel", {
        method: "POST",
      })
    )

    expect(memberResponse.status).toBe(403)

    const superAdminApp = createApp({
      auth: {
        role: "user_member",
        roles: ["user_member"],
      },
      platformRole: "super_admin",
    })

    const superAdminResponse = await superAdminApp.handle(
      new Request("http://localhost/invoices/inv_1/cancel", {
        method: "POST",
      })
    )
    const payload = (await superAdminResponse.json()) as {
      ok: boolean
      invoice: { status: string }
    }

    expect(superAdminResponse.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.invoice.status).toBe("canceled")
  })

  it("returns conflict when cancel is not allowed", async () => {
    const service = createService()
    service.cancelInvoice = mock(async () => {
      throw new InvoiceCancelNotAllowedError("inv_1", "paid")
    })
    const app = createApp({ service, platformRole: "super_admin" })

    const response = await app.handle(
      new Request("http://localhost/invoices/inv_1/cancel", {
        method: "POST",
      })
    )
    const payload = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(409)
    expect(payload.ok).toBe(false)
    expect(payload.error).toBe("INVOICE_CANCEL_NOT_ALLOWED")
  })

  it("returns 500 when role resolution fails in cancel flow", async () => {
    const app = new Elysia().use(
      createInvoicesRoutes({
        authenticate: async () => ({
          user: { id: "user_1", email: "owner@example.com" },
          organizationId: "org_1",
          role: "user_owner",
          roles: ["user_owner"],
        }),
        getPlatformRole: async () => {
          throw new Error("role provider unavailable")
        },
        service: createService(),
        emailService: {
          sendInvoiceCreated: mock(async () => {}),
          sendPaymentReminder: mock(async () => {}),
          sendInvoicePaid: mock(async () => {}),
          sendInvoiceOverdue: mock(async () => {}),
          sendInvoiceCancelled: mock(async () => {}),
        },
        getOrganizationIdByBillingAccount: async () => "org_1",
      })
    )

    const response = await app.handle(
      new Request("http://localhost/invoices/inv_1/cancel", {
        method: "POST",
      })
    )
    const payload = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(500)
    expect(payload.ok).toBe(false)
    expect(payload.error).toBe("INTERNAL_SERVER_ERROR")
  })

  it("returns 403 for missing organization", async () => {
    const app = createApp({
      auth: {
        user: { id: "user_1" },
        organizationId: null,
      },
    })

    const response = await app.handle(new Request("http://localhost/invoices"))
    expect(response.status).toBe(403)
  })

  it("returns all invoices for super admin without organization", async () => {
    const service = createService()
    const app = createApp({
      service,
      platformRole: "super_admin",
      auth: { organizationId: null },
    })

    const response = await app.handle(new Request("http://localhost/invoices"))
    expect(response.status).toBe(200)
  })

  it("returns 500 when list invoices fails", async () => {
    const service = createService()
    service.listInvoices = mock(async () => {
      throw new Error("database error")
    })
    const app = createApp({ service })

    const response = await app.handle(new Request("http://localhost/invoices"))
    expect(response.status).toBe(500)
  })

  describe("notify endpoints", () => {
    it("sends invoice created notification", async () => {
      const mockEmailService: InvoiceEmailService = {
        sendInvoiceCreated: mock(async () => {}),
        sendPaymentReminder: mock(async () => {}),
        sendInvoicePaid: mock(async () => {}),
        sendInvoiceOverdue: mock(async () => {}),
        sendInvoiceCancelled: mock(async () => {}),
      }
      const app = createApp({ emailService: mockEmailService })

      const response = await app.handle(
        new Request("http://localhost/invoices/inv_1/notify/created", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ recipientEmail: "test@example.com" }),
        })
      )
      const payload = (await response.json()) as { ok: boolean; message: string }

      expect(response.status).toBe(200)
      expect(payload.ok).toBe(true)
      expect(payload.message).toContain("created notification sent")
      expect(mockEmailService.sendInvoiceCreated).toHaveBeenCalledWith(
        invoiceDetail,
        "test@example.com"
      )
    })

    it("sends invoice paid notification", async () => {
      const mockEmailService: InvoiceEmailService = {
        sendInvoiceCreated: mock(async () => {}),
        sendPaymentReminder: mock(async () => {}),
        sendInvoicePaid: mock(async () => {}),
        sendInvoiceOverdue: mock(async () => {}),
        sendInvoiceCancelled: mock(async () => {}),
      }
      const app = createApp({ emailService: mockEmailService })

      const response = await app.handle(
        new Request("http://localhost/invoices/inv_1/notify/paid", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ recipientEmail: "test@example.com" }),
        })
      )
      const payload = (await response.json()) as { ok: boolean; message: string }

      expect(response.status).toBe(200)
      expect(payload.ok).toBe(true)
      expect(mockEmailService.sendInvoicePaid).toHaveBeenCalled()
    })

    it("sends payment reminder notification", async () => {
      const mockEmailService: InvoiceEmailService = {
        sendInvoiceCreated: mock(async () => {}),
        sendPaymentReminder: mock(async () => {}),
        sendInvoicePaid: mock(async () => {}),
        sendInvoiceOverdue: mock(async () => {}),
        sendInvoiceCancelled: mock(async () => {}),
      }
      const app = createApp({ emailService: mockEmailService })

      const response = await app.handle(
        new Request("http://localhost/invoices/inv_1/notify/reminder", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ recipientEmail: "test@example.com" }),
        })
      )
      const payload = (await response.json()) as { ok: boolean; message: string }

      expect(response.status).toBe(200)
      expect(payload.ok).toBe(true)
      expect(mockEmailService.sendPaymentReminder).toHaveBeenCalled()
    })

    it("sends invoice overdue notification", async () => {
      const mockEmailService: InvoiceEmailService = {
        sendInvoiceCreated: mock(async () => {}),
        sendPaymentReminder: mock(async () => {}),
        sendInvoicePaid: mock(async () => {}),
        sendInvoiceOverdue: mock(async () => {}),
        sendInvoiceCancelled: mock(async () => {}),
      }
      const app = createApp({ emailService: mockEmailService })

      const response = await app.handle(
        new Request("http://localhost/invoices/inv_1/notify/overdue", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ recipientEmail: "test@example.com" }),
        })
      )
      const payload = (await response.json()) as { ok: boolean; message: string }

      expect(response.status).toBe(200)
      expect(payload.ok).toBe(true)
      expect(mockEmailService.sendInvoiceOverdue).toHaveBeenCalled()
    })

    it("sends invoice cancelled notification with reason", async () => {
      const mockEmailService: InvoiceEmailService = {
        sendInvoiceCreated: mock(async () => {}),
        sendPaymentReminder: mock(async () => {}),
        sendInvoicePaid: mock(async () => {}),
        sendInvoiceOverdue: mock(async () => {}),
        sendInvoiceCancelled: mock(async () => {}),
      }
      const app = createApp({ emailService: mockEmailService })

      const response = await app.handle(
        new Request("http://localhost/invoices/inv_1/notify/cancelled", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            recipientEmail: "test@example.com",
            reason: "Customer requested",
          }),
        })
      )
      const payload = (await response.json()) as { ok: boolean; message: string }

      expect(response.status).toBe(200)
      expect(payload.ok).toBe(true)
      expect(mockEmailService.sendInvoiceCancelled).toHaveBeenCalledWith(
        invoiceDetail,
        "test@example.com",
        "Customer requested"
      )
    })

    it("returns 403 for member role on notify endpoints", async () => {
      const app = createApp({
        auth: {
          role: "user_member",
          roles: ["user_member"],
        },
      })

      const response = await app.handle(
        new Request("http://localhost/invoices/inv_1/notify/created", {
          method: "POST",
        })
      )

      expect(response.status).toBe(403)
    })

    it("returns 404 when invoice not found on notify", async () => {
      const service = createService()
      service.getInvoiceDetail = mock(async () => {
        throw new InvoiceNotFoundError("inv_missing")
      })
      const app = createApp({ service })

      const response = await app.handle(
        new Request("http://localhost/invoices/inv_missing/notify/created", {
          method: "POST",
        })
      )

      expect(response.status).toBe(404)
    })

    it("returns 401 on notify endpoints when unauthenticated", async () => {
      const app = createApp({ auth: { user: null } })

      const response = await app.handle(
        new Request("http://localhost/invoices/inv_1/notify/created", {
          method: "POST",
        })
      )

      expect(response.status).toBe(401)
    })

    it("returns 422 when recipient email missing and user has no email", async () => {
      const app = createApp({
        auth: { user: { id: "user_1", email: null } },
      })

      const response = await app.handle(
        new Request("http://localhost/invoices/inv_1/notify/created", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        })
      )

      expect(response.status).toBe(422)
    })

    it("returns 500 on notify when service throws generic error", async () => {
      const service = createService()
      service.getInvoiceDetail = mock(async () => {
        throw new Error("service unavailable")
      })
      const app = createApp({ service })

      const response = await app.handle(
        new Request("http://localhost/invoices/inv_1/notify/created", {
          method: "POST",
        })
      )

      expect(response.status).toBe(500)
    })

    it("cancelled endpoint works without body using default email", async () => {
      const mockEmailService: InvoiceEmailService = {
        sendInvoiceCreated: mock(async () => {}),
        sendPaymentReminder: mock(async () => {}),
        sendInvoicePaid: mock(async () => {}),
        sendInvoiceOverdue: mock(async () => {}),
        sendInvoiceCancelled: mock(async () => {}),
      }
      const app = createApp({ emailService: mockEmailService })

      const response = await app.handle(
        new Request("http://localhost/invoices/inv_1/notify/cancelled", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        })
      )

      expect(response.status).toBe(200)
    })

    it("cancelled endpoint with invalid email returns validation error", async () => {
      const mockEmailService: InvoiceEmailService = {
        sendInvoiceCreated: mock(async () => {}),
        sendPaymentReminder: mock(async () => {}),
        sendInvoicePaid: mock(async () => {}),
        sendInvoiceOverdue: mock(async () => {}),
        sendInvoiceCancelled: mock(async () => {}),
      }
      const app = createApp({ emailService: mockEmailService })

      const response = await app.handle(
        new Request("http://localhost/invoices/inv_1/notify/cancelled", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            recipientEmail: "not-an-email",
            reason: "Test reason",
          }),
        })
      )

      expect(response.status).toBe(422)
    })

    it("returns 403 on notify endpoints when organization is missing", async () => {
      const app = createApp({
        auth: {
          user: { id: "user_1", email: "owner@example.com" },
          organizationId: null,
        },
      })

      const res = await app.handle(
        new Request("http://localhost/invoices/inv_1/notify/created", {
          method: "POST",
        }),
      )

      expect(res.status).toBe(403)
    })
  })

  it("cancel does not send email when user has no email address", async () => {
    const mockEmailService: InvoiceEmailService = {
      sendInvoiceCreated: mock(async () => {}),
      sendPaymentReminder: mock(async () => {}),
      sendInvoicePaid: mock(async () => {}),
      sendInvoiceOverdue: mock(async () => {}),
      sendInvoiceCancelled: mock(async () => {}),
    }
    // Use super_admin platformRole to bypass all permission checks
    const app = createApp({
      auth: {
        user: { id: "user_1", email: null },
      },
      platformRole: "super_admin",
      emailService: mockEmailService,
    })

    const response = await app.handle(
      new Request("http://localhost/invoices/inv_1/cancel", {
        method: "POST",
      }),
    )

    expect(response.status).toBe(200)
    // Email should NOT be sent when user has no email address
    expect(mockEmailService.sendInvoiceCancelled).not.toHaveBeenCalled()
  })

  it("returns invoice detail with null organization when billing account not found", async () => {
    const app = createApp({
      getOrganizationIdByBillingAccount: async () => null,
    })

    const response = await app.handle(
      new Request("http://localhost/invoices/inv_1"),
    )
    const payload = (await response.json()) as {
      ok: boolean
      invoice: { id: string }
      organization: unknown
    }

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.organization).toBeNull()
  })

  it("uses default dependencies when none provided", async () => {
    const app = new Elysia().use(createInvoicesRoutes())

    const response = await app.handle(new Request("http://localhost/invoices"))

    // withAuth() returns unauthenticated or throws in test env
    // Either way we get an error status (401 or 500)
    expect([401, 500]).toContain(response.status)
  })
})
