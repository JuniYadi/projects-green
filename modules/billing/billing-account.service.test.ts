import { describe, expect, it, vi, beforeEach } from "bun:test"
import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"

// Define mockPrisma BEFORE vi.mock
const mockPrisma = {
  $transaction: vi.fn(),
  tenant: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  billingAccount: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
}

// Mock prisma BEFORE importing the module
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma as unknown as PrismaClient,
}))

import { ensureBillingAccountForOrg } from "./billing-account.service"

const mockGetOrganizationAction = vi.fn()

describe("ensureBillingAccountForOrg", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns existing billing account when it exists", async () => {
    const existingTenant = { id: "tenant-1", code: "org_123", name: "My Org", createdAt: new Date(), updatedAt: new Date(), isActive: true }
    const existingAccount = {
      id: "acc-1",
      organizationId: "tenant-1",
      organizationId: "org_123",
      balance: new Prisma.Decimal(100_000),
      currency: "USD",
      timezone: "UTC",
      status: "ACTIVE" as const,
      metadataJson: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      tenant: existingTenant,
    }
    const orgFromWorkOS = { id: "org_123", name: "My Org" }

    // WorkOS call happens BEFORE transaction (but tenant exists, so name is unused)
    mockGetOrganizationAction.mockResolvedValue(orgFromWorkOS)
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      return fn(mockPrisma)
    })
    mockPrisma.tenant.findUnique.mockResolvedValue(existingTenant)
    mockPrisma.billingAccount.findUnique.mockResolvedValue(existingAccount)

    const result = await ensureBillingAccountForOrg({
      organizationId: "org_123",
      getOrganizationAction: mockGetOrganizationAction,
    })

    expect(result).toMatchObject({
      id: existingAccount.id,
      organizationId: existingAccount.organizationId,
      organizationId: existingAccount.organizationId,
    })
    expect(mockGetOrganizationAction).toHaveBeenCalledWith("org_123")
    expect(mockPrisma.tenant.findUnique).toHaveBeenCalled()
    expect(mockPrisma.tenant.create).not.toHaveBeenCalled()
    expect(mockPrisma.billingAccount.create).not.toHaveBeenCalled()
  })

  it("creates both Tenant and BillingAccount when both are missing", async () => {
    const newTenant = { id: "tenant-1", code: "org_123", name: "My Org", createdAt: new Date(), updatedAt: new Date(), isActive: true }
    const newAccount = {
      id: "acc-1",
      organizationId: "tenant-1",
      organizationId: "org_123",
      balance: new Prisma.Decimal(0),
      currency: "USD",
      timezone: "UTC",
      status: "ACTIVE" as const,
      metadataJson: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      tenant: newTenant,
    }
    const orgFromWorkOS = { id: "org_123", name: "My Org" }

    // WorkOS call happens BEFORE transaction
    mockGetOrganizationAction.mockResolvedValue(orgFromWorkOS)
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      return fn(mockPrisma)
    })
    mockPrisma.tenant.findUnique.mockResolvedValue(null)
    mockPrisma.tenant.create.mockResolvedValue(newTenant)
    mockPrisma.billingAccount.findUnique.mockResolvedValue(null)
    mockPrisma.billingAccount.create.mockResolvedValue(newAccount)

    const result = await ensureBillingAccountForOrg({
      organizationId: "org_123",
      getOrganizationAction: mockGetOrganizationAction,
    })

    expect(result).toMatchObject({
      id: newAccount.id,
      organizationId: newAccount.organizationId,
      organizationId: newAccount.organizationId,
    })
    expect(mockGetOrganizationAction).toHaveBeenCalledWith("org_123")
    expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { code: "org_123" },
    })
    expect(mockPrisma.tenant.create).toHaveBeenCalledWith({
      data: { code: "org_123", name: "My Org", isActive: true },
    })
    expect(mockPrisma.billingAccount.findUnique).toHaveBeenCalledWith({
      where: { organizationId: "org_123" },
      include: { tenant: true },
    })
    expect(mockPrisma.billingAccount.create).toHaveBeenCalledWith({
      data: {
        organizationId: "tenant-1",
        organizationId: "org_123",
        balance: expect.anything(),
        currency: "USD",
        timezone: "UTC",
        status: "ACTIVE",
      },
      include: { tenant: true },
    })
  })

  it("creates only BillingAccount when Tenant already exists", async () => {
    const existingTenant = { id: "tenant-1", code: "org_123", name: "My Org", createdAt: new Date(), updatedAt: new Date(), isActive: true }
    const newAccount = {
      id: "acc-1",
      organizationId: "tenant-1",
      organizationId: "org_123",
      balance: new Prisma.Decimal(0),
      currency: "USD",
      timezone: "UTC",
      status: "ACTIVE" as const,
      metadataJson: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      tenant: existingTenant,
    }
    const orgFromWorkOS = { id: "org_123", name: "My Org" }

    // WorkOS call happens BEFORE transaction (but tenant exists, so name is unused)
    mockGetOrganizationAction.mockResolvedValue(orgFromWorkOS)
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      return fn(mockPrisma)
    })
    mockPrisma.tenant.findUnique.mockResolvedValue(existingTenant)
    mockPrisma.billingAccount.findUnique.mockResolvedValue(null)
    mockPrisma.billingAccount.create.mockResolvedValue(newAccount)

    const result = await ensureBillingAccountForOrg({
      organizationId: "org_123",
      getOrganizationAction: mockGetOrganizationAction,
    })

    expect(result).toMatchObject({
      id: newAccount.id,
      organizationId: newAccount.organizationId,
      organizationId: newAccount.organizationId,
    })
    expect(mockGetOrganizationAction).toHaveBeenCalledWith("org_123")
    expect(mockPrisma.tenant.create).not.toHaveBeenCalled()
    expect(mockPrisma.billingAccount.create).toHaveBeenCalled()
  })

  it("throws when WorkOS org lookup fails", async () => {
    // WorkOS call happens BEFORE transaction, so transaction should never be called
    mockGetOrganizationAction.mockRejectedValue(new Error("Network timeout"))
    // Ensure transaction is NOT called
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
