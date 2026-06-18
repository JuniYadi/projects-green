import { describe, expect, it, mock } from "bun:test"
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
} from "./vouchers.errors"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockPrisma = any

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
    $transaction: mock((fn: (tx: ReturnType<typeof createMockTx>) => unknown) => {
      return fn(createMockTx())
    }) as never,
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
        VoucherNotFoundError,
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
  })

  // ─── disableVoucher ───────────────────────────────────────────────────

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
        VoucherNotFoundError,
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
        balance: { toString: () => "0", plus: () => ({ toString: () => "50000", gt: () => false, toFixed: () => "50000" }) },
        currency: "IDR",
      })) as never

      const prisma = createMockPrisma()
      prisma.$transaction = mock((fn: (tx: ReturnType<typeof createMockTx>) => unknown) =>
        fn(tx),
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
      prisma.$transaction = mock((fn: (tx: ReturnType<typeof createMockTx>) => unknown) =>
        fn(tx),
      )

      const service = new VoucherService(prisma as PrismaClient)
      await expect(
        service.redeemVoucher({
          code: "EXPIRED",
          workosUserId: "user_1",
          organizationId: "org_1",
        }),
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
      prisma.$transaction = mock((fn: (tx: ReturnType<typeof createMockTx>) => unknown) =>
        fn(tx),
      )

      const service = new VoucherService(prisma as PrismaClient)
      await expect(
        service.redeemVoucher({
          code: "DEPLETED",
          workosUserId: "user_1",
          organizationId: "org_1",
        }),
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
      prisma.$transaction = mock((fn: (tx: ReturnType<typeof createMockTx>) => unknown) =>
        fn(tx),
      )

      const service = new VoucherService(prisma as PrismaClient)
      await expect(
        service.redeemVoucher({
          code: "DISABLED1",
          workosUserId: "user_1",
          organizationId: "org_1",
        }),
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
      prisma.$transaction = mock((fn: (tx: ReturnType<typeof createMockTx>) => unknown) =>
        fn(tx),
      )

      const service = new VoucherService(prisma as PrismaClient)
      await expect(
        service.redeemVoucher({
          code: "TARGETED1",
          workosUserId: "other_user",
          organizationId: "org_1",
        }),
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
      prisma.$transaction = mock((fn: (tx: ReturnType<typeof createMockTx>) => unknown) =>
        fn(tx),
      )

      const service = new VoucherService(prisma as PrismaClient)
      await expect(
        service.redeemVoucher({
          code: "TARGETED2",
          workosUserId: "user_1",
          organizationId: "other_org",
        }),
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
      prisma.$transaction = mock((fn: (tx: ReturnType<typeof createMockTx>) => unknown) =>
        fn(tx),
      )

      const service = new VoucherService(prisma as PrismaClient)
      await expect(
        service.redeemVoucher({
          code: "DUPLICATE1",
          workosUserId: "user_1",
          organizationId: "org_1",
        }),
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
      prisma.$transaction = mock((fn: (tx: ReturnType<typeof createMockTx>) => unknown) =>
        fn(tx),
      )

      const service = new VoucherService(prisma as PrismaClient)
      await expect(
        service.redeemVoucher({
          code: "RACE",
          workosUserId: "user_1",
          organizationId: "org_1",
        }),
      ).rejects.toThrow(VoucherDepletedError)
    })

    it("rejects voucher not found", async () => {
      const tx = createMockTx()
      tx.voucher.findUnique = mock(() => null)

      const prisma = createMockPrisma()
      prisma.$transaction = mock((fn: (tx: ReturnType<typeof createMockTx>) => unknown) =>
        fn(tx),
      )

      const service = new VoucherService(prisma as PrismaClient)
      await expect(
        service.redeemVoucher({
          code: "NONEXIST",
          workosUserId: "user_1",
          organizationId: "org_1",
        }),
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
})
