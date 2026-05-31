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
      tenantId: "tenant-1",
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
      tenantId: existingAccount.tenantId,
      organizationId: existingAccount.organizationId,
    })
    expect(mockPrisma.tenant.findUnique).toHaveBeenCalled()
    expect(mockPrisma.tenant.create).not.toHaveBeenCalled()
    expect(mockPrisma.billingAccount.create).not.toHaveBeenCalled()
  })

  it("creates both Tenant and BillingAccount when both are missing", async () => {
    const newTenant = { id: "tenant-1", code: "org_123", name: "My Org", createdAt: new Date(), updatedAt: new Date(), isActive: true }
    const newAccount = {
      id: "acc-1",
      tenantId: "tenant-1",
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

    mockPrisma.$transaction.mockImplementation(async (fn) => {
      return fn(mockPrisma)
    })
    mockPrisma.tenant.findUnique.mockResolvedValue(null)
    mockPrisma.tenant.create.mockResolvedValue(newTenant)
    mockPrisma.billingAccount.findUnique.mockResolvedValue(null)
    mockPrisma.billingAccount.create.mockResolvedValue(newAccount)
    mockGetOrganizationAction.mockResolvedValue(orgFromWorkOS)

    const result = await ensureBillingAccountForOrg({
      organizationId: "org_123",
      getOrganizationAction: mockGetOrganizationAction,
    })

    expect(result).toMatchObject({
      id: newAccount.id,
      tenantId: newAccount.tenantId,
      organizationId: newAccount.organizationId,
    })
    expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { code: "org_123" },
    })
    expect(mockPrisma.tenant.create).toHaveBeenCalledWith({
      data: { code: "org_123", name: "My Org" },
    })
    expect(mockPrisma.billingAccount.findUnique).toHaveBeenCalledWith({
      where: { organizationId: "org_123" },
      include: { tenant: true },
    })
    expect(mockPrisma.billingAccount.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        organizationId: "org_123",
        balance: expect.anything(),
        currency: "USD",
        timezone: "UTC",
      },
      include: { tenant: true },
    })
  })

  it("creates only BillingAccount when Tenant already exists", async () => {
    const existingTenant = { id: "tenant-1", code: "org_123", name: "My Org", createdAt: new Date(), updatedAt: new Date(), isActive: true }
    const newAccount = {
      id: "acc-1",
      tenantId: "tenant-1",
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
      tenantId: newAccount.tenantId,
      organizationId: newAccount.organizationId,
    })
    expect(mockPrisma.tenant.create).not.toHaveBeenCalled()
    expect(mockPrisma.billingAccount.create).toHaveBeenCalled()
  })

  it("throws when WorkOS org lookup fails", async () => {
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      return fn(mockPrisma)
    })
    mockPrisma.tenant.findUnique.mockResolvedValue(null)
    mockGetOrganizationAction.mockRejectedValue(new Error("Network timeout"))

    await expect(
      ensureBillingAccountForOrg({
        organizationId: "org_123",
        getOrganizationAction: mockGetOrganizationAction,
      }),
    ).rejects.toThrow("Failed to fetch organization org_123 from WorkOS")
  })
})
