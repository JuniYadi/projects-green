import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PrismaClient } from "@prisma/client"
import { createMockPrisma, TestDecimal } from "@/test/helpers/prisma-mock"

const prismaMock = createMockPrisma({
  whatsappDevice: ["findMany"],
  whatsappQuotaCreditRate: ["findMany"],
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
    prismaMock.mock.whatsappQuotaCreditRate.findMany.mockReset()
    prismaMock.mock.serviceSubscription.findFirst.mockReset()
    prismaMock.mock.servicePricing.findFirst.mockReset()

    prismaMock.mock.whatsappDevice.findMany.mockResolvedValue([])
    prismaMock.mock.whatsappQuotaCreditRate.findMany.mockResolvedValue([])
    prismaMock.mock.serviceSubscription.findFirst.mockResolvedValue(null)
    prismaMock.mock.servicePricing.findFirst.mockResolvedValue(null)
  })

  it("resolves configured category rates per active device country", async () => {
    prismaMock.mock.whatsappDevice.findMany.mockResolvedValue([
      { id: "device-id", phoneNumber: "+6281234567890" },
    ])
    prismaMock.mock.whatsappQuotaCreditRate.findMany.mockResolvedValue([
      {
        category: "UTILITY",
        country: "ID",
        quotaCredit: new TestDecimal("1.5"),
        description: "Utility message credit",
      },
    ])
    prismaMock.mock.serviceSubscription.findFirst.mockResolvedValue({
      planId: "plan-id",
      plan: { resources: {} },
    })
    prismaMock.mock.servicePricing.findFirst.mockResolvedValue({
      id: "pricing-id",
      planId: "plan-id",
      regionId: "region-id",
      type: "PAYG",
      billingMode: "PAYG",
      currency: "IDR",
      basePriceIdr: new TestDecimal(0),
      monthlyCapIdr: null,
      unitRateCpu: null,
      unitRateMem: null,
      unitRateMessage: new TestDecimal(150),
      servicePlan: { code: "STANDARD", packageId: "WHATSAPP" },
      region: { code: "GLOBAL" },
    })

    const pricing = await service.getPricing("org-id")
    const utility = pricing.devices[0]?.categories.find(
      (category) => category.category === "UTILITY"
    )
    const marketing = pricing.devices[0]?.categories.find(
      (category) => category.category === "MARKETING"
    )

    expect(utility).toMatchObject({
      country: "ID",
      configured: true,
      description: "Utility message credit",
    })
    expect(utility?.quotaCredit.toString()).toBe("1.50")
    expect(marketing).toMatchObject({
      country: "ID",
      configured: false,
      description: null,
    })
    expect(marketing?.quotaCredit.toString()).toBe("1")
    expect(pricing.overage).toMatchObject({
      currency: "IDR",
      configured: true,
    })
    expect(pricing.overage.unitPrice?.toString()).toBe("150.00")
  })

  it("marks missing rates and PAYG pricing instead of hiding them", async () => {
    prismaMock.mock.whatsappDevice.findMany.mockResolvedValue([
      { id: "device-id", phoneNumber: "+14155550100" },
    ])

    const pricing = await service.getPricing("org-id")
    const categories = pricing.devices[0]?.categories ?? []

    expect(categories).toHaveLength(5)
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
