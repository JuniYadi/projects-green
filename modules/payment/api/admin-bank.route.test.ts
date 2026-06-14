import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"

// ── Mock auth & platform-role ──────────────────────────

let mockAuthValue: { user: { id: string; email: string } | null } = {
  user: null,
}
let mockPlatformRoleValue: "super_admin" | "none" = "none"

const mockWithAuth = mock(async () => mockAuthValue)
const mockGetPlatformRoleForUser = mock(
  async () => mockPlatformRoleValue
)

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
  getWorkOS: () => ({ organizations: {}, userManagement: {} }),
}))

mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: mockGetPlatformRoleForUser,
}))

// ── Mock prisma ────────────────────────────────────────
// Provide a valid 32-byte hex key so EncryptionService doesn't throw in tests.
process.env.ENCRYPTION_KEY =
  "0000000000000000000000000000000000000000000000000000000000000000"

const mockFindMany = mock()
mockFindMany.mockImplementation(() =>
  Promise.resolve([
    {
      id: "ba-1",
      bankCode: "014",
      bankName: "BCA",
      accountName: "enc_John",
      accountNumber: "enc_123456",
      currency: "IDR",
      supportedCurrencies: ["IDR"],
      swiftCode: null,
      bankAddress: null,
      isActive: true,
      isDefault: false,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ])
)

mock.module("@/lib/prisma", () => ({
  prisma: {
    paymentBankAccount: { findMany: mockFindMany },
  },
}))

// ── Import route after mocks ─────────────────────────

const { createAdminBankRoutes } = await import("./admin-bank.route")

describe("AdminBankRoute GET /bank-accounts", () => {
  beforeEach(() => {
    mockAuthValue = { user: null }
    mockPlatformRoleValue = "none"
    mockWithAuth.mockClear()
    mockGetPlatformRoleForUser.mockClear()
    mockFindMany.mockClear()
  })

  it("returns 401 when no auth token", async () => {
    const app = new Elysia().use(createAdminBankRoutes()).compile()

    const response = await app.handle(
      new Request("http://localhost/bank-accounts", { method: "GET" })
    )

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("returns 403 when authenticated but not super_admin", async () => {
    mockAuthValue = { user: { id: "user-1", email: "admin@test.com" } }
    mockPlatformRoleValue = "none"

    const app = new Elysia().use(createAdminBankRoutes()).compile()

    const response = await app.handle(
      new Request("http://localhost/bank-accounts", { method: "GET" })
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("FORBIDDEN")
    expect(body.policyCode).toBe("SUPER_ADMIN_REQUIRED")
  })

  it("returns 200 with bank accounts for super_admin", async () => {
    mockAuthValue = { user: { id: "super-1", email: "super@test.com" } }
    mockPlatformRoleValue = "super_admin"

    const app = new Elysia().use(createAdminBankRoutes()).compile()

    const response = await app.handle(
      new Request("http://localhost/bank-accounts", { method: "GET" })
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.data).toBeDefined()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBeGreaterThan(0)
    expect(mockFindMany).toHaveBeenCalled()
  })

  it("returns 403 for org admin (not super_admin) — guard is super_admin-only", async () => {
    mockAuthValue = { user: { id: "admin-1", email: "admin@org.com" } }
    mockPlatformRoleValue = "none"

    const app = new Elysia().use(createAdminBankRoutes()).compile()

    const response = await app.handle(
      new Request("http://localhost/bank-accounts", { method: "GET" })
    )

    expect(response.status).toBe(403)
    expect(mockFindMany).not.toHaveBeenCalled()
  })
})
