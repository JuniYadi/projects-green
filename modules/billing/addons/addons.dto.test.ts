import { describe, expect, it } from "bun:test"
import { Prisma } from "@prisma/client"

import {
  ADDON_PERIOD_MONTHS,
  ADDON_RECURRING_PERIODS,
  toAddonPriceDTO,
  toAddonDTO,
  toAddonPlanAttachmentDTO,
  type AddonPricingRecord,
  type AddonRecord,
  type AddonPlanAttachmentRecord,
} from "./addons.dto"
import { ServiceAddonBillingMode } from "@prisma/client"

describe("addons.dto", () => {
  describe("toAddonPriceDTO", () => {
    it("converts a pricing record to DTO with correct period months", () => {
      const record: AddonPricingRecord = {
        id: "price-1",
        addonId: "addon-1",
        billingPeriod: "MONTHLY",
        currency: "IDR",
        amount: new Prisma.Decimal("50000"),
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        effectiveTo: null,
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }

      const dto = toAddonPriceDTO(record)

      expect(dto).not.toBeNull()
      expect(dto!.periodMonths).toBe(1)
      expect(dto!.amount).toBe("50000")
      expect(dto!.currency).toBe("IDR")
      expect(dto!.effectiveFrom).toBe("2026-01-01T00:00:00.000Z")
      expect(dto!.effectiveTo).toBeNull()
      expect(dto!.isActive).toBe(true)
    })

    it("returns null for non-recurring billing periods", () => {
      const record: AddonPricingRecord = {
        id: "price-1",
        addonId: "addon-1",
        billingPeriod: "CUSTOM",
        currency: "IDR",
        amount: new Prisma.Decimal("50000"),
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        effectiveTo: null,
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }

      expect(toAddonPriceDTO(record)).toBeNull()
    })

    it("correctly maps all recurring periods to months", () => {
      const base: Omit<AddonPricingRecord, "billingPeriod"> = {
        id: "price",
        addonId: "addon-1",
        currency: "IDR",
        amount: new Prisma.Decimal("100"),
        effectiveFrom: new Date("2026-01-01"),
        effectiveTo: null,
        isActive: true,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      }

      expect(
        toAddonPriceDTO({ ...base, billingPeriod: "MONTHLY" })?.periodMonths
      ).toBe(1)
      expect(
        toAddonPriceDTO({ ...base, billingPeriod: "QUARTERLY" })?.periodMonths
      ).toBe(3)
      expect(
        toAddonPriceDTO({ ...base, billingPeriod: "SEMI_ANNUAL" })?.periodMonths
      ).toBe(6)
      expect(
        toAddonPriceDTO({ ...base, billingPeriod: "ANNUAL" })?.periodMonths
      ).toBe(12)
    })
  })

  describe("toAddonDTO", () => {
    it("maps all addon fields correctly", () => {
      const past = new Date("2026-01-01T00:00:00.000Z")
      const addon: AddonRecord = {
        id: "addon-1",
        code: "EXTRA_SEATS",
        name: "Extra Seats",
        description: null,
        billingMode: ServiceAddonBillingMode.ONE_TIME,
        isActive: false,
        createdAt: past,
        updatedAt: past,
        prices: [],
      }

      const dto = toAddonDTO(addon)
      expect(dto.id).toBe("addon-1")
      expect(dto.code).toBe("EXTRA_SEATS")
      expect(dto.name).toBe("Extra Seats")
      expect(dto.description).toBeNull()
      expect(dto.billingMode).toBe("ONE_TIME")
      expect(dto.isActive).toBe(false)
      expect(dto.createdAt).toBe("2026-01-01T00:00:00.000Z")
      expect(dto.updatedAt).toBe("2026-01-01T00:00:00.000Z")
      expect(dto.prices).toHaveLength(0)
    })

    it("filters out inactive and expired prices", () => {
      const now = new Date("2026-06-15T00:00:00.000Z")
      const past = new Date("2026-01-01T00:00:00.000Z")
      const future = new Date("2026-12-01T00:00:00.000Z")

      const addon: AddonRecord = {
        id: "addon-1",
        code: "EXTRA_SEATS",
        name: "Extra Seats",
        description: "Additional seats",
        billingMode: ServiceAddonBillingMode.RECURRING,
        isActive: true,
        createdAt: past,
        updatedAt: past,
        prices: [
          {
            id: "price-active",
            addonId: "addon-1",
            billingPeriod: "MONTHLY",
            currency: "IDR",
            amount: new Prisma.Decimal("50000"),
            effectiveFrom: past,
            effectiveTo: null,
            isActive: true,
            createdAt: past,
            updatedAt: past,
          },
          {
            id: "price-inactive",
            addonId: "addon-1",
            billingPeriod: "MONTHLY",
            currency: "IDR",
            amount: new Prisma.Decimal("30000"),
            effectiveFrom: past,
            effectiveTo: null,
            isActive: false,
            createdAt: past,
            updatedAt: past,
          },
          {
            id: "price-expired",
            addonId: "addon-1",
            billingPeriod: "ANNUAL",
            currency: "IDR",
            amount: new Prisma.Decimal("500000"),
            effectiveFrom: past,
            effectiveTo: past,
            isActive: true,
            createdAt: past,
            updatedAt: past,
          },
          {
            id: "price-future",
            addonId: "addon-1",
            billingPeriod: "QUARTERLY",
            currency: "IDR",
            amount: new Prisma.Decimal("150000"),
            effectiveFrom: future,
            effectiveTo: null,
            isActive: true,
            createdAt: future,
            updatedAt: future,
          },
        ],
      }

      // Mock Date to control "now"
      const RealDate = global.Date
      const mockedDate = class extends RealDate {
        constructor(value?: string | number | Date) {
          super(value ?? now)
        }
        static now() {
          return now.getTime()
        }
      }
      global.Date = mockedDate as never

      try {
        const dto = toAddonDTO(addon)
        expect(dto.prices).toHaveLength(1)
        expect(dto.prices[0].id).toBe("price-active")
      } finally {
        global.Date = RealDate
      }
    })
  })

  describe("toAddonPlanAttachmentDTO", () => {
    it("maps all fields correctly", () => {
      const past = new Date("2026-01-01T00:00:00.000Z")
      const record: AddonPlanAttachmentRecord = {
        id: "attach-1",
        planId: "plan-1",
        addonId: "addon-1",
        label: "Extra label",
        description: "Desc",
        isRequired: true,
        displayOrder: 2,
        enabledTerms: { min: 1 },
        isActive: true,
        createdAt: past,
        updatedAt: past,
        plan: {
          id: "plan-1",
          code: "PLAN_BASIC",
          package: { code: "WHATSAPP" },
        },
        addon: {
          id: "addon-1",
          code: "EXTRA_SEATS",
          name: "Extra Seats",
        },
      }

      const dto = toAddonPlanAttachmentDTO(record)
      expect(dto.planId).toBe("plan-1")
      expect(dto.planCode).toBe("PLAN_BASIC")
      expect(dto.packageCode).toBe("WHATSAPP")
      expect(dto.addonId).toBe("addon-1")
      expect(dto.addonCode).toBe("EXTRA_SEATS")
      expect(dto.isRequired).toBe(true)
      expect(dto.displayOrder).toBe(2)
      expect(dto.enabledTerms).toEqual({ min: 1 })
    })
  })

  describe("ADDON_RECURRING_PERIODS and ADDON_PERIOD_MONTHS", () => {
    it("are aligned for all standard recurring periods", () => {
      ADDON_RECURRING_PERIODS.forEach((period) => {
        expect(ADDON_PERIOD_MONTHS[period]).toBeDefined()
      })
    })
  })
})
