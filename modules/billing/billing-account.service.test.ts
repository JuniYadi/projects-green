import { describe, expect, it, vi, beforeEach } from "bun:test"
import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"

const mockPrisma = {
  $transaction: vi.fn(),
  billingAccount: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  invoice: {
    findMany: vi.fn(),
  },
  billingAdjustment: {
    findMany: vi.fn(),
  },
  billingSubscription: {
    findMany: vi.fn(),
  },
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma as unknown as PrismaClient,
}))

import {
  ensureBillingAccountForOrg,
  isBillingAccountClean,
  updateBillingCurrencyIfClean,
} from "./billing-account.service"

const mockGetOrganizationAction = vi.fn()

describe("ensureBillingAccountForOrg", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns existing billing account when it exists", async () => {
    const existingAccount = {
      id: "acc-1",
      organizationId: "org_123",
      balance: new Prisma.Decimal(100_000),
      currency: "IDR",
      timezone: "UTC",
      status: "ACTIVE" as const,
      metadataJson: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const orgFromWorkOS = { id: "org_123", name: "My Org" }

    mockGetOrganizationAction.mockResolvedValue(orgFromWorkOS)
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      return fn(mockPrisma)
    })
    mockPrisma.billingAccount.findUnique.mockResolvedValue(existingAccount)

    const result = await ensureBillingAccountForOrg({
      organizationId: "org_123",
      getOrganizationAction: mockGetOrganizationAction,
    })

    expect(result).toMatchObject({
      id: existingAccount.id,
      organizationId: existingAccount.organizationId,
    })
    expect(mockGetOrganizationAction).toHaveBeenCalledWith("org_123")
    expect(mockPrisma.billingAccount.create).not.toHaveBeenCalled()
  })

  it("creates BillingAccount with IDR default when missing", async () => {
    const newAccount = {
      id: "acc-1",
      organizationId: "org_123",
      balance: new Prisma.Decimal(0),
      currency: "IDR",
      timezone: "UTC",
      status: "ACTIVE" as const,
      metadataJson: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const orgFromWorkOS = { id: "org_123", name: "My Org" }

    mockGetOrganizationAction.mockResolvedValue(orgFromWorkOS)
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      return fn(mockPrisma)
    })
    mockPrisma.billingAccount.findUnique.mockResolvedValue(null)
    mockPrisma.billingAccount.create.mockResolvedValue(newAccount)

    const result = await ensureBillingAccountForOrg({
      organizationId: "org_123",
      getOrganizationAction: mockGetOrganizationAction,
    })

    expect(result).toMatchObject({
      id: newAccount.id,
      organizationId: newAccount.organizationId,
    })
    expect(mockGetOrganizationAction).toHaveBeenCalledWith("org_123")
    expect(mockPrisma.billingAccount.findUnique).toHaveBeenCalledWith({
      where: { organizationId: "org_123" },
    })
    expect(mockPrisma.billingAccount.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org_123",
        balance: expect.anything(),
        currency: "IDR",
        timezone: "UTC",
        status: "ACTIVE",
      },
    })
  })

  it("creates BillingAccount with specified currency when provided", async () => {
    const newAccount = {
      id: "acc-2",
      organizationId: "org_456",
      balance: new Prisma.Decimal(0),
      currency: "USD",
      timezone: "UTC",
      status: "ACTIVE" as const,
      metadataJson: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const orgFromWorkOS = { id: "org_456", name: "My Org" }

    mockGetOrganizationAction.mockResolvedValue(orgFromWorkOS)
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      return fn(mockPrisma)
    })
    mockPrisma.billingAccount.findUnique.mockResolvedValue(null)
    mockPrisma.billingAccount.create.mockResolvedValue(newAccount)

    const result = await ensureBillingAccountForOrg({
      organizationId: "org_456",
      getOrganizationAction: mockGetOrganizationAction,
      currency: "USD",
    })

    expect(result.currency).toBe("USD")
    expect(mockPrisma.billingAccount.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org_456",
        balance: expect.anything(),
        currency: "USD",
        timezone: "UTC",
        status: "ACTIVE",
      },
    })
  })

  it("throws when WorkOS org lookup fails", async () => {
    mockGetOrganizationAction.mockRejectedValue(new Error("Network timeout"))
    mockPrisma.$transaction.mockImplementation(async () => {
      throw new Error("Transaction should not be called")
    })

    await expect(
      ensureBillingAccountForOrg({
        organizationId: "org_123",
        getOrganizationAction: mockGetOrganizationAction,
      }),
    ).rejects.toThrow("Failed to fetch organization org_123 from WorkOS")
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })
})

