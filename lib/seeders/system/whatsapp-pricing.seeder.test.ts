import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { WhatsappBasePrice, WhatsappQuotaCreditRate } from "@prisma/client"

const mockFindFirstQuotaRate = mock(
  async () => null as unknown as WhatsappQuotaCreditRate | null
)
const mockCreateQuotaRate = mock(
  async (args: { data: unknown }) => args.data as WhatsappQuotaCreditRate
)
const mockFindFirstBasePrice = mock(
  async () => null as unknown as WhatsappBasePrice | null
)
const mockCreateBasePrice = mock(
  async (args: { data: unknown }) => args.data as WhatsappBasePrice
)

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappQuotaCreditRate: {
      findFirst: mockFindFirstQuotaRate,
      create: mockCreateQuotaRate,
    },
    whatsappBasePrice: {
      findFirst: mockFindFirstBasePrice,
      create: mockCreateBasePrice,
    },
  },
}))

// Note: Test file imports seeder after mock.module setup for bun test
const { WhatsappPricingSeeder } = await import("./whatsapp-pricing.seeder")

describe("WhatsappPricingSeeder", () => {
  beforeEach(() => {
    mockFindFirstQuotaRate.mockReset()
    mockCreateQuotaRate.mockReset()
    mockFindFirstBasePrice.mockReset()
    mockCreateBasePrice.mockReset()

    mockFindFirstQuotaRate.mockResolvedValue(null)
    mockFindFirstBasePrice.mockResolvedValue(null)
    mockCreateQuotaRate.mockImplementation(
      async (args: { data: unknown }) => args.data as WhatsappQuotaCreditRate
    )
    mockCreateBasePrice.mockImplementation(
      async (args: { data: unknown }) => args.data as WhatsappBasePrice
    )
  })

  it("creates baseline quota credit rates and base prices when they do not exist", async () => {
    const seeder = new WhatsappPricingSeeder()
    await seeder.seed()

    expect(mockCreateQuotaRate).toHaveBeenCalledTimes(4)
    expect(mockCreateBasePrice).toHaveBeenCalledTimes(4)

    const result = seeder.getResult()
    expect(result.created).toBe(8)
    expect(result.skipped).toBe(0)
  })

  it("skips existing quota credit rates and base prices idempotently", async () => {
    mockFindFirstQuotaRate.mockResolvedValue({
      id: "existing-rate",
    } as unknown as WhatsappQuotaCreditRate)
    mockFindFirstBasePrice.mockResolvedValue({
      id: "existing-price",
    } as unknown as WhatsappBasePrice)

    const seeder = new WhatsappPricingSeeder()
    await seeder.seed()

    expect(mockCreateQuotaRate).not.toHaveBeenCalled()
    expect(mockCreateBasePrice).not.toHaveBeenCalled()

    const result = seeder.getResult()
    expect(result.created).toBe(0)
    expect(result.skipped).toBe(8)
  })
})
