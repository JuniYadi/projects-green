import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"

// ── Mock auth & platform-role ──────────────────────────

let mockAuthValue: {
  user: { id: string; email: string } | null
  organizationId?: string
} = {
  user: null,
}
let mockPlatformRoleValue: "super_admin" | "none" = "none"

const mockWithAuth = mock(async () => ({
  ...mockAuthValue,
  organizationId: mockAuthValue.user ? "org-123" : undefined,
}))
const mockGetPlatformRoleForUser = mock(async () => mockPlatformRoleValue)

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

const mockFindUnique = mock()
const mockUpdate = mock()
const mockUpdateMany = mock()
const mockDelete = mock()
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
    paymentBankAccount: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      update: mockUpdate,
      updateMany: mockUpdateMany,
      delete: mockDelete,
    },
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
    mockFindUnique.mockClear()
    mockUpdate.mockClear()
    mockUpdateMany.mockClear()
    mockDelete.mockClear()
    mockFindUnique.mockImplementation(() => Promise.resolve(null))
    mockUpdate.mockImplementation(() => Promise.resolve({}))
    mockUpdateMany.mockImplementation(() => Promise.resolve({ count: 0 }))
    mockDelete.mockImplementation(() => Promise.resolve({}))
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
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
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

describe("AdminBankRoute bank account mutations", () => {
  const account = {
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
  }

  beforeEach(() => {
    mockAuthValue = { user: { id: "super-1", email: "super@test.com" } }
    mockPlatformRoleValue = "super_admin"
    mockFindUnique.mockClear()
    mockUpdate.mockClear()
    mockUpdateMany.mockClear()
    mockDelete.mockClear()
    mockFindUnique.mockImplementation(() => Promise.resolve(null))
    mockUpdate.mockImplementation(() => Promise.resolve({}))
    mockUpdateMany.mockImplementation(() => Promise.resolve({ count: 0 }))
    mockDelete.mockImplementation(() => Promise.resolve({}))
  })

  it("sets a bank account as default", async () => {
    mockFindUnique.mockImplementation(() => Promise.resolve(account))
    mockUpdate.mockImplementation(() =>
      Promise.resolve({ ...account, isActive: true, isDefault: true })
    )

    const app = new Elysia().use(createAdminBankRoutes()).compile()
    const response = await app.handle(
      new Request("http://localhost/bank-accounts/ba-1/default", {
        method: "PATCH",
      })
    )

    expect(response.status).toBe(200)
    expect((await response.json()).isDefault).toBe(true)
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: { not: "ba-1" } },
      data: { isDefault: false },
    })
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "ba-1" },
      data: { isDefault: true, isActive: true },
    })
  })

  it("toggles only active state", async () => {
    mockFindUnique.mockImplementation(() => Promise.resolve(account))
    mockUpdate.mockImplementation(() =>
      Promise.resolve({ ...account, isActive: false })
    )

    const app = new Elysia().use(createAdminBankRoutes()).compile()
    const response = await app.handle(
      new Request("http://localhost/bank-accounts/ba-1/toggle", {
        method: "PATCH",
      })
    )

    expect(response.status).toBe(200)
    expect((await response.json()).isActive).toBe(false)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "ba-1" },
      data: { isActive: false },
    })
  })

  it("soft-deletes an account with payment confirmations", async () => {
    mockFindUnique.mockImplementation(() =>
      Promise.resolve({ ...account, _count: { paymentConfirmations: 1 } })
    )
    mockUpdate.mockImplementation(() =>
      Promise.resolve({ ...account, isActive: false, isDefault: false })
    )

    const app = new Elysia().use(createAdminBankRoutes()).compile()
    const response = await app.handle(
      new Request("http://localhost/bank-accounts/ba-1", { method: "DELETE" })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "ba-1" },
      data: { isActive: false, isDefault: false },
    })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it("hard-deletes an account without payment confirmations", async () => {
    mockFindUnique.mockImplementation(() =>
      Promise.resolve({ ...account, _count: { paymentConfirmations: 0 } })
    )

    const app = new Elysia().use(createAdminBankRoutes()).compile()
    const response = await app.handle(
      new Request("http://localhost/bank-accounts/ba-1", { method: "DELETE" })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "ba-1" } })
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