describe("isBillingAccountClean", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns true when account has no financial records and zero balance", async () => {
    mockPrisma.billingAccount.findUnique.mockResolvedValue({
      id: "ba_1",
      balance: new Prisma.Decimal(0),
      invoices: [],
      adjustments: [],
      subscriptions: [],
    })

    const result = await isBillingAccountClean(mockPrisma as unknown as PrismaClient, "ba_1")
    expect(result).toBe(true)
  })

  it("returns false when balance is non-zero", async () => {
    mockPrisma.billingAccount.findUnique.mockResolvedValue({
      id: "ba_1",
      balance: new Prisma.Decimal(1000),
      invoices: [],
      adjustments: [],
      subscriptions: [],
    })

    const result = await isBillingAccountClean(mockPrisma as unknown as PrismaClient, "ba_1")
    expect(result).toBe(false)
  })

  it("returns false when invoices exist", async () => {
    mockPrisma.billingAccount.findUnique.mockResolvedValue({
      id: "ba_1",
      balance: new Prisma.Decimal(0),
      invoices: [{ id: "inv_1" }],
      adjustments: [],
      subscriptions: [],
    })

    const result = await isBillingAccountClean(mockPrisma as unknown as PrismaClient, "ba_1")
    expect(result).toBe(false)
  })

  it("throws BILLING_ACCOUNT_NOT_FOUND when account missing", async () => {
    mockPrisma.billingAccount.findUnique.mockResolvedValue(null)

    await expect(
      isBillingAccountClean(mockPrisma as unknown as PrismaClient, "ba_missing"),
    ).rejects.toThrow("BILLING_ACCOUNT_NOT_FOUND")
  })
})

describe("updateBillingCurrencyIfClean", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("allows currency change while account is clean", async () => {
    // First call: updateBillingCurrencyIfClean finds the account
    mockPrisma.billingAccount.findUnique.mockResolvedValueOnce({
      id: "ba_1",
      organizationId: "org_1",
    })
    // Second call: isBillingAccountClean queries with includes
    mockPrisma.billingAccount.findUnique.mockResolvedValueOnce({
      id: "ba_1",
      balance: new Prisma.Decimal(0),
      invoices: [],
      adjustments: [],
      subscriptions: [],
    })
    mockPrisma.billingAccount.update.mockResolvedValue({
      id: "ba_1",
      organizationId: "org_1",
      currency: "USD",
    })

    const result = await updateBillingCurrencyIfClean(
      mockPrisma as unknown as PrismaClient,
      "org_1",
      "USD",
    )

    expect(result.currency).toBe("USD")
    expect(mockPrisma.billingAccount.update).toHaveBeenCalledWith({
      where: { id: "ba_1" },
      data: { currency: "USD" },
    })
  })

  it("rejects currency change when balance is non-zero", async () => {
    mockPrisma.billingAccount.findUnique.mockResolvedValueOnce({
      id: "ba_1",
      organizationId: "org_1",
    })
    mockPrisma.billingAccount.findUnique.mockResolvedValueOnce({
      id: "ba_1",
      balance: new Prisma.Decimal(50000),
      invoices: [],
      adjustments: [],
      subscriptions: [],
    })

    await expect(
      updateBillingCurrencyIfClean(mockPrisma as unknown as PrismaClient, "org_1", "USD"),
    ).rejects.toThrow("BILLING_CURRENCY_LOCKED")
  })

  it("rejects currency change when invoice exists", async () => {
    mockPrisma.billingAccount.findUnique.mockResolvedValueOnce({
      id: "ba_1",
      organizationId: "org_1",
    })
    mockPrisma.billingAccount.findUnique.mockResolvedValueOnce({
      id: "ba_1",
      balance: new Prisma.Decimal(0),
      invoices: [{ id: "inv_1" }],
      adjustments: [],
      subscriptions: [],
    })

    await expect(
      updateBillingCurrencyIfClean(mockPrisma as unknown as PrismaClient, "org_1", "USD"),
    ).rejects.toThrow("BILLING_CURRENCY_LOCKED")
  })
})
