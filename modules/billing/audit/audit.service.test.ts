import { describe, expect, it, mock, beforeEach } from "bun:test"

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockCreate = mock()

mock.module("@/lib/prisma", () => ({
  prisma: {
    billingAuditLog: {
      create: mockCreate,
    },
  },
}))

const { logBillingAuditEvent, emitBillingAudit } =
  await import("./audit.service")

beforeEach(() => {
  mockCreate.mockReset()
  mockCreate.mockResolvedValue({ id: "billing-audit-1" })
})

// ─── Tests ──────────────────────────────────────────────────────────────

describe("BillingAuditService", () => {
  describe("logBillingAuditEvent", () => {
    it("creates billing audit log with all fields populated", async () => {
      await logBillingAuditEvent({
        billingAccountId: "ba-123",
        billingRunId: "br-456",
        entityType: "INVOICE",
        entityId: "inv-789",
        action: "INVOICE_GENERATED",
        actorId: "user-999",
        context: { amount: 1500, currency: "USD" },
      })

      expect(mockCreate).toHaveBeenCalledTimes(1)
      const callArg = mockCreate.mock.calls[0][0]
      expect(callArg).toEqual({
        data: {
          billingAccountId: "ba-123",
          billingRunId: "br-456",
          entityType: "INVOICE",
          entityId: "inv-789",
          action: "INVOICE_GENERATED",
          actorType: "USER",
          actorId: "user-999",
          contextJson: { amount: 1500, currency: "USD" },
        },
      })
    })

    it("handles minimal optional fields with null fallbacks", async () => {
      await logBillingAuditEvent({
        entityType: "SUBSCRIPTION",
        entityId: "sub-1",
        action: "SUBSCRIPTION_ACTIVATED",
      })

      expect(mockCreate).toHaveBeenCalledTimes(1)
      const callArg = mockCreate.mock.calls[0][0]
      expect(callArg).toEqual({
        data: {
          billingAccountId: null,
          billingRunId: null,
          entityType: "SUBSCRIPTION",
          entityId: "sub-1",
          action: "SUBSCRIPTION_ACTIVATED",
          actorType: "USER",
          actorId: null,
          contextJson: null,
        },
      })
    })

    it("supports all billing audit actions", async () => {
      const actions = [
        "CREATED",
        "UPDATED",
        "DELETED",
        "RUN_STARTED",
        "RUN_FINISHED",
        "INVOICE_GENERATED",
        "PAYMENT_CONFIRMED",
        "ORDER_CREATED",
        "BALANCE_ADJUSTED",
        "TOPUP_PERFORMED",
        "SUBSCRIPTION_ACTIVATED",
        "SUBSCRIPTION_CANCELLED",
        "SUBSCRIPTION_REINSTATED",
        "CONTACT_ADDED",
        "CONTACT_REMOVED",
        "SETTINGS_CHANGED",
      ] as const

      for (const action of actions) {
        mockCreate.mockClear()
        await logBillingAuditEvent({
          entityType: "ENTITY",
          entityId: "id-1",
          action,
        })
        expect(mockCreate).toHaveBeenCalledTimes(1)
        expect(mockCreate.mock.calls[0][0].data.action).toBe(action)
      }
    })

    it("catches errors silently without throwing", async () => {
      mockCreate.mockRejectedValue(new Error("Database connection lost"))

      let threw = false
      try {
        await logBillingAuditEvent({
          entityType: "TOPUP",
          entityId: "topup-1",
          action: "TOPUP_PERFORMED",
        })
      } catch {
        threw = true
      }

      expect(threw).toBe(false)
    })
  })

  describe("emitBillingAudit", () => {
    it("calls logBillingAuditEvent fire-and-forget", async () => {
      emitBillingAudit({
        billingAccountId: "ba-1",
        entityType: "BALANCE",
        entityId: "bal-1",
        action: "BALANCE_ADJUSTED",
      })

      // Give microtask tick to resolve
      await Promise.resolve()

      expect(mockCreate).toHaveBeenCalledTimes(1)
      expect(mockCreate.mock.calls[0][0].data.billingAccountId).toBe("ba-1")
      expect(mockCreate.mock.calls[0][0].data.action).toBe("BALANCE_ADJUSTED")
    })
  })
})
