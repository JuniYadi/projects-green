import { describe, it, expect, mock, beforeAll } from "bun:test"
import { Elysia } from "elysia"

process.env.ENCRYPTION_KEY = "0000000000000000000000000000000000000000000000000000000000000000"

const mockWithAuth = mock(() => Promise.resolve({ organizationId: "org-123", email: "a", name: "b" }))

mock.module("@workos-inc/authkit-nextjs", () => ({ withAuth: mockWithAuth }))

const mockFindUnique = mock((args: unknown) => {
  console.log("DIAG: findUnique called with", JSON.stringify(args))
  return Promise.resolve({ code: "USD", symbol: "$", ratePerBase: { toNumber: () => 1 } })
})

const mockPrisma = {
  billingInvoice: { create: mock(() => Promise.resolve({})), update: mock(() => Promise.resolve({})), findFirst: mock(() => Promise.resolve(null)), findUnique: mock(() => Promise.resolve(null)), findMany: mock(() => Promise.resolve([])) },
  billingAccount: { findUnique: mock(() => Promise.resolve({ id: "ba-123", organizationId: "org-123", currency: "IDR", balance: { toNumber: () => 0 } })), create: mock(() => Promise.resolve({})) },
  paymentGateway: { findFirst: mock(() => Promise.resolve(null)), findMany: mock(() => Promise.resolve([])) },
  paymentBankAccount: { findMany: mock(() => Promise.resolve([])) },
  paymentCurrency: { findUnique: mockFindUnique, findFirst: mock(() => Promise.resolve({ code: "USD", symbol: "$", ratePerBase: { toNumber: () => 1 } })) },
  $transaction: mock((arg: unknown) => typeof arg === "function" ? Promise.resolve(arg(mockPrisma)) : Promise.resolve()),
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

// Use dynamic import instead of static import
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let createTopupRoutes: any
beforeAll(async () => {
  const mod = await import("./topup.route")
  createTopupRoutes = mod.createTopupRoutes
})

describe("diag", () => {
  it("works", async () => {
    const app = new Elysia().use(createTopupRoutes()).compile()
    const res = await app.handle(new Request("http://localhost/topup/methods"))
    console.log("DIAG: STATUS:", res.status)
    const text = await res.text()
    console.log("DIAG: BODY:", text.substring(0, 1000))
    expect(res.status).toBe(200)
  })
})
