import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockPrisma = {
  whatsappDevice: {
    findFirst: mock(),
  },
  whatsappTemplate: {
    findFirst: mock(),
    findMany: mock().mockResolvedValue([]),
    create: mock(),
    update: mock(),
    updateMany: mock(),
  },
  whatsappTemplateLanguage: {
    upsert: mock(),
  },
}

const mockWhatsAppDeviceClient = {
  fromDevice: mock(),
  listTemplatesPage: mock(),
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

mock.module("@/lib/whatsapp/meta-cloud/device-client", () => ({
  WhatsAppDeviceClient: mockWhatsAppDeviceClient,
}))

mock.module("@/modules/whatsapp/audit/whatsapp-audit.service", () => ({
  logWhatsappAuditEvent: mock().mockResolvedValue({}),
}))

const { syncTemplates } = await import(
  "@/scripts/whatsapp-template-sync-worker"
)

describe("whatsapp-template-sync-worker", () => {
  beforeEach(() => {
    mockPrisma.whatsappDevice.findFirst.mockReset()
    mockPrisma.whatsappTemplate.findFirst.mockReset()
    mockPrisma.whatsappTemplate.findMany.mockReset().mockResolvedValue([])
    mockPrisma.whatsappTemplate.create.mockReset()
    mockPrisma.whatsappTemplate.update.mockReset()
    mockPrisma.whatsappTemplate.updateMany.mockReset()
    mockPrisma.whatsappTemplateLanguage.upsert.mockReset()
    mockWhatsAppDeviceClient.fromDevice.mockReset()
    mockWhatsAppDeviceClient.listTemplatesPage.mockReset()

    mockPrisma.whatsappDevice.findFirst.mockResolvedValue({
      id: "device-1",
      token: null,
      tokenEncrypted: "encrypted-token",
      tokenIv: null,
      whatsappPhoneId: "phone-1",
      whatsappBusinessAccountId: "waba-1",
      organizationId: "org-1",
    })

    mockWhatsAppDeviceClient.fromDevice.mockReturnValue(mockWhatsAppDeviceClient)
  })

  it("matches existing template created with underscore, title case, or hyphenated slug", async () => {
    mockWhatsAppDeviceClient.listTemplatesPage.mockResolvedValue({
      data: [
        {
          name: "pengingat_donor_darah",
          status: "APPROVED",
          category: "UTILITY",
          language: "id",
          components: [{ type: "BODY", text: "Halo donor" }],
        },
      ],
      paging: {},
    })

    // Simulate existing template in DB
    mockPrisma.whatsappTemplate.findFirst.mockResolvedValue({
      id: "tpl-123",
      name: "Pengingat Donor Darah",
      slug: "pengingat-donor-darah",
    })

    mockPrisma.whatsappTemplate.update.mockResolvedValue({ id: "tpl-123" })
    mockPrisma.whatsappTemplateLanguage.upsert.mockResolvedValue({ id: "lang-1" })
    mockPrisma.whatsappTemplate.updateMany.mockResolvedValue({ count: 0 })

    const summary = await syncTemplates({
      organizationId: "org-1",
      deviceId: "device-1",
      method: "sync-templates",
    })

    expect(summary.fetched).toBe(1)
    expect(summary.updated).toBe(1)
    expect(summary.created).toBe(0)
    expect(mockPrisma.whatsappTemplate.create).not.toHaveBeenCalled()
    expect(mockPrisma.whatsappTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tpl-123" },
        data: expect.objectContaining({
          slug: "pengingat_donor_darah",
        }),
      })
    )
  })

  it("does not mark matched template as NOT_IN_META when slugs are formatted", async () => {
    mockWhatsAppDeviceClient.listTemplatesPage.mockResolvedValue({
      data: [
        {
          name: "pengingat_donor_darah",
          status: "APPROVED",
          category: "UTILITY",
          language: "id",
          components: [{ type: "BODY", text: "Halo donor" }],
        },
      ],
      paging: {},
    })

    mockPrisma.whatsappTemplate.findFirst.mockResolvedValue(null)
    mockPrisma.whatsappTemplate.create.mockResolvedValue({ id: "tpl-new" })
    mockPrisma.whatsappTemplate.updateMany.mockResolvedValue({ count: 0 })

    await syncTemplates({
      organizationId: "org-1",
      deviceId: "device-1",
      method: "sync-templates",
    })

    expect(mockPrisma.whatsappTemplate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          whatsappDeviceId: "device-1",
          AND: expect.arrayContaining([
            expect.objectContaining({
              slug: expect.objectContaining({
                notIn: expect.arrayContaining([
                  "pengingat_donor_darah",
                  "pengingat-donor-darah",
                ]),
              }),
            }),
          ]),
        }),
      })
    )
  })
})
