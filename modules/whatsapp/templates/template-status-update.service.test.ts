import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockPrisma = {
  whatsappTemplate: {
    findFirst: mock(),
    update: mock(),
  },
  whatsappTemplateLanguage: {
    updateMany: mock(),
  },
}
const mockLogAudit = mock(async () => undefined)

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
mock.module("@/modules/whatsapp/audit/whatsapp-audit.service", () => ({
  logWhatsappAuditEvent: mockLogAudit,
}))

const { processTemplateStatusUpdate } =
  await import("./template-status-update.service")

const approvedUpdate = {
  templateId: "1234567890",
  templateName: "thank_you_message",
  category: "MARKETING",
  language: "id",
  event: "APPROVED",
  reason: "NONE",
  occurredAt: 1700000000,
}

beforeEach(() => {
  mockPrisma.whatsappTemplate.findFirst.mockReset()
  mockPrisma.whatsappTemplate.update.mockReset()
  mockPrisma.whatsappTemplateLanguage.updateMany.mockReset()
  mockLogAudit.mockReset()

  mockPrisma.whatsappTemplate.findFirst.mockResolvedValue(null)
  mockPrisma.whatsappTemplate.update.mockResolvedValue({})
  mockPrisma.whatsappTemplateLanguage.updateMany.mockResolvedValue({ count: 1 })
  mockLogAudit.mockResolvedValue(undefined)
})

describe("processTemplateStatusUpdate", () => {
  it("updates the scoped template status and category without replacing its display name", async () => {
    mockPrisma.whatsappTemplate.findFirst.mockResolvedValue({
      id: "template-1",
      name: "Thank You Message",
      metaStatus: "PENDING",
      category: "UTILITY",
      syncStatus: "SYNCED",
      lastSyncedAt: null,
    })

    const result = await processTemplateStatusUpdate(
      "org-1",
      "device-1",
      approvedUpdate
    )

    expect(result).toBe("updated")
    expect(mockPrisma.whatsappTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          whatsappDeviceId: "device-1",
          slug: { in: expect.arrayContaining(["thank_you_message"]) },
        }),
      })
    )
    expect(mockPrisma.whatsappTemplate.update).toHaveBeenCalledWith({
      where: { id: "template-1" },
      data: expect.objectContaining({
        category: "MARKETING",
        metaStatus: "APPROVED",
        syncStatus: "SYNCED",
      }),
    })
    const updateData = mockPrisma.whatsappTemplate.update.mock.calls[0]?.[0]
      ?.data as Record<string, unknown>
    expect(updateData.name).toBeUndefined()
    expect(mockPrisma.whatsappTemplateLanguage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { templateId: "template-1", lang: "id" },
        data: expect.objectContaining({
          metaStatus: "APPROVED",
          isApproved: true,
          rejectReason: null,
        }),
      })
    )
  })

  it("retains a Meta status reason for the scoped reclassified language", async () => {
    mockPrisma.whatsappTemplate.findFirst.mockResolvedValue({
      id: "template-1",
      category: "UTILITY",
      metaStatus: "PENDING",
      syncStatus: "SYNCED",
      lastSyncedAt: null,
    })

    await processTemplateStatusUpdate("org-1", "device-1", {
      ...approvedUpdate,
      reason: "Template no longer meets utility guidance",
    })

    expect(mockPrisma.whatsappTemplateLanguage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { templateId: "template-1", lang: "id" },
        data: expect.objectContaining({
          metaStatus: "APPROVED",
          isApproved: true,
          rejectReason: "Template no longer meets utility guidance",
        }),
      })
    )
  })

  it("audits and ignores an unmatched template without crossing tenant/device boundaries", async () => {
    const result = await processTemplateStatusUpdate(
      "org-2",
      "device-2",
      approvedUpdate
    )

    expect(result).toBe("unmatched")
    expect(mockPrisma.whatsappTemplate.update).not.toHaveBeenCalled()
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-2",
        deviceId: "device-2",
        details: expect.objectContaining({ result: "unmatched" }),
      })
    )
  })

  it("does not rewrite duplicate or stale deliveries", async () => {
    mockPrisma.whatsappTemplate.findFirst
      .mockResolvedValueOnce({
        id: "template-1",
        category: "MARKETING",
        metaStatus: "APPROVED",
        syncStatus: "SYNCED",
        lastSyncedAt: null,
      })
      .mockResolvedValueOnce({
        id: "template-1",
        category: "UTILITY",
        metaStatus: "PENDING",
        syncStatus: "SYNCED",
        lastSyncedAt: new Date("2024-01-01T00:00:00.000Z"),
      })

    await expect(
      processTemplateStatusUpdate("org-1", "device-1", approvedUpdate)
    ).resolves.toBe("duplicate")
    await expect(
      processTemplateStatusUpdate("org-1", "device-1", approvedUpdate)
    ).resolves.toBe("stale")

    expect(mockPrisma.whatsappTemplate.update).not.toHaveBeenCalled()
  })
})
