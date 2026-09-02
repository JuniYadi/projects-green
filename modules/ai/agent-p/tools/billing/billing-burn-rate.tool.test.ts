import { beforeEach, describe, expect, it, mock } from "bun:test"
import { billingBurnRateTool } from "./billing-burn-rate.tool"
import type { AgentPContext } from "../../types"

const mockPrisma = {
  billingRatedUsage: {
    findMany: mock(),
  },
}
mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const context: AgentPContext = {
  session: { organizationId: "org-1", userId: "user-1", role: "USER" },
}

describe("billingBurnRateTool", () => {
  beforeEach(() => {
    mockPrisma.billingRatedUsage.findMany.mockReset()
  })

  it("has valid tool metadata", () => {
    expect(billingBurnRateTool.name).toBe("billing.burn_rate")
  })

  it("calculates burn rate over given days", async () => {
    mockPrisma.billingRatedUsage.findMany.mockResolvedValueOnce([
      { amount: 150000, currency: "IDR" },
      { amount: 150000, currency: "IDR" },
    ])

    const result = await billingBurnRateTool.execute({ days: 30 }, context)
    expect(result).toEqual({
      days: 30,
      total: 300000,
      averagePerDay: 10000,
      currency: "IDR",
    })
  })

  it("handles zero usage with default USD currency", async () => {
    mockPrisma.billingRatedUsage.findMany.mockResolvedValueOnce([])
    const result = await billingBurnRateTool.execute({ days: 10 }, context)
    expect(result).toEqual({
      days: 10,
      total: 0,
      averagePerDay: 0,
      currency: "USD",
    })
  })
})
