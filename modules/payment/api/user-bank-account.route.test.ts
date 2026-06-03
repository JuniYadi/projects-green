import { describe, it, expect, beforeEach, mock, type Mock } from "bun:test"
import type { Elysia } from "elysia"

// Set env vars before any module evaluation triggers singletons
process.env.ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" // 64 hex / 32 bytes
process.env.DATABASE_URL = "postgresql://mock:mock@localhost:5432/mock"

type BankAccountShape = {
  id: string
  bankCode: string
  bankName: string
  accountName: string
  accountNumber: string
  isActive: boolean
  isDefault: boolean
}

// Mock withAuth
const mockWithAuth: Mock<(args?: unknown) => Promise<Record<string, unknown>>> =
  mock(() =>
    Promise.resolve({
      organizationId: "org-123",
      email: "test@example.com",
      name: "Test User",
      user: {
        id: "user-123",
        email: "test@example.com",
      },
    })
  )

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

// Mock platform role
const mockGetPlatformRole: Mock<
  (args?: unknown) => Promise<string>
> = mock(() => Promise.resolve("none"))

mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: mockGetPlatformRole,
}))

// Mock prisma
const mockBankAccountFindMany: Mock<
  (args?: unknown) => Promise<BankAccountShape[]>
> = mock(() => Promise.resolve([]))
const mockBankAccountFindUnique: Mock<
  (args?: unknown) => Promise<BankAccountShape | null>
> = mock(() => Promise.resolve(null))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockBankAccountUpdate: Mock<(args?: unknown) => Promise<any>> = mock(() =>
  Promise.resolve({})
)
const mockBankAccountUpdateMany: Mock<
  (args?: unknown) => Promise<{ count: number }>
> = mock(() => Promise.resolve({ count: 0 }))

mock.module("@/lib/prisma", () => ({
  prisma: {
    bankAccount: {
      findMany: mockBankAccountFindMany,
      findUnique: mockBankAccountFindUnique,
      update: mockBankAccountUpdate,
      updateMany: mockBankAccountUpdateMany,
    },
    $transaction: mock((fns: unknown[]) => Promise.all(fns)),
  },
}))

const createAccountFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "ba-123",
  bankCode: "BCA",
  bankName: "Bank Central Asia",
  accountName: "Test Account",
  accountNumber: "1234567890",
  isActive: true,
  isDefault: false,
  ...overrides,
})

