import { describe, it, expect, mock, beforeEach, spyOn } from "bun:test"
import { Elysia } from "elysia"

import { ConfirmationService } from "../services/confirmation.service"
import { PaymentService } from "../services/payment.service"

// ── Mock auth & platform-role ──────────────────────────

let mockAuthValue: {
  user: { id: string; email: string } | null
} = {
  user: null,
}
let mockPlatformRoleValue: "super_admin" | "none" = "none"

const mockWithAuth = mock(async () => mockAuthValue)
const mockGetPlatformRoleForUser = mock(async () => mockPlatformRoleValue)

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: mockGetPlatformRoleForUser,
}))

// ── Mock prisma ─────────────────────────────────────────

process.env.ENCRYPTION_KEY =
  "0000000000000000000000000000000000000000000000000000000000000000"

const mockPaymentConfirmationFindMany = mock()
const mockPrisma = {
  paymentConfirmation: {
    findMany: mockPaymentConfirmationFindMany,
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

// ── Import route after mocks ────────────────────────────

const { createAdminConfirmationRoutes } =
  await import("./admin-confirmation.route")

function app() {
  return new Elysia().use(createAdminConfirmationRoutes()).compile()
}

const sampleConfirmation = {
  id: "conf-1",
  amount: 50000,
  currency: "IDR",
  bankAccountId: "ba-1",
  bankAccount: {
    bankName: "BCA",
    accountName: "encrypted-name",
    accountNumber: "encrypted-num",
    currency: "IDR",
  },
  invoice: { currency: "IDR", invoiceNumber: "INV-001", totalAmount: 50000 },
  invoiceId: "inv-1",
  status: "PENDING",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  notes: null,
}

// ── Tests ───────────────────────────────────────────────

describe("AdminConfirmationRoute GET /", () => {
  beforeEach(() => {
    mockAuthValue = { user: null }
    mockPlatformRoleValue = "none"
    mockPaymentConfirmationFindMany.mockClear()
  })

  it("returns 401 when user is not authenticated", async () => {
    mockAuthValue = { user: null }
    const res = await app()
      .handle(new Request("http://localhost/confirmations"))
      .then((r) => r.json())

    expect(res.ok).toBe(false)
    expect(res.error).toBe("UNAUTHORIZED")
  })

  it("returns 403 when user is not super_admin", async () => {
    mockAuthValue = { user: { id: "user-1", email: "user@test.com" } }
    mockPlatformRoleValue = "none"
    const res = await app()
      .handle(new Request("http://localhost/confirmations"))
      .then((r) => r.json())

    expect(res.ok).toBe(false)
    expect(res.error).toBe("FORBIDDEN")
  })

  it("returns confirmation array when authorized with query params", async () => {
    mockAuthValue = { user: { id: "admin-1", email: "admin@test.com" } }
    mockPlatformRoleValue = "super_admin"

    const listSpy = spyOn(
      ConfirmationService.prototype,
      "listPending"
    ).mockResolvedValueOnce([sampleConfirmation as never])

    const res = await app()
      .handle(new Request("http://localhost/confirmations?limit=10&offset=5"))
      .then((r) => r.json())

    expect(listSpy).toHaveBeenCalledWith(10, 5)
    expect(Array.isArray(res)).toBe(true)
    expect(res).toHaveLength(1)
    expect(res[0].id).toBe("conf-1")
    expect(res[0].amount).toBe(50000)
    expect(res[0].currency).toBe("IDR")
  })
})

describe("AdminConfirmationRoute GET /:id", () => {
  beforeEach(() => {
    mockAuthValue = { user: null }
    mockPlatformRoleValue = "none"
  })

  it("returns 401 when unauthenticated", async () => {
    const res = await app()
      .handle(new Request("http://localhost/confirmations/conf-1"))
      .then((r) => r.json())

    expect(res.ok).toBe(false)
    expect(res.error).toBe("UNAUTHORIZED")
  })

  it("returns 404 when confirmation is not found", async () => {
    mockAuthValue = { user: { id: "admin-1", email: "admin@test.com" } }
    mockPlatformRoleValue = "super_admin"

    spyOn(ConfirmationService.prototype, "findById").mockResolvedValueOnce(null)

    const res = await app()
      .handle(new Request("http://localhost/confirmations/conf-missing"))
      .then((r) => r.json())

    expect(res.ok).toBe(false)
    expect(res.error).toBe("NOT_FOUND")
  })

  it("returns confirmation DTO when found", async () => {
    mockAuthValue = { user: { id: "admin-1", email: "admin@test.com" } }
    mockPlatformRoleValue = "super_admin"

    spyOn(ConfirmationService.prototype, "findById").mockResolvedValueOnce(
      sampleConfirmation as never
    )

    const res = await app()
      .handle(new Request("http://localhost/confirmations/conf-1"))
      .then((r) => r.json())

    expect(res.id).toBe("conf-1")
    expect(res.amount).toBe(50000)
    expect(res.invoiceNumber).toBe("INV-001")
  })
})

describe("AdminConfirmationRoute POST /:id/approve", () => {
  beforeEach(() => {
    mockAuthValue = { user: null }
    mockPlatformRoleValue = "none"
  })

  it("returns 401 when unauthenticated", async () => {
    const res = await app()
      .handle(
        new Request("http://localhost/confirmations/conf-1/approve", {
          method: "POST",
        })
      )
      .then((r) => r.json())

    expect(res.ok).toBe(false)
    expect(res.error).toBe("UNAUTHORIZED")
  })

  it("approves payment without body and fires email", async () => {
    mockAuthValue = { user: { id: "admin-1", email: "admin@test.com" } }
    mockPlatformRoleValue = "super_admin"

    const approveSpy = spyOn(
      ConfirmationService.prototype,
      "approve"
    ).mockResolvedValueOnce({
      invoiceId: "inv-1",
      invoiceNumber: "INV-001",
      totalAmount: 50000,
      currency: "IDR",
      organizationId: "org-1",
    })

    const emailSpy = spyOn(
      PaymentService.prototype,
      "sendInvoicePaidEmail"
    ).mockResolvedValueOnce(undefined as never)

    const res = await app()
      .handle(
        new Request("http://localhost/confirmations/conf-1/approve", {
          method: "POST",
        })
      )
      .then((r) => r.json())

    expect(approveSpy).toHaveBeenCalledWith("conf-1", "admin-1", undefined)
    expect(emailSpy).toHaveBeenCalled()
    expect(res.message).toBe("Payment approved and balance credited")
  })

  it("approves payment with verified amount and catches email error gracefully", async () => {
    mockAuthValue = { user: { id: "admin-1", email: "admin@test.com" } }
    mockPlatformRoleValue = "super_admin"

    const approveSpy = spyOn(
      ConfirmationService.prototype,
      "approve"
    ).mockResolvedValueOnce({
      invoiceId: "inv-1",
      invoiceNumber: "INV-001",
      totalAmount: 55000,
      currency: "IDR",
      organizationId: "org-1",
    })

    const emailSpy = spyOn(
      PaymentService.prototype,
      "sendInvoicePaidEmail"
    ).mockRejectedValueOnce(new Error("SMTP down"))

    const res = await app()
      .handle(
        new Request("http://localhost/confirmations/conf-1/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve", amount: 55000 }),
        })
      )
      .then((r) => r.json())

    expect(approveSpy).toHaveBeenCalledWith("conf-1", "admin-1", 55000)
    expect(emailSpy).toHaveBeenCalled()
    expect(res.message).toBe("Payment approved and balance credited")
  })
})

