import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Prisma, WhatsappBillingCategory } from "@prisma/client"

const mockFindFirst = mock(async (): Promise<unknown> => null)

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappQuotaCreditRate: {
      findFirst: mockFindFirst,
    },
  },
}))

const {
  resolveWhatsappCountry,
  isDestinationCountrySupported,
  resolveWhatsappQuotaCredit,
  DEFAULT_WHATSAPP_QUOTA_CREDIT,
} = await import("./quota-credit.service")

describe("quota-credit.service", () => {
  beforeEach(() => {
    mockFindFirst.mockClear()
  })

  describe("resolveWhatsappCountry", () => {
    it("resolves Indonesian numbers correctly", () => {
      expect(resolveWhatsappCountry("+628123456789")).toBe("ID")
      expect(resolveWhatsappCountry("628123456789")).toBe("ID")
      expect(resolveWhatsappCountry("08123456789")).toBe("ID")
    })

    it("resolves US numbers correctly", () => {
      expect(resolveWhatsappCountry("+14155552671")).toBe("US")
      expect(resolveWhatsappCountry("14155552671")).toBe("US")
    })

    it("resolves international formats via detectCountryFromPhone", () => {
      expect(resolveWhatsappCountry("+447911123456")).toBe("GB")
      expect(resolveWhatsappCountry("+6591234567")).toBe("SG")
    })

    it("returns UNKNOWN for unresolvable number patterns", () => {
      expect(resolveWhatsappCountry("9999999999")).toBe("UNKNOWN")
    })
  })

  describe("isDestinationCountrySupported", () => {
    it("returns supported true when active rate is found", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "rate-1" })

      const result = await isDestinationCountrySupported("+628123456789")

      expect(result).toEqual({ supported: true, country: "ID" })
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            country: "ID",
            isActive: true,
          }),
          select: { id: true },
        })
      )
    })

    it("returns supported false when active rate is not found", async () => {
      mockFindFirst.mockResolvedValueOnce(null)

      const result = await isDestinationCountrySupported("+999123456")

      expect(result).toEqual({ supported: false, country: "UNKNOWN" })
    })

    it("supports passing custom effectiveAt date", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "rate-1" })
      const effectiveDate = new Date("2026-05-01T00:00:00.000Z")

      await isDestinationCountrySupported("+628123456789", effectiveDate)

      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            country: "ID",
            isActive: true,
            effectiveFrom: { lte: effectiveDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveDate } }],
          }),
        })
      )
    })
  })

  describe("resolveWhatsappQuotaCredit", () => {
    it("returns matching rate from database", async () => {
      const mockRate = {
        category: WhatsappBillingCategory.MARKETING,
        country: "ID",
        quotaCredit: new Prisma.Decimal(2.5),
        description: "Marketing ID rate",
      }
      mockFindFirst.mockResolvedValueOnce(mockRate)

      const result = await resolveWhatsappQuotaCredit({
        category: WhatsappBillingCategory.MARKETING,
        phoneNumber: "+628123456789",
      })

      expect(result).toEqual({
        category: WhatsappBillingCategory.MARKETING,
        country: "ID",
        quotaCredit: new Prisma.Decimal(2.5),
        description: "Marketing ID rate",
      })
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: WhatsappBillingCategory.MARKETING,
            country: "ID",
            isActive: true,
          }),
          orderBy: { effectiveFrom: "desc" },
        })
      )
    })

    it("maps REPLY category to SERVICE category before querying database", async () => {
      mockFindFirst.mockResolvedValueOnce({
        category: WhatsappBillingCategory.SERVICE,
        country: "ID",
        quotaCredit: new Prisma.Decimal(1.2),
        description: "Service ID rate",
      })

      const result = await resolveWhatsappQuotaCredit({
        category: "REPLY" as WhatsappBillingCategory,
        phoneNumber: "+628123456789",
      })

      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: WhatsappBillingCategory.SERVICE,
            country: "ID",
          }),
        })
      )
      expect(result.category).toBe(WhatsappBillingCategory.SERVICE)
    })

    it("returns default fallback credit when rate not found", async () => {
      mockFindFirst.mockResolvedValueOnce(null)

      const result = await resolveWhatsappQuotaCredit({
        category: WhatsappBillingCategory.AUTHENTICATION,
        phoneNumber: "+14155552671",
      })

      expect(result).toEqual({
        category: WhatsappBillingCategory.AUTHENTICATION,
        country: "US",
        quotaCredit: DEFAULT_WHATSAPP_QUOTA_CREDIT,
        description: null,
      })
    })

    it("handles effectiveAt timestamp filter properly", async () => {
      mockFindFirst.mockResolvedValueOnce(null)
      const targetDate = new Date("2026-06-15T12:00:00.000Z")

      await resolveWhatsappQuotaCredit({
        category: WhatsappBillingCategory.UTILITY,
        phoneNumber: "+6281111111",
        effectiveAt: targetDate,
      })

      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            effectiveFrom: { lte: targetDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: targetDate } }],
          }),
        })
      )
    })
  })
})
