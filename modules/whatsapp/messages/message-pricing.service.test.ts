import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PrismaClient } from "@prisma/client"
import { createMockPrisma, TestDecimal } from "@/test/helpers/prisma-mock"

const prismaMock = createMockPrisma({
  whatsappDevice: ["findMany", "findUnique"],
  whatsappQuotaCreditRate: ["findMany"],
  whatsappBasePrice: ["findMany", "findFirst"],
  serviceSubscription: ["findFirst"],
  servicePricing: ["findFirst"],
})

mock.module("@/lib/prisma", () => ({ prisma: prismaMock.prisma }))

const { WhatsappMessagePricingService } =
  await import("./message-pricing.service")

describe("WhatsappMessagePricingService", () => {
  let service: InstanceType<typeof WhatsappMessagePricingService>

  beforeEach(() => {
    service = new WhatsappMessagePricingService(
      prismaMock.prisma as unknown as PrismaClient
    )

    prismaMock.mock.whatsappDevice.findMany.mockReset()
    prismaMock.mock.whatsappDevice.findUnique.mockReset()
    prismaMock.mock.whatsappQuotaCreditRate.findMany.mockReset()
    prismaMock.mock.whatsappBasePrice.findMany.mockReset()
    prismaMock.mock.whatsappBasePrice.findFirst.mockReset()
    prismaMock.mock.serviceSubscription.findFirst.mockReset()
    prismaMock.mock.servicePricing.findFirst.mockReset()

    prismaMock.mock.whatsappDevice.findMany.mockResolvedValue([])
    prismaMock.mock.whatsappDevice.findUnique.mockResolvedValue(null)
    prismaMock.mock.whatsappQuotaCreditRate.findMany.mockResolvedValue([])
    prismaMock.mock.whatsappBasePrice.findMany.mockResolvedValue([])
    prismaMock.mock.whatsappBasePrice.findFirst.mockResolvedValue(null)
    prismaMock.mock.serviceSubscription.findFirst.mockResolvedValue(null)
    prismaMock.mock.servicePricing.findFirst.mockResolvedValue(null)
  })
  it("resolves configured category rates and tier calculations per active device country", async () => {
    prismaMock.mock.whatsappDevice.findMany.mockResolvedValue([
      { id: "device-id", phoneNumber: "+6281234567890", rates: "TIER_1" },
    ])
    prismaMock.mock.whatsappDevice.findUnique.mockResolvedValue({
      rates: "TIER_1",
    })
    prismaMock.mock.whatsappQuotaCreditRate.findMany.mockResolvedValue([
      {
        category: "UTILITY",
        country: "ID",
        quotaCredit: new TestDecimal("1.00"),
        description: "Utility template rate",
      },
      {
        category: "MARKETING",
        country: "ID",
        quotaCredit: new TestDecimal("2.00"),
        description: "Marketing template rate",
      },
    ])
    prismaMock.mock.whatsappBasePrice.findMany.mockResolvedValue([
      {
        category: "UTILITY",
        country: "ID",
        basePrice: new TestDecimal(357),
        currency: "IDR",
      },
      {
        category: "MARKETING",
        country: "ID",
        basePrice: new TestDecimal(587),
        currency: "IDR",
      },
    ])
    prismaMock.mock.whatsappBasePrice.findFirst.mockResolvedValue({
      basePrice: new TestDecimal(357),
      currency: "IDR",
    })

    const pricing = await service.getPricing("org-id")
    const utility = pricing.devices[0]?.categories.find(
      (category) => category.category === "UTILITY"
    )
    const marketing = pricing.devices[0]?.categories.find(
      (category) => category.category === "MARKETING"
    )

    expect(pricing.devices[0]?.rateTier).toBe("TIER_1")
    expect(utility?.quotaCredit.toString()).toBe("1.00")
    expect(utility?.overagePrice?.toString()).toBe("451")
    expect(utility?.feeAmount?.toString()).toBe("54")
    expect(utility?.ppnAmount?.toString()).toBe("40")
    expect(utility?.tierPrices?.BASE?.toString()).toBe("469")
    expect(utility?.tierPrices?.TIER_1?.toString()).toBe("451")
    expect(utility?.tierPrices?.TIER_2?.toString()).toBe("433")
    expect(utility?.tierPrices?.TIER_3?.toString()).toBe("415")
    expect(marketing?.quotaCredit.toString()).toBe("2.00")
    expect(marketing?.overagePrice?.toString()).toBe("741")
    expect(marketing?.feeAmount?.toString()).toBe("89")
    expect(marketing?.ppnAmount?.toString()).toBe("65")
    expect(marketing?.tierPrices?.BASE?.toString()).toBe("770")
    expect(marketing?.tierPrices?.TIER_1?.toString()).toBe("741")
    expect(marketing?.tierPrices?.TIER_2?.toString()).toBe("711")
    expect(marketing?.tierPrices?.TIER_3?.toString()).toBe("682")
  })
  it("marks missing rates and PAYG pricing instead of hiding them", async () => {
    prismaMock.mock.whatsappDevice.findMany.mockResolvedValue([
      { id: "device-id", phoneNumber: "+14155550100" },
    ])

    const pricing = await service.getPricing("org-id")
    const categories = pricing.devices[0]?.categories ?? []

    expect(categories).toHaveLength(4)
    expect(categories.every((category) => !category.configured)).toBe(true)
    expect(
      categories.every((category) => category.quotaCredit.toString() === "1")
    ).toBe(true)
    expect(pricing.overage).toEqual({
      unitPrice: null,
      currency: null,
      configured: false,
    })
  })
})
