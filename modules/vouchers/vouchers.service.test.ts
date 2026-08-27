import { describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"
import { VoucherService } from "./vouchers.service"
import {
  VoucherNotFoundError,
  VoucherAlreadyPublishedError,
  VoucherNotPublishableError,
  VoucherNotAPromotionError,
  VoucherAlreadyDisabledError,
  VoucherDiscountConfigurationError,
} from "./vouchers.errors"

function createMockPrisma() {
  const mockFindMany = mock(async () => [])
  const mockFindUnique = mock(async () => null)
  const mockFindFirst = mock(async () => null)
  const mockCreate = mock(async (args: { data: Record<string, unknown> }) => ({
    id: "v-1",
    ...args.data,
  }))
  const mockUpdate = mock(async (args: { data: Record<string, unknown> }) => ({
    id: "v-1",
    ...args.data,
  }))
  const mockUpdateMany = mock(async () => ({ count: 1 }))
  const mockCount = mock(async () => 0)

  return {
    voucher: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      findUniqueOrThrow: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      updateMany: mockUpdateMany,
      count: mockCount,
    },
    voucherClaim: {
      findFirst: mockFindFirst,
      findMany: mockFindMany,
      create: mock(async (args: { data: Record<string, unknown> }) => ({
        id: "claim-1",
        ...args.data,
      })),
      update: mock(async (args: { data: Record<string, unknown> }) => ({
        id: "claim-1",
        ...args.data,
      })),
    },
    billingAccount: {
      findUnique: mock(async () => null),
      create: mock(async (args: { data: Record<string, unknown> }) => ({
        id: "ba-1",
        balance: new Prisma.Decimal(0),
        ...args.data,
      })),
      update: mock(async (args: { data: Record<string, unknown> }) => ({
        id: "ba-1",
        ...args.data,
      })),
    },
    billingAdjustment: {
      create: mock(async (args: { data: Record<string, unknown> }) => ({
        id: "adj-1",
        ...args.data,
      })),
    },
    $transaction: mock(async (cb: (tx: Record<string, unknown>) => unknown) =>
      cb({
        voucher: {
          findUnique: mockFindUnique,
          findFirst: mockFindFirst,
          findUniqueOrThrow: mockFindUnique,
          update: mockUpdate,
          updateMany: mockUpdateMany,
        },
        voucherClaim: {
          findFirst: mockFindFirst,
          create: mock(async (args: { data: Record<string, unknown> }) => ({
            id: "claim-1",
            ...args.data,
          })),
          update: mock(async (args: { data: Record<string, unknown> }) => ({
            id: "claim-1",
            ...args.data,
          })),
        },
        billingAccount: {
          findUnique: mock(async () => ({
            id: "ba-1",
            organizationId: "org-1",
            balance: new Prisma.Decimal(0),
            currency: "IDR",
            status: "ACTIVE",
          })),
          create: mock(async (args: { data: Record<string, unknown> }) => ({
            id: "ba-1",
            ...args.data,
          })),
          update: mock(async (args: { data: Record<string, unknown> }) => ({
            id: "ba-1",
            ...args.data,
          })),
        },
        billingAdjustment: {
          create: mock(async (args: { data: Record<string, unknown> }) => ({
            id: "adj-1",
            ...args.data,
          })),
        },
      })
    ),
  }
}

type MockPrismaType = ReturnType<typeof createMockPrisma>

