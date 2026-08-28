import { describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"

import { VoucherService } from "./vouchers.service"
import {
  VoucherNotFoundError,
  VoucherExpiredError,
  VoucherDepletedError,
  VoucherDisabledError,
  VoucherAlreadyClaimedError,
  VoucherTargetUserMismatchError,
  VoucherTargetOrgMismatchError,
  VoucherKindFieldMismatchError,
  VoucherAlreadyPublishedError,
  VoucherNotPublishableError,
  VoucherNotAPromotionError,
  VoucherAlreadyDisabledError,
  VoucherDiscountConfigurationError,
} from "./vouchers.errors"

type MockPrisma = {
  voucher: Record<string, ReturnType<typeof mock>>
  voucherClaim: Record<string, ReturnType<typeof mock>>
  billingAccount: Record<string, ReturnType<typeof mock>>
  billingAdjustment: Record<string, ReturnType<typeof mock>>
  $transaction: ReturnType<typeof mock>
}

function createMockTx() {
  return {
    voucher: {
      findUnique: mock(() => null),
      findUniqueOrThrow: mock(() => {
        throw new Error("not found")
      }),
      update: mock(() => ({})),
      updateMany: mock(() => ({ count: 1 })),
    },
    voucherClaim: {
      findFirst: mock(() => null),
      create: mock(() => ({ id: "claim_1" })),
      update: mock(() => ({})),
    },
    billingAccount: {
      findUnique: mock(() => null),
      create: mock(() => ({ id: "ba_1" })),
      update: mock(() => ({})),
    },
    billingAdjustment: {
      create: mock(() => ({ id: "adj_1" })),
    },
  }
}

function createMockPrisma(): MockPrisma {
  return {
    $transaction: mock(
      (fn: (tx: ReturnType<typeof createMockTx>) => unknown) => {
        return fn(createMockTx())
      }
    ) as never,
    voucher: {
      findUnique: mock(() => null),
      findMany: mock(() => []),
      findUniqueOrThrow: mock(() => {
        throw new Error("not found")
      }),
      create: mock(() => ({})),
      update: mock(() => ({})),
      updateMany: mock(() => ({ count: 1 })),
      count: mock(() => 0),
    },
    voucherClaim: {
      findMany: mock(() => []),
      create: mock(() => ({})),
      update: mock(() => ({})),
    },
    billingAccount: {
      findUnique: mock(() => null),
      create: mock(() => ({})),
      update: mock(() => ({})),
    },
    billingAdjustment: {
      create: mock(() => ({})),
    },
  }
}

describe("VoucherService", () => {
  // ─── listVouchers ────────────────────────────────────────────────────

  describe("listVouchers", () => {
    it("returns paginated results", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findMany = mock(() => [
        { id: "v1", code: "TEST1" },
        { id: "v2", code: "TEST2" },
      ])
      prisma.voucher.count = mock(() => 2)

      const service = new VoucherService(prisma as PrismaClient)
      const result = await service.listVouchers({ limit: 10, offset: 0 })

      expect(result.vouchers).toHaveLength(2)
      expect(result.total).toBe(2)
    })

    it("filters by status", async () => {
      const prisma = createMockPrisma()
      const findMany = mock(() => [] as never[])
      prisma.voucher.findMany = findMany as never
      prisma.voucher.count = mock(() => 0) as never

      const service = new VoucherService(prisma as PrismaClient)
      await service.listVouchers({ status: "ACTIVE" })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where = (findMany.mock.calls[0] as any)?.[0]?.where
      expect(where?.status).toBe("ACTIVE")
    })

    it("filters by organizationId using OR filter on targetOrganizationId and claims", async () => {
      const prisma = createMockPrisma()
      const findMany = mock(() => [] as never[])
      const count = mock(() => 0)
      prisma.voucher.findMany = findMany as never
      prisma.voucher.count = count as never

      const service = new VoucherService(prisma as PrismaClient)
      await service.listVouchers({ organizationId: "org_1" })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const findManyWhere = (findMany.mock.calls[0] as any)?.[0]?.where
      expect(findManyWhere?.OR).toEqual([
        { targetOrganizationId: "org_1" },
        { claims: { some: { organizationId: "org_1" } } },
      ])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const countWhere = (count.mock.calls[0] as any)?.[0]?.where
      expect(countWhere?.OR).toEqual([
        { targetOrganizationId: "org_1" },
        { claims: { some: { organizationId: "org_1" } } },
      ])
    })
  })

  // ─── getVoucherById ───────────────────────────────────────────────────

  describe("getVoucherById", () => {
    it("returns voucher with claims when found", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique = mock(() => ({
        id: "v_1",
        code: "TEST1234",
        status: "ACTIVE",
        claims: [],
      }))

      const service = new VoucherService(prisma as PrismaClient)
      const result = await service.getVoucherById("v_1")

      expect(result.id).toBe("v_1")
      expect(result.code).toBe("TEST1234")
    })

    it("throws VoucherNotFoundError when not found", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique = mock(() => null)

      const service = new VoucherService(prisma as PrismaClient)
      await expect(service.getVoucherById("nonexistent")).rejects.toThrow(
        VoucherNotFoundError
      )
    })
  })

  // ─── createVoucher ────────────────────────────────────────────────────

  describe("createVoucher", () => {
    it("creates voucher with generated code", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.create = mock(() => ({
        id: "v_1",
        code: "TEST1234",
        prefix: null,
        status: "ACTIVE",
        maxClaims: 10,
        claimedCount: 0,
        metadataJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        currency: "IDR",
      }))
      prisma.voucher.findUniqueOrThrow = mock(() => ({
        id: "v_1",
        code: "TEST1234",
        prefix: null,
        status: "ACTIVE",
        maxClaims: 10,
        claimedCount: 0,
        metadataJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        currency: "IDR",
      }))

      const service = new VoucherService(prisma as PrismaClient)
      const result = await service.createVoucher({
        maxClaims: 10,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        amount: 50000,
        createdByWorkosUserId: "user_1",
      })

      expect(result.code).toBeTruthy()
      expect(result.code).toMatch(/^[A-Z0-9]{8}$/)
    })

    it("creates voucher with prefix", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.create = mock(() => ({
        id: "v_1",
        code: "PFN-ABC123",
        prefix: "PFN",
        status: "ACTIVE",
        maxClaims: 5,
        claimedCount: 0,
        metadataJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        currency: "IDR",
      }))
      prisma.voucher.findUniqueOrThrow = mock(() => ({
        id: "v_1",
        code: "PFN-ABC123",
        prefix: "PFN",
        status: "ACTIVE",
        maxClaims: 5,
        claimedCount: 0,
        metadataJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        currency: "IDR",
      }))

      const service = new VoucherService(prisma as PrismaClient)
      const result = await service.createVoucher({
        prefix: "PFN",
        maxClaims: 5,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        amount: 25000,
        createdByWorkosUserId: "user_1",
      })

      expect(result.code).toMatch(/^PFN-[A-Z0-9]{6}$/)
    })
    it("creates voucher with custom static code", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.create = mock(() => ({
        id: "v_custom",
        code: "DISCOUNT100",
        prefix: null,
        status: "ACTIVE",
        maxClaims: 100,
        claimedCount: 0,
        metadataJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        currency: "IDR",
      }))

      const service = new VoucherService(prisma as PrismaClient)
      const result = await service.createVoucher({
        code: "discount100",
        maxClaims: 100,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        amount: 100000,
        createdByWorkosUserId: "user_1",
      })

      expect(result.code).toBe("DISCOUNT100")
      expect(prisma.voucher.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: "DISCOUNT100",
          }),
        })
      )
    })

    it("persists an explicit disabled initial status", async () => {
      const prisma = createMockPrisma()
      let persistedData: Record<string, unknown> | undefined
      prisma.voucher.create = mock(
        (args: { data: Record<string, unknown> }) => {
          persistedData = args.data
          return { id: "v_1", code: "TEST1234" }
        }
      )
      prisma.voucher.findUniqueOrThrow = mock(() => ({
        id: "v_1",
        code: "TEST1234",
      }))

      const service = new VoucherService(prisma as PrismaClient)
      await service.createVoucher({
        maxClaims: 1,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        amount: 50000,
        status: "DISABLED",
        createdByWorkosUserId: "user_1",
      })

      expect(persistedData?.status).toBe("DISABLED")
    })
  })

  // ─── createPromotion ─────────────────────────────────────────────────

  describe("createPromotion", () => {
    it("persists product fields and the requested initial status", async () => {
      for (const status of ["DISABLED", "ACTIVE"] as const) {
        const prisma = createMockPrisma()
        let persistedData: Record<string, unknown> | undefined

        prisma.voucher.create = mock(
          (args: { data: Record<string, unknown> }) => {
            persistedData = args.data
            return { id: "promotion_1", code: "PROMO123" }
          }
        )
        prisma.voucher.findUniqueOrThrow = mock(() => ({
          id: "promotion_1",
          code: "PROMO123",
        }))

        const service = new VoucherService(prisma as PrismaClient)
        await service.createPromotion({
          maxClaims: 10,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          discountType: "PERCENTAGE",
          discountValue: 15,
          currencyPolicy: "MATCH_CURRENCY_ONLY",
          firstCheckoutOnly: true,
          allowUpgrade: true,
          stackable: false,
          minimumOrderAmount: 0,
          maximumDiscountAmount: 25000,
          allowedPackageCodes: ["VPN"],
          allowedPlanCodes: ["VPN_PRO"],
          allowedBillingPeriods: ["MONTHLY"],
          status,
          createdByWorkosUserId: "user_1",
        })

        expect(persistedData?.kind).toBe("PRODUCT_PROMOTION")
        expect(persistedData?.status).toBe(status)
        expect(
          (persistedData?.amount as { toString: () => string }).toString()
        ).toBe("0")
        expect(
          (
            persistedData?.discountValue as { toString: () => string }
          ).toString()
        ).toBe("15")
        expect(persistedData?.allowedPackageCodes).toEqual(["VPN"])
        expect(persistedData?.allowedPlanCodes).toEqual(["VPN_PRO"])
        expect(persistedData?.allowedBillingPeriods).toEqual(["MONTHLY"])
        expect(
          (
            persistedData?.minimumOrderAmount as {
              toString: () => string
            }
          ).toString()
        ).toBe("0")
        expect(
          (
            persistedData?.maximumDiscountAmount as {
              toString: () => string
            }
          ).toString()
        ).toBe("25000")
      }
    })

    it("creates promotion with custom static code", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.create = mock(() => ({
        id: "v_promo_custom",
        code: "MERDEKA80",
        prefix: null,
        status: "ACTIVE",
        kind: "PRODUCT_PROMOTION",
        discountType: "PERCENTAGE",
        discountValue: 80,
        maxClaims: 50,
        claimedCount: 0,
        metadataJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        currency: "IDR",
      }))

      const service = new VoucherService(prisma as PrismaClient)
      const result = await service.createPromotion({
        code: "merdeka80",
        maxClaims: 50,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        discountType: "PERCENTAGE",
        discountValue: 80,
        currencyPolicy: "MATCH_CURRENCY_ONLY",
        allowedPackageCodes: ["WHATSAPP"],
        allowedBillingPeriods: ["MONTHLY"],
        createdByWorkosUserId: "user_1",
      })

      expect(result.code).toBe("MERDEKA80")
    })
  })

  describe("disableVoucher", () => {
    it("disables an active voucher", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique = mock(() => ({
        id: "v_1",
        status: "ACTIVE",
        code: "TEST",
        prefix: null,
        maxClaims: 10,
        claimedCount: 0,
        metadataJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        currency: "IDR",
      }))
      prisma.voucher.update = mock(() => ({
        id: "v_1",
        status: "DISABLED",
        code: "TEST",
        prefix: null,
        maxClaims: 10,
        claimedCount: 0,
        metadataJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        currency: "IDR",
      }))

      const service = new VoucherService(prisma as PrismaClient)
      const result = await service.disableVoucher("v_1")

      expect(result.status).toBe("DISABLED")
    })

    it("throws VoucherNotFoundError if voucher does not exist", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique = mock(() => null)

      const service = new VoucherService(prisma as PrismaClient)
      await expect(service.disableVoucher("nonexistent")).rejects.toThrow(
        VoucherNotFoundError
      )
    })
  })

  // ─── redeemVoucher ────────────────────────────────────────────────────

  describe("redeemVoucher", () => {
    it("successfully redeems a valid voucher", async () => {
      const tx = createMockTx()
      const voucherRecord = {
        id: "v_1",
        code: "TEST1234",
        status: "ACTIVE",
        maxClaims: 10,
        claimedCount: 0,
        expiresAt: new Date(Date.now() + 86400000),
        amount: { toFixed: () => "50000" },
        currency: "IDR",
        targetWorkosUserId: null,
        targetOrganizationId: null,
      }

      const amountDecimal = { toString: () => "50000", toFixed: () => "50000" }

      tx.voucher.findUnique = mock(() => ({
        ...voucherRecord,
        amount: amountDecimal,
      })) as never
      tx.voucher.findUniqueOrThrow = mock(() => ({
        ...voucherRecord,
        amount: amountDecimal,
        claimedCount: 1,
        maxClaims: 10,
      })) as never
      tx.voucher.updateMany = mock(() => ({ count: 1 })) as never
      tx.voucherClaim.create = mock(() => ({ id: "claim_1" })) as never
      tx.billingAccount.findUnique = mock(() => ({
        id: "ba_1",
        balance: {
          toString: () => "0",
          plus: () => ({
            toString: () => "50000",
            gt: () => false,
            toFixed: () => "50000",
          }),
        },
        currency: "IDR",
      })) as never

      const prisma = createMockPrisma()
      prisma.$transaction = mock(
        (fn: (tx: ReturnType<typeof createMockTx>) => unknown) => fn(tx)
      )

      const service = new VoucherService(prisma as PrismaClient)
      const result = await service.redeemVoucher({
        code: "TEST1234",
        workosUserId: "user_1",
        organizationId: "org_1",
      })

      expect(result.voucherCode).toBe("TEST1234")
      expect(result.amount).toBe("50000")
    })

    it("rejects expired voucher", async () => {
      const tx = createMockTx()
      tx.voucher.findUnique = mock(() => ({
        id: "v_1",
        code: "EXPIRED",
        status: "ACTIVE",
        maxClaims: 10,
        claimedCount: 0,
        expiresAt: new Date(Date.now() - 86400000),
        amount: { toFixed: () => "50000" },
        currency: "IDR",
        targetWorkosUserId: null,
        targetOrganizationId: null,
      })) as never

      const prisma = createMockPrisma()
      prisma.$transaction = mock(
        (fn: (tx: ReturnType<typeof createMockTx>) => unknown) => fn(tx)
      )

      const service = new VoucherService(prisma as PrismaClient)
      await expect(
        service.redeemVoucher({
          code: "EXPIRED",
          workosUserId: "user_1",
          organizationId: "org_1",
        })
      ).rejects.toThrow(VoucherExpiredError)
    })

    it("rejects depleted voucher", async () => {
      const tx = createMockTx()
      tx.voucher.findUnique = mock(() => ({
        id: "v_1",
        code: "DEPLETED",
        status: "DEPLETED",
        maxClaims: 5,
        claimedCount: 5,
        expiresAt: new Date(Date.now() + 86400000),
        amount: { toFixed: () => "50000" },
        currency: "IDR",
        targetWorkosUserId: null,
        targetOrganizationId: null,
      })) as never

      const prisma = createMockPrisma()
      prisma.$transaction = mock(
        (fn: (tx: ReturnType<typeof createMockTx>) => unknown) => fn(tx)
      )

      const service = new VoucherService(prisma as PrismaClient)
      await expect(
        service.redeemVoucher({
          code: "DEPLETED",
          workosUserId: "user_1",
          organizationId: "org_1",
        })
      ).rejects.toThrow(VoucherDepletedError)
    })

    it("rejects disabled voucher", async () => {
      const tx = createMockTx()
      tx.voucher.findUnique = mock(() => ({
        id: "v_1",
        code: "DISABLED1",
        status: "DISABLED",
        maxClaims: 10,
        claimedCount: 0,
        expiresAt: new Date(Date.now() + 86400000),
        amount: { toFixed: () => "50000" },
        currency: "IDR",
        targetWorkosUserId: null,
        targetOrganizationId: null,
      })) as never

      const prisma = createMockPrisma()
      prisma.$transaction = mock(
        (fn: (tx: ReturnType<typeof createMockTx>) => unknown) => fn(tx)
      )

      const service = new VoucherService(prisma as PrismaClient)
      await expect(
        service.redeemVoucher({
          code: "DISABLED1",
          workosUserId: "user_1",
          organizationId: "org_1",
        })
      ).rejects.toThrow(VoucherDisabledError)
    })

    it("rejects target user mismatch", async () => {
      const tx = createMockTx()
      tx.voucher.findUnique = mock(() => ({
        id: "v_1",
        code: "TARGETED1",
        status: "ACTIVE",
        maxClaims: 10,
        claimedCount: 0,
        expiresAt: new Date(Date.now() + 86400000),
        amount: { toFixed: () => "50000" },
        currency: "IDR",
        targetWorkosUserId: "user_specific",
        targetOrganizationId: null,
      })) as never

      const prisma = createMockPrisma()
      prisma.$transaction = mock(
        (fn: (tx: ReturnType<typeof createMockTx>) => unknown) => fn(tx)
      )

      const service = new VoucherService(prisma as PrismaClient)
      await expect(
        service.redeemVoucher({
          code: "TARGETED1",
          workosUserId: "other_user",
          organizationId: "org_1",
        })
      ).rejects.toThrow(VoucherTargetUserMismatchError)
    })

    it("rejects target org mismatch", async () => {
      const tx = createMockTx()
      tx.voucher.findUnique = mock(() => ({
        id: "v_1",
        code: "TARGETED2",
        status: "ACTIVE",
        maxClaims: 10,
        claimedCount: 0,
        expiresAt: new Date(Date.now() + 86400000),
        amount: { toFixed: () => "50000" },
        currency: "IDR",
        targetWorkosUserId: null,
        targetOrganizationId: "org_specific",
      })) as never

      const prisma = createMockPrisma()
      prisma.$transaction = mock(
        (fn: (tx: ReturnType<typeof createMockTx>) => unknown) => fn(tx)
      )

      const service = new VoucherService(prisma as PrismaClient)
      await expect(
        service.redeemVoucher({
          code: "TARGETED2",
          workosUserId: "user_1",
          organizationId: "other_org",
        })
      ).rejects.toThrow(VoucherTargetOrgMismatchError)
    })

    it("rejects duplicate claim from same user", async () => {
      const tx = createMockTx()
      tx.voucher.findUnique = mock(() => ({
        id: "v_1",
        code: "DUPLICATE1",
        status: "ACTIVE",
        maxClaims: 10,
        claimedCount: 0,
        expiresAt: new Date(Date.now() + 86400000),
        amount: { toFixed: () => "50000" },
        currency: "IDR",
        targetWorkosUserId: null,
        targetOrganizationId: null,
      })) as never
      tx.voucherClaim.findFirst = mock(() => ({
        id: "existing_claim",
        voucherId: "v_1",
        workosUserId: "user_1",
      })) as never

      const prisma = createMockPrisma()
      prisma.$transaction = mock(
        (fn: (tx: ReturnType<typeof createMockTx>) => unknown) => fn(tx)
      )

      const service = new VoucherService(prisma as PrismaClient)
      await expect(
        service.redeemVoucher({
          code: "DUPLICATE1",
          workosUserId: "user_1",
          organizationId: "org_1",
        })
      ).rejects.toThrow(VoucherAlreadyClaimedError)
    })

    it("handles guarded update returning zero rows (race condition)", async () => {
      const tx = createMockTx()
      tx.voucher.findUnique = mock(() => ({
        id: "v_1",
        code: "RACE",
        status: "ACTIVE",
        maxClaims: 1,
        claimedCount: 0,
        expiresAt: new Date(Date.now() + 86400000),
        amount: { toFixed: () => "50000" },
        currency: "IDR",
        targetWorkosUserId: null,
        targetOrganizationId: null,
      })) as never
      tx.voucher.updateMany = mock(() => ({ count: 0 })) as never

      const prisma = createMockPrisma()
      prisma.$transaction = mock(
        (fn: (tx: ReturnType<typeof createMockTx>) => unknown) => fn(tx)
      )

      const service = new VoucherService(prisma as PrismaClient)
      await expect(
        service.redeemVoucher({
          code: "RACE",
          workosUserId: "user_1",
          organizationId: "org_1",
        })
      ).rejects.toThrow(VoucherDepletedError)
    })

    it("rejects voucher not found", async () => {
      const tx = createMockTx()
      tx.voucher.findUnique = mock(() => null)

      const prisma = createMockPrisma()
      prisma.$transaction = mock(
        (fn: (tx: ReturnType<typeof createMockTx>) => unknown) => fn(tx)
      )

      const service = new VoucherService(prisma as PrismaClient)
      await expect(
        service.redeemVoucher({
          code: "NONEXIST",
          workosUserId: "user_1",
          organizationId: "org_1",
        })
      ).rejects.toThrow(VoucherNotFoundError)
    })
  })

  // ─── getUserClaims ────────────────────────────────────────────────────

  describe("getUserClaims", () => {
    it("returns claims for a user with voucher data", async () => {
      const prisma = createMockPrisma()
      prisma.voucherClaim.findMany = mock(() => [
        {
          id: "claim_1",
          voucherId: "v_1",
          workosUserId: "user_1",
          organizationId: "org_1",
          billingAdjustmentId: null,
          claimedAt: new Date(),
          voucher: {
            code: "TEST1234",
            amount: { toFixed: () => "50000" },
            currency: "IDR",
          },
        },
      ])

      const service = new VoucherService(prisma as PrismaClient)
      const claims = await service.getUserClaims("user_1", "org_1")

      expect(claims).toHaveLength(1)
      expect(claims[0].voucher.code).toBe("TEST1234")
    })
  })

  // ─── updateVoucher ────────────────────────────────────────────────────

  describe("updateVoucher", () => {
    it("throws VoucherNotFoundError when voucher does not exist", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique = mock(() => null)

      const service = new VoucherService(prisma as PrismaClient)
      await expect(
        service.updateVoucher("missing", { maxClaims: 5 })
      ).rejects.toThrow(VoucherNotFoundError)
    })

    it("allows updating amount on a BALANCE_CREDIT voucher", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique = mock(() => ({
        id: "v_1",
        kind: "BALANCE_CREDIT",
        claimedCount: 0,
      }))
      prisma.voucher.update = mock(() => ({
        id: "v_1",
        kind: "BALANCE_CREDIT",
        amount: { toString: () => "75000" },
      }))

      const service = new VoucherService(prisma as PrismaClient)
      const result = await service.updateVoucher("v_1", { amount: 75000 })

      expect(result.id).toBe("v_1")
      expect(prisma.voucher.update).toHaveBeenCalled()
    })

    it("rejects amount field on a PRODUCT_PROMOTION voucher", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique = mock(() => ({
        id: "v_1",
        kind: "PRODUCT_PROMOTION",
        claimedCount: 0,
      }))

      const service = new VoucherService(prisma as PrismaClient)
      await expect(
        service.updateVoucher("v_1", { amount: 50000 })
      ).rejects.toThrow(VoucherKindFieldMismatchError)
    })

    it("rejects currency field on a PRODUCT_PROMOTION voucher", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique = mock(() => ({
        id: "v_1",
        kind: "PRODUCT_PROMOTION",
        claimedCount: 0,
      }))

      const service = new VoucherService(prisma as PrismaClient)
      await expect(
        service.updateVoucher("v_1", { currency: "USD" })
      ).rejects.toThrow(VoucherKindFieldMismatchError)
    })

    it("reports both amount and currency as invalid fields together", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique = mock(() => ({
        id: "v_1",
        kind: "PRODUCT_PROMOTION",
        claimedCount: 0,
      }))

      const service = new VoucherService(prisma as PrismaClient)
      try {
        await service.updateVoucher("v_1", {
          amount: 50000,
          currency: "IDR",
        })
        expect.unreachable("should have thrown")
      } catch (err) {
        expect(err).toBeInstanceOf(VoucherKindFieldMismatchError)
        expect((err as VoucherKindFieldMismatchError).invalidFields).toEqual([
          "amount",
          "currency",
        ])
      }
    })

    it("allows maxClaims and expiresAt on a PRODUCT_PROMOTION voucher", async () => {
      const prisma = createMockPrisma()
      prisma.voucher.findUnique = mock(() => ({
        id: "v_1",
        kind: "PRODUCT_PROMOTION",
        claimedCount: 2,
      }))
      prisma.voucher.update = mock(() => ({
        id: "v_1",
        kind: "PRODUCT_PROMOTION",
        maxClaims: 10,
      }))

      const service = new VoucherService(prisma as PrismaClient)
      const result = await service.updateVoucher("v_1", { maxClaims: 10 })

      expect(result.id).toBe("v_1")
      expect(prisma.voucher.update).toHaveBeenCalled()
    })
  })

  // ─── PROMOTION DOMAIN TESTS ──────────────────────────────────────────
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
})