describe("User Bank Account Routes", () => {
  let app: ReturnType<typeof Elysia.prototype.compile>

  beforeEach(async () => {
    mockWithAuth.mockClear()
    mockGetPlatformRole.mockClear()
    mockBankAccountFindMany.mockClear()
    mockBankAccountFindUnique.mockClear()
    mockBankAccountUpdate.mockClear()
    mockBankAccountUpdateMany.mockClear()

    const { Elysia } = await import("elysia")
    const { createUserBankAccountRoutes } = await import(
      "./user-bank-account.route"
    )

    const { Elysia: ElysiaImport } = await import("elysia")
    const elysiaApp: ReturnType<typeof ElysiaImport.prototype.compile> =
      (new ElysiaImport().use(createUserBankAccountRoutes()) as unknown as ReturnType<typeof ElysiaImport.prototype.compile>)
    app = elysiaApp
  })

  describe("GET /bank-accounts", () => {
    it("should return 401 when no user", async () => {
      ;(mockWithAuth as ReturnType<typeof mock>).mockResolvedValueOnce({
        user: null,
        organizationId: "org-123",
      })

      const response = await app.handle(
        new Request("http://localhost/bank-accounts")
      )

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("should return 403 when no organizationId", async () => {
      ;(mockWithAuth as ReturnType<typeof mock>).mockResolvedValueOnce({
        user: { id: "user-123", email: "test@example.com" },
        organizationId: null,
      })

      const response = await app.handle(
        new Request("http://localhost/bank-accounts")
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })

    it("should return bank accounts list on success", async () => {
      const accounts = [
        createAccountFixture({ id: "ba-1", bankCode: "BCA" }),
        createAccountFixture({ id: "ba-2", bankCode: "MANDIRI" }),
      ]
      mockBankAccountFindMany.mockResolvedValueOnce(accounts)

      const response = await app.handle(
        new Request("http://localhost/bank-accounts")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.accounts).toHaveLength(2)
      expect(body.accounts[0].id).toBe("ba-1")
      expect(body.accounts[1].id).toBe("ba-2")
    })
  })

  describe("PATCH /bank-accounts/:id/default", () => {
    it("should return 401 when no user", async () => {
      ;(mockWithAuth as ReturnType<typeof mock>).mockResolvedValueOnce({
        user: null,
        organizationId: "org-123",
      })

      const response = await app.handle(
        new Request("http://localhost/bank-accounts/ba-123/default", {
          method: "PATCH",
        })
      )

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("should return 403 when user is not super_admin", async () => {
      mockGetPlatformRole.mockResolvedValueOnce("none")

      const response = await app.handle(
        new Request("http://localhost/bank-accounts/ba-123/default", {
          method: "PATCH",
        })
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
      expect(body.message).toBe(
        "Admin access required to modify payment methods."
      )
    })

    it("should return 403 when no organizationId", async () => {
      mockGetPlatformRole.mockResolvedValueOnce("super_admin")
      ;(mockWithAuth as ReturnType<typeof mock>).mockResolvedValueOnce({
        user: { id: "user-123", email: "test@example.com" },
        organizationId: null,
      })

      const response = await app.handle(
        new Request("http://localhost/bank-accounts/ba-123/default", {
          method: "PATCH",
        })
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })

    it("should return 404 when account not found", async () => {
      mockGetPlatformRole.mockResolvedValueOnce("super_admin")
      mockBankAccountFindUnique.mockResolvedValueOnce(null)

      const response = await app.handle(
        new Request("http://localhost/bank-accounts/ba-999/default", {
          method: "PATCH",
        })
      )

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("should return 200 and updated account when super_admin patches", async () => {
      mockGetPlatformRole.mockResolvedValueOnce("super_admin")
      const existing = createAccountFixture({ isDefault: false })
      // Route's findById calls findUnique, then service's update() also calls findUnique
      mockBankAccountFindUnique.mockResolvedValueOnce(existing)
      mockBankAccountFindUnique.mockResolvedValueOnce(existing)
      const updated = createAccountFixture({ isDefault: true })
      mockBankAccountUpdate.mockResolvedValueOnce(updated)

      const response = await app.handle(
        new Request("http://localhost/bank-accounts/ba-123/default", {
          method: "PATCH",
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.account.isDefault).toBe(true)
    })
  })

  describe("DELETE /bank-accounts/:id", () => {
    it("should return 401 when no user", async () => {
      ;(mockWithAuth as ReturnType<typeof mock>).mockResolvedValueOnce({
        user: null,
        organizationId: "org-123",
      })

      const response = await app.handle(
        new Request("http://localhost/bank-accounts/ba-123", {
          method: "DELETE",
        })
      )

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("should return 403 when user is not super_admin", async () => {
      mockGetPlatformRole.mockResolvedValueOnce("none")

      const response = await app.handle(
        new Request("http://localhost/bank-accounts/ba-123", {
          method: "DELETE",
        })
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
      expect(body.message).toBe(
        "Admin access required to modify payment methods."
      )
    })

    it("should return 403 when no organizationId", async () => {
      mockGetPlatformRole.mockResolvedValueOnce("super_admin")
      ;(mockWithAuth as ReturnType<typeof mock>).mockResolvedValueOnce({
        user: { id: "user-123", email: "test@example.com" },
        organizationId: null,
      })

      const response = await app.handle(
        new Request("http://localhost/bank-accounts/ba-123", {
          method: "DELETE",
        })
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })

    it("should return 404 when account not found", async () => {
      mockGetPlatformRole.mockResolvedValueOnce("super_admin")
      mockBankAccountFindUnique.mockResolvedValueOnce(null)

      const response = await app.handle(
        new Request("http://localhost/bank-accounts/ba-999", {
          method: "DELETE",
        })
      )

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("should return 422 when trying to remove default account", async () => {
      mockGetPlatformRole.mockResolvedValueOnce("super_admin")
      const defaultAccount = createAccountFixture({ isDefault: true })
      mockBankAccountFindUnique.mockResolvedValueOnce(defaultAccount)

      const response = await app.handle(
        new Request("http://localhost/bank-accounts/ba-123", {
          method: "DELETE",
        })
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
      expect(body.message).toContain("default payment method")
    })

    it("should return 200 when super_admin deactivates non-default account", async () => {
      mockGetPlatformRole.mockResolvedValueOnce("super_admin")
      const account = createAccountFixture({ isDefault: false })
      // Route's findById calls findUnique, then service's update() also calls findUnique
      mockBankAccountFindUnique.mockResolvedValueOnce(account)
      mockBankAccountFindUnique.mockResolvedValueOnce(account)

      const response = await app.handle(
        new Request("http://localhost/bank-accounts/ba-123", {
          method: "DELETE",
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.message).toBe("Payment method removed successfully.")
      // Verify it updates with isActive: false (soft-delete, not toggle)
      expect(mockBankAccountFindUnique).toHaveBeenCalledTimes(2)

      const updateCallArgs = mockBankAccountUpdate.mock.calls[0]
        ? (mockBankAccountUpdate.mock.calls[0][0] as Record<string, unknown>)
        : null
      const updateData = updateCallArgs?.data as Record<string, unknown> | undefined
      expect(updateData?.isActive).toBe(false)
    })
  })
})
