import { describe, expect, it, mock, beforeEach } from "bun:test"
import { Prisma } from "@prisma/client"

const mockWithAuth = mock(async () => ({
  user: { id: "user-123", email: "test@example.com" },
  organizationId: "org-1",
}))

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

const mockPrisma = {
  billingAccount: {
    findUnique: mock(async () => ({
      id: "ba-1",
      organizationId: "org-1",
      currency: "USD",
      balance: new Prisma.Decimal("100.00"),
    })),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const { billingGateRoutes } = await import("./billing-gate.route")

const post = (body: unknown) =>
  billingGateRoutes.handle(
    new Request("http://localhost/deploy/billing-gate/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )

describe("billingGateRoutes /quote", () => {
  beforeEach(() => {
    mockWithAuth.mockClear()
    mockPrisma.billingAccount.findUnique.mockClear()
    mockPrisma.billingAccount.findUnique.mockResolvedValue({
      id: "ba-1",
      organizationId: "org-1",
      currency: "USD",
      balance: new Prisma.Decimal("100.00"),
    })
  })

  it("returns sufficient when balance covers the 24h buffer (happy path)", async () => {
    const res = await post({ billingMode: "PAYG", hourlyCost: 1, paygBufferHours: 24 })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      data: {
        gateApplies: boolean
        sufficient: boolean
        requiredBalance: string
        bufferHours: number
        topupUrl: string | null
      }
    }
    expect(body.ok).toBe(true)
    expect(body.data.gateApplies).toBe(true)
    expect(body.data.bufferHours).toBe(24)
    expect(body.data.requiredBalance).toBe("24")
    expect(body.data.sufficient).toBe(true)
    expect(body.data.topupUrl).toBeNull()
  })

  it("reports insufficient with shortfall + topup url (unhappy path)", async () => {
    const res = await post({ billingMode: "PAYG", hourlyCost: 10, paygBufferHours: 24 })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: { sufficient: boolean; shortfall: string; topupUrl: string | null }
    }
    expect(body.data.sufficient).toBe(false)
    expect(body.data.shortfall).toBe("140")
    expect(body.data.topupUrl).toBe("/console/billing/topup")
  })

  it("enforces the 24h minimum buffer even when a smaller value is requested", async () => {
    const res = await post({ billingMode: "PAYG", hourlyCost: 1, paygBufferHours: 1 })
    const body = (await res.json()) as { data: { bufferHours: number; requiredBalance: string } }
    expect(body.data.bufferHours).toBe(24)
    expect(body.data.requiredBalance).toBe("24")
  })

  it("rejects invalid hourly cost", async () => {
    const res = await post({ billingMode: "PAYG", hourlyCost: 0 })
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("INVALID_HOURLY_COST")
  })

  it("returns 402 when billing account is missing", async () => {
    mockPrisma.billingAccount.findUnique.mockResolvedValue(null as never)
    const res = await post({ billingMode: "PAYG", hourlyCost: 1 })
    expect(res.status).toBe(402)
    const body = (await res.json()) as { error: string; topupUrl: string }
    expect(body.error).toBe("BILLING_ACCOUNT_NOT_FOUND")
    expect(body.topupUrl).toBe("/console/billing/topup")
  })

  it("marks gate as not applicable for PACKAGE mode", async () => {
    const res = await post({ billingMode: "PACKAGE", hourlyCost: 5 })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { gateApplies: boolean; sufficient: boolean } }
    expect(body.data.gateApplies).toBe(false)
    expect(body.data.sufficient).toBe(true)
  })

  it("rejects unauthenticated requests", async () => {
    mockWithAuth.mockResolvedValueOnce({ user: null } as never)
    const res = await post({ billingMode: "PAYG", hourlyCost: 1 })
    expect(res.status).toBe(401)
  })
})
