import { describe, expect, it, vi, beforeEach } from "bun:test"
import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"

const mockPrisma = {
  $transaction: vi.fn(),
  billingAccount: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
}

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
    const existingAccount = {
      id: "acc-1",
      organizationId: "org_123",
      balance: new Prisma.Decimal(100_000),
      currency: "USD",
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

  it("creates BillingAccount when missing", async () => {
    const newAccount = {
      id: "acc-1",
      organizationId: "org_123",
      balance: new Prisma.Decimal(0),
      currency: "USD",
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