describe("AdminConfirmationRoute POST /:id/reject", () => {
  beforeEach(() => {
    mockAuthValue = { user: null }
    mockPlatformRoleValue = "none"
  })

  it("returns 422 on invalid action body", async () => {
    mockAuthValue = { user: { id: "admin-1", email: "admin@test.com" } }
    mockPlatformRoleValue = "super_admin"

    const res = await app()
      .handle(
        new Request("http://localhost/confirmations/conf-1/reject", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "unknown" }),
        })
      )
      .then((r) => r.json())

    expect(res.ok).toBe(false)
    expect(res.error).toBe("VALIDATION_ERROR")
  })

  it("rejects confirmation with reason", async () => {
    mockAuthValue = { user: { id: "admin-1", email: "admin@test.com" } }
    mockPlatformRoleValue = "super_admin"

    const rejectSpy = spyOn(
      ConfirmationService.prototype,
      "reject"
    ).mockResolvedValueOnce({
      id: "conf-1",
      status: "REJECTED",
    } as never)

    const res = await app()
      .handle(
        new Request("http://localhost/confirmations/conf-1/reject", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reject",
            reason: "Transfer not received",
          }),
        })
      )
      .then((r) => r.json())

    expect(rejectSpy).toHaveBeenCalledWith(
      "conf-1",
      "admin-1",
      "Transfer not received"
    )
    expect(res.message).toBe("Payment rejected")
  })
})
