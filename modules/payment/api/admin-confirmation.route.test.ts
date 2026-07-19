import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"

// ── Mock auth & platform-role ──────────────────────────

let mockAuthValue: {
  user: { id: string; email: string } | null
} = {
  user: null,
}
let mockPlatformRoleValue: "super_admin" | "none" = "none"

const mockWithAuth = mock(async () => mockAuthValue)
const mockGetPlatformRoleForUser = mock(async () => mockPlatformRoleValue)

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: mockGetPlatformRoleForUser,
}))

// ── Mock prisma ─────────────────────────────────────────

process.env.ENCRYPTION_KEY =
  "0000000000000000000000000000000000000000000000000000000000000000"

const mockPaymentConfirmationFindMany = mock()
const mockPrisma = {
  paymentConfirmation: {
    findMany: mockPaymentConfirmationFindMany,
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

// ── Import route after mocks ────────────────────────────

const { createAdminConfirmationRoutes } = await import(
  "./admin-confirmation.route"
)
function app() {
  return new Elysia().use(createAdminConfirmationRoutes()).compile()
}

// ── Tests ───────────────────────────────────────────────

describe("AdminConfirmationRoute GET /", () => {
  beforeEach(() => {
    mockAuthValue = { user: null }
    mockPlatformRoleValue = "none"
    mockPaymentConfirmationFindMany.mockClear()
  })

  it("returns 401 when user is not authenticated", async () => {
    mockAuthValue = { user: null }
    const res = await app()
      .handle(new Request("http://localhost/confirmations"))
      .then((r) => r.json())

    expect(res.ok).toBe(false)
    expect(res.error).toBe("UNAUTHORIZED")
  })

  it("returns 403 when user is not super_admin", async () => {
    mockAuthValue = { user: { id: "user-1", email: "user@test.com" } }
    mockPlatformRoleValue = "none"
    const res = await app()
      .handle(new Request("http://localhost/confirmations"))
      .then((r) => r.json())

    expect(res.ok).toBe(false)
    expect(res.error).toBe("FORBIDDEN")
  })

  it("returns confirmation array (not auth result) when authorized", async () => {
    mockAuthValue = { user: { id: "admin-1", email: "admin@test.com" } }
    mockPlatformRoleValue = "super_admin"

    const mockConfirmation = {
      id: "conf-1",
      amount: 50000,
      currency: "IDR",
      bankAccountId: "ba-1",
      bankAccount: {
        bankName: "BCA",
        accountName: "encrypted-name",
        accountNumber: "encrypted-num",
        currency: "IDR",
      },
      invoice: { currency: "IDR" },
      status: "PENDING",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      notes: null,
    }

    mockPaymentConfirmationFindMany.mockResolvedValue([mockConfirmation])

    const res = await app()
      .handle(new Request("http://localhost/confirmations"))
      .then((r) => r.json())

    // Must be an array, not { ok: true, user: ... }
    expect(Array.isArray(res)).toBe(true)
    expect(res).toHaveLength(1)
    expect(res[0].id).toBe("conf-1")
    expect(res[0].amount).toBe(50000)
    expect(res[0].currency).toBe("IDR")
  })
})
