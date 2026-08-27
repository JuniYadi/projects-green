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

const mockWithAuth = mock(async () => mockAuthValue)
const mockGetPlatformRoleForUser = mock(async () => mockPlatformRoleValue)

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
  getWorkOS: () => ({ organizations: {}, userManagement: {} }),
}))

mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: mockGetPlatformRoleForUser,
}))

// ── Import route after mocks ────────────────────────────

const { createAdminSettingsRoutes } = await import("./admin-settings.route")

function app() {
  return new Elysia().use(createAdminSettingsRoutes()).compile()
}

describe("AdminSettingsRoute", () => {
  beforeEach(() => {
    mockAuthValue = { user: null }
    mockPlatformRoleValue = "none"
    process.env.DEFAULT_PAYMENT_EXPIRY_DAYS = "7"
    process.env.AUTO_APPROVE_THRESHOLD = "50000"
  })

  describe("GET /portal/payments/settings", () => {
    it("returns 401 when unauthenticated", async () => {
      mockAuthValue = { user: null }

      const res = await app().handle(
        new Request("http://localhost/portal/payments/settings")
      )

      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when user is not super_admin", async () => {
      mockAuthValue = {
        user: { id: "u-1", email: "u@example.com" },
        organizationId: "org-1",
      }
      mockPlatformRoleValue = "none"

      const res = await app().handle(
        new Request("http://localhost/portal/payments/settings")
      )

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("FORBIDDEN")
    })

    it("returns settings values for super_admin", async () => {
      mockAuthValue = {
        user: { id: "u-admin", email: "admin@example.com" },
        organizationId: "org-admin",
      }
      mockPlatformRoleValue = "super_admin"

      const res = await app().handle(
        new Request("http://localhost/portal/payments/settings")
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.data.expiryDays).toBe(7)
      expect(json.data.autoApproveThreshold).toBe(50000)
    })
  })

  describe("PUT /portal/payments/settings", () => {
    it("returns 401 when unauthenticated", async () => {
      mockAuthValue = { user: null }

      const res = await app().handle(
        new Request("http://localhost/portal/payments/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiryDays: 14 }),
        })
      )

      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when user is not super_admin", async () => {
      mockAuthValue = {
        user: { id: "u-1", email: "u@example.com" },
        organizationId: "org-1",
      }
      mockPlatformRoleValue = "none"

      const res = await app().handle(
        new Request("http://localhost/portal/payments/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiryDays: 14 }),
        })
      )

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("FORBIDDEN")
    })

    it("returns 400 when expiryDays is invalid (out of 1-30 range)", async () => {
      mockAuthValue = {
        user: { id: "u-admin", email: "admin@example.com" },
        organizationId: "org-admin",
      }
      mockPlatformRoleValue = "super_admin"

      const res = await app().handle(
        new Request("http://localhost/portal/payments/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiryDays: 0 }),
        })
      )

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("VALIDATION_ERROR")
      expect(json.message).toBe("Expiry days must be 1-30")
    })

    it("updates settings successfully for super_admin with valid payload", async () => {
      mockAuthValue = {
        user: { id: "u-admin", email: "admin@example.com" },
        organizationId: "org-admin",
      }
      mockPlatformRoleValue = "super_admin"

      const res = await app().handle(
        new Request("http://localhost/portal/payments/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiryDays: 14 }),
        })
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.message).toBe("Settings updated")
    })
  })
})
