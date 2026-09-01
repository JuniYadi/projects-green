import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockBillingContactFindMany = mock(async (): Promise<unknown[]> => [])
const mockWhatsappDeviceFindUnique = mock(async (): Promise<unknown> => null)
const mockQuotaAlertFindMany = mock(async (): Promise<unknown[]> => [])
const mockQuotaAlertCreate = mock(async () => ({}))
const mockBillingAlertRuleFindMany = mock(async (): Promise<unknown[]> => [])

mock.module("@/lib/prisma", () => ({
  prisma: {
    billingContact: {
      findMany: mockBillingContactFindMany,
    },
    whatsappDevice: {
      findUnique: mockWhatsappDeviceFindUnique,
    },
    whatsappQuotaAlert: {
      findMany: mockQuotaAlertFindMany,
      create: mockQuotaAlertCreate,
    },
    billingAlertRule: {
      findMany: mockBillingAlertRuleFindMany,
    },
  },
}))

const mockSendEmail = mock(async () => {})
mock.module("@/lib/queue/email", () => ({
  sendEmail: mockSendEmail,
}))

const mockCreateEmailLog = mock(async () => "email-log-quota-1")
mock.module("@/lib/email-log", () => ({
  createEmailLog: mockCreateEmailLog,
}))

const { quotaAlertService, QUOTA_THRESHOLDS } =
  await import("./quota-alert.service")

describe("quotaAlertService", () => {
  beforeEach(() => {
    mockBillingContactFindMany.mockClear()
    mockWhatsappDeviceFindUnique.mockClear()
    mockQuotaAlertFindMany.mockClear()
    mockQuotaAlertCreate.mockClear()
    mockSendEmail.mockClear()
    mockCreateEmailLog.mockClear()
    mockCreateEmailLog.mockResolvedValue("email-log-quota-1")
    mockBillingAlertRuleFindMany.mockClear()
  })

  it("exports correct quota thresholds", () => {
    expect(QUOTA_THRESHOLDS).toEqual([50, 80, 90, 100])
  })

  it("does nothing if there are no billing contacts with low balance notifications enabled", async () => {
    mockBillingContactFindMany.mockResolvedValueOnce([])

    await quotaAlertService.checkAndSendAlerts(
      "org-1",
      "dev-1",
      85,
      85000,
      100000
    )

    expect(mockBillingContactFindMany).toHaveBeenCalledWith({
      where: {
        billingAccount: { organizationId: "org-1" },
        notifyOnLowBalance: true,
        isActive: true,
      },
      select: { email: true },
    })
    expect(mockWhatsappDeviceFindUnique).not.toHaveBeenCalled()
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it("sends alert emails and records sent thresholds in database", async () => {
    mockBillingContactFindMany.mockResolvedValueOnce([
      { email: "billing@example.com" },
      { email: "finance@example.com" },
    ])
    mockWhatsappDeviceFindUnique.mockResolvedValueOnce({
      phoneNumber: "+628123456789",
    })
    // Already sent 50% alert previously
    mockQuotaAlertFindMany.mockResolvedValueOnce([{ threshold: 50 }])

    // Current percent is 85% -> crosses 50% (already sent) and 80% (new)
    await quotaAlertService.checkAndSendAlerts(
      "org-1",
      "dev-1",
      85,
      85000,
      100000
    )

    expect(mockQuotaAlertCreate).toHaveBeenCalledTimes(1)
    expect(mockQuotaAlertCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        whatsappDeviceId: "dev-1",
        threshold: 80,
      },
    })

    // 2 emails * 1 threshold = 2 sendEmail calls
    expect(mockCreateEmailLog).toHaveBeenCalledTimes(2)
    expect(mockCreateEmailLog).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: "billing@example.com",
        type: "WHATSAPP_QUOTA_ALERT",
        organizationId: "org-1",
        relatedEntityType: "WhatsappDevice",
        relatedEntityId: "dev-1",
      })
    )
    expect(mockSendEmail).toHaveBeenCalledTimes(2)
    const email1 = (mockSendEmail.mock.calls as unknown[][])[0][0] as {
      to: string
      subject: string
      html: string
      emailLogId?: string
    }
    expect(email1.to).toBe("billing@example.com")
    expect(email1.subject).toContain("80% quota reached")
    expect(email1.html).toContain("+628123456789")
    expect(email1.html).toContain("85%")
    expect(email1.emailLogId).toBe("email-log-quota-1")
  })

  it("handles 100% quota exhausted alert with action required subject and danger style", async () => {
    mockBillingContactFindMany.mockResolvedValueOnce([
      { email: "owner@example.com" },
    ])
    mockWhatsappDeviceFindUnique.mockResolvedValueOnce(null) // Fallback to deviceId
    mockQuotaAlertFindMany.mockResolvedValueOnce([
      { threshold: 50 },
      { threshold: 80 },
      { threshold: 90 },
    ])

    await quotaAlertService.checkAndSendAlerts(
      "org-1",
      "dev-fallback-id",
      100,
      120000,
      100000
    )

    expect(mockQuotaAlertCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        whatsappDeviceId: "dev-fallback-id",
        threshold: 100,
      },
    })

    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    const email = (mockSendEmail.mock.calls as unknown[][])[0][0] as {
      to: string
      subject: string
      html: string
    }
    expect(email.subject).toContain(
      "[Action Required] WhatsApp quota exhausted on dev-fallback-id"
    )
    expect(email.html).toContain("QUOTA EXHAUSTED")
    expect(email.html).toContain("Messages will stop sending")
  })

  it("does not send alerts if current percent has not crossed any new threshold", async () => {
    mockBillingContactFindMany.mockResolvedValueOnce([
      { email: "billing@example.com" },
    ])
    mockWhatsappDeviceFindUnique.mockResolvedValueOnce({
      phoneNumber: "+62811111",
    })
    mockQuotaAlertFindMany.mockResolvedValueOnce([])

    // 40% < 50% lowest threshold
    await quotaAlertService.checkAndSendAlerts(
      "org-1",
      "dev-1",
      40,
      40000,
      100000
    )

    expect(mockQuotaAlertCreate).not.toHaveBeenCalled()
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it("handles concurrent or duplicate create error gracefully", async () => {
    mockBillingContactFindMany.mockResolvedValueOnce([
      { email: "billing@example.com" },
    ])
    mockWhatsappDeviceFindUnique.mockResolvedValueOnce({
      phoneNumber: "+62811111",
    })
    mockQuotaAlertFindMany.mockResolvedValueOnce([])
    mockQuotaAlertCreate.mockRejectedValueOnce(
      new Error("Unique constraint violation")
    )

    await quotaAlertService.checkAndSendAlerts(
      "org-1",
      "dev-1",
      55,
      55000,
      100000
    )

    expect(mockQuotaAlertCreate).toHaveBeenCalled()
    // sendEmail shouldn't be called if create threw error in the try/catch
    expect(mockSendEmail).not.toHaveBeenCalled()
  })
})