describe("VoucherService Comprehensive Tests", () => {
  describe("listPromotions", () => {
    it("lists promotions with filters", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findMany.mockResolvedValueOnce([
        { id: "p-1", code: "PROMO1", kind: "PRODUCT_PROMOTION" },
      ] as unknown as never)
      prisma.voucher.count.mockResolvedValueOnce(1)

      const service = new VoucherService(prisma as unknown as never)
      const res = await service.listPromotions({
        kind: "PRODUCT_PROMOTION",
        status: "ACTIVE",
        prefix: "PR",
        discountType: "PERCENTAGE",
        currencyPolicy: "MATCH_CURRENCY_ONLY",
        allowedPackageCode: "VPN",
        organizationId: "org-1",
      })

      expect(res.vouchers).toHaveLength(1)
      expect(res.total).toBe(1)
    })
  })

  describe("updatePromotion", () => {
    it("throws when voucher not found", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique.mockResolvedValueOnce(null)

      const service = new VoucherService(prisma as unknown as never)
      await expect(
        service.updatePromotion("v-404", { maxClaims: 10 })
      ).rejects.toThrow(VoucherNotFoundError)
    })

    it("throws when voucher is not a promotion", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique.mockResolvedValueOnce({
        id: "v-1",
        code: "CREDIT10",
        kind: "BALANCE_CREDIT",
      } as unknown as never)

      const service = new VoucherService(prisma as unknown as never)
      await expect(
        service.updatePromotion("v-1", { maxClaims: 10 })
      ).rejects.toThrow(VoucherNotAPromotionError)
    })

    it("throws when reducing maxClaims below claimedCount", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique.mockResolvedValueOnce({
        id: "v-1",
        code: "PROMO",
        kind: "PRODUCT_PROMOTION",
        claimedCount: 20,
        maxClaims: 50,
      } as unknown as never)

      const service = new VoucherService(prisma as unknown as never)
      await expect(
        service.updatePromotion("v-1", { maxClaims: 10 })
      ).rejects.toThrow(
        "Cannot reduce maxClaims below current claimedCount (20)"
      )
    })

    it("updates promotion fields successfully", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique.mockResolvedValueOnce({
        id: "v-1",
        code: "PROMO",
        kind: "PRODUCT_PROMOTION",
        claimedCount: 5,
        maxClaims: 50,
      } as unknown as never)
      prisma.voucher.update.mockResolvedValueOnce({
        id: "v-1",
        maxClaims: 100,
        name: "Updated Name",
      } as unknown as never)

      const service = new VoucherService(prisma as unknown as never)
      const res = await service.updatePromotion("v-1", {
        maxClaims: 100,
        amount: 0,
        currency: "IDR",
        discountType: "PERCENTAGE",
        discountValue: 20,
        discountCurrency: "IDR",
        currencyPolicy: "MATCH_CURRENCY_ONLY",
        firstCheckoutOnly: true,
        allowUpgrade: true,
        stackable: false,
        minimumOrderAmount: 10000,
        maximumDiscountAmount: 50000,
        allowedPackageCodes: ["VPN"],
        allowedPlanCodes: ["PRO"],
        allowedBillingPeriods: ["MONTHLY"],
        targetWorkosUserId: "usr-1",
        targetOrganizationId: "org-1",
        metadataJson: null,
      })

      expect(res.maxClaims).toBe(100)
    })
  })

  describe("publishVoucher", () => {
    it("throws when voucher not found", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique.mockResolvedValueOnce(null)

      const service = new VoucherService(prisma as unknown as never)
      await expect(service.publishVoucher("v-404")).rejects.toThrow(
        VoucherNotFoundError
      )
    })

    it("throws when voucher is already ACTIVE", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique.mockResolvedValueOnce({
        id: "v-1",
        code: "PROMO",
        status: "ACTIVE",
      } as unknown as never)

      const service = new VoucherService(prisma as unknown as never)
      await expect(service.publishVoucher("v-1")).rejects.toThrow(
        VoucherAlreadyPublishedError
      )
    })

    it("throws when voucher status is EXPIRED or DEPLETED", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique.mockResolvedValueOnce({
        id: "v-1",
        code: "PROMO",
        status: "EXPIRED",
      } as unknown as never)

      const service = new VoucherService(prisma as unknown as never)
      await expect(service.publishVoucher("v-1")).rejects.toThrow(
        VoucherNotPublishableError
      )
    })

    it("throws when voucher expiresAt is in the past", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique.mockResolvedValueOnce({
        id: "v-1",
        code: "PROMO",
        status: "DISABLED",
        expiresAt: new Date("2020-01-01"),
      } as unknown as never)

      const service = new VoucherService(prisma as unknown as never)
      await expect(service.publishVoucher("v-1")).rejects.toThrow(
        VoucherNotPublishableError
      )
    })

    it("validates PRODUCT_PROMOTION discount configuration", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique.mockResolvedValueOnce({
        id: "v-1",
        code: "PROMO",
        kind: "PRODUCT_PROMOTION",
        status: "DISABLED",
        expiresAt: new Date("2030-01-01"),
        discountType: "PERCENTAGE",
        discountValue: new Prisma.Decimal(150), // invalid > 100
        currencyPolicy: "MATCH_CURRENCY_ONLY",
      } as unknown as never)

      const service = new VoucherService(prisma as unknown as never)
      await expect(service.publishVoucher("v-1")).rejects.toThrow(
        VoucherDiscountConfigurationError
      )
    })

    it("publishes valid voucher successfully", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique.mockResolvedValueOnce({
        id: "v-1",
        code: "PROMO",
        kind: "PRODUCT_PROMOTION",
        status: "DISABLED",
        expiresAt: new Date("2030-01-01"),
        discountType: "PERCENTAGE",
        discountValue: new Prisma.Decimal(50),
        currencyPolicy: "MATCH_CURRENCY_ONLY",
      } as unknown as never)
      prisma.voucher.update.mockResolvedValueOnce({
        id: "v-1",
        status: "ACTIVE",
      } as unknown as never)

      const service = new VoucherService(prisma as unknown as never)
      const res = await service.publishVoucher("v-1")
      expect(res.status).toBe("ACTIVE")
    })
  })

  describe("disablePromotionVoucher", () => {
    it("disables a promotion voucher", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique.mockResolvedValueOnce({
        id: "v-1",
        code: "PROMO",
        kind: "PRODUCT_PROMOTION",
        status: "ACTIVE",
      } as unknown as never)
      prisma.voucher.update.mockResolvedValueOnce({
        id: "v-1",
        status: "DISABLED",
      } as unknown as never)

      const service = new VoucherService(prisma as unknown as never)
      const res = await service.disablePromotionVoucher("v-1")
      expect(res.status).toBe("DISABLED")
    })

    it("throws if already DISABLED", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique.mockResolvedValueOnce({
        id: "v-1",
        code: "PROMO",
        kind: "PRODUCT_PROMOTION",
        status: "DISABLED",
      } as unknown as never)

      const service = new VoucherService(prisma as unknown as never)
      await expect(service.disablePromotionVoucher("v-1")).rejects.toThrow(
        VoucherAlreadyDisabledError
      )
    })
  })

  describe("getPromotionClaims", () => {
    it("fetches claims with order details", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique.mockResolvedValueOnce({
        id: "v-1",
        code: "PROMO",
      } as unknown as never)
      prisma.voucherClaim.findMany.mockResolvedValueOnce([
        { id: "claim-1", voucherId: "v-1", order: { totalAmount: 100 } },
      ] as unknown as never)

      const service = new VoucherService(prisma as unknown as never)
      const claims = await service.getPromotionClaims("v-1")
      expect(claims).toHaveLength(1)
    })
  })
})
