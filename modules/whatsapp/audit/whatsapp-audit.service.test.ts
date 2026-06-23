import { describe, expect, it, mock, beforeEach } from "bun:test"

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockCreate = mock()

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappAuditLog: {
      create: mockCreate,
    },
  },
}))

const { logWhatsappAuditEvent } = await import("./whatsapp-audit.service")

beforeEach(() => {
  mockCreate.mockReset()
  mockCreate.mockResolvedValue({ id: "log-1" })
})

// ─── Tests ──────────────────────────────────────────────────────────────

describe("WhatsappAuditService", () => {
  it("creates record with all fields populated", async () => {
    mockCreate.mockResolvedValue({ id: "log-1" })

    await logWhatsappAuditEvent({
      action: "TEMPLATE_SYNCED",
      status: "OK",
      organizationId: "org-1",
      deviceId: "dev-1",
      adminId: "admin-1",
      correlationId: "corr-1",
      message: "Sync completed",
      errorMessage: null,
      details: { templateCount: 5 },
      durationMs: 1234,
      ip: "10.0.0.1",
      userAgent: "curl/8",
    })

    expect(mockCreate).toHaveBeenCalledTimes(1)
    const args = mockCreate.mock.calls[0][0]
    expect(args.data.organizationId).toBe("org-1")
    expect(args.data.action).toBe("TEMPLATE_SYNCED")
    expect(args.data.status).toBe("OK")
    expect(args.data.deviceId).toBe("dev-1")
    expect(args.data.adminId).toBe("admin-1")
    expect(args.data.correlationId).toBe("corr-1")
    expect(args.data.message).toBe("Sync completed")
    expect(args.data.durationMs).toBe(1234)
    expect(args.data.ip).toBe("10.0.0.1")
    expect(args.data.userAgent).toBe("curl/8")
  })

  it("handles partial fields gracefully", async () => {
    mockCreate.mockResolvedValue({ id: "log-2" })

    await logWhatsappAuditEvent({
      action: "MESSAGE_SENT",
      organizationId: "org-1",
    })

    expect(mockCreate).toHaveBeenCalledTimes(1)
    const args = mockCreate.mock.calls[0][0]
    expect(args.data.organizationId).toBe("org-1")
    expect(args.data.action).toBe("MESSAGE_SENT")
    expect(args.data.status).toBeNull()
    expect(args.data.deviceId).toBeNull()
    expect(args.data.adminId).toBeNull()
  })

  it("is fire-and-forget: does not throw on error", async () => {
    mockCreate.mockRejectedValue(new Error("DB error"))

    let threw = false
    try {
      await logWhatsappAuditEvent({
        action: "TEMPLATE_SYNC_FAILED",
        organizationId: "org-1",
      })
    } catch {
      threw = true
    }

    // Should NOT throw — error is caught internally
    expect(threw).toBe(false)
  })
})
