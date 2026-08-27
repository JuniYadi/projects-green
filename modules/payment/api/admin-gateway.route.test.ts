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

// ── Mock GatewayService ─────────────────────────────────

const mockGatewayList = mock()
const mockGatewayCreate = mock()
const mockGatewayUpdate = mock()
const mockGatewayToggle = mock()

mock.module("../services/gateway.service", () => ({
  GatewayService: class {
    list = mockGatewayList
    create = mockGatewayCreate
    update = mockGatewayUpdate
    toggle = mockGatewayToggle
  },
}))

// ── Mock providers ──────────────────────────────────────

const mockListProviders = mock(() => [
  {
    id: "duitku",
    name: "Duitku",
    supportedCurrencies: ["IDR"],
    configFields: [
      {
        key: "merchantCode",
        type: "text",
        label: "Merchant Code",
        placeholder: "D1234",
        required: true,
        defaultValue: "",
        options: [],
      },
    ],
  },
])

mock.module("../providers", () => ({
  listProviders: mockListProviders,
}))

// ── Import route after mocks ────────────────────────────

const { createAdminGatewayRoutes } = await import("./admin-gateway.route")

function app() {
  return new Elysia().use(createAdminGatewayRoutes()).compile()
}

describe("AdminGatewayRoute", () => {
  beforeEach(() => {
    mockAuthValue = { user: null }
    mockPlatformRoleValue = "none"
    mockGatewayList.mockReset()
    mockGatewayCreate.mockReset()
    mockGatewayUpdate.mockReset()
    mockGatewayToggle.mockReset()
  })

  describe("GET /gateways", () => {
    it("returns 401 when unauthenticated", async () => {
      mockAuthValue = { user: null }

      const res = await app().handle(new Request("http://localhost/gateways"))

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

      const res = await app().handle(new Request("http://localhost/gateways"))

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("FORBIDDEN")
    })

    it("returns gateways list for super_admin", async () => {
      mockAuthValue = {
        user: { id: "u-admin", email: "admin@example.com" },
        organizationId: "org-admin",
      }
      mockPlatformRoleValue = "super_admin"
      mockGatewayList.mockResolvedValueOnce([
        { id: "gw-1", name: "Duitku Live", type: "duitku", isActive: true },
      ])

      const res = await app().handle(new Request("http://localhost/gateways"))

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(Array.isArray(json)).toBe(true)
      expect(json[0].name).toBe("Duitku Live")
      expect(mockGatewayList).toHaveBeenCalledWith(true)
    })
  })

  describe("POST /gateways", () => {
    it("creates a new gateway for super_admin", async () => {
      mockAuthValue = {
        user: { id: "u-admin", email: "admin@example.com" },
        organizationId: "org-admin",
      }
      mockPlatformRoleValue = "super_admin"
      const payload = {
        name: "Duitku Production",
        type: "duitku",
        config: {
          merchantCode: "M123",
          apiKey: "key123",
          sandboxUrl: "https://sandbox.duitku.com",
          productionUrl: "https://passport.duitku.com",
        },
        isDefault: true,
        supportedCurrencies: ["IDR"],
      }
      mockGatewayCreate.mockResolvedValueOnce({
        id: "gw-new",
        ...payload,
      })

      const res = await app().handle(
        new Request("http://localhost/gateways", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.id).toBe("gw-new")
      expect(mockGatewayCreate).toHaveBeenCalledWith(payload)
    })
  })

  describe("PUT /gateways/:id", () => {
    it("updates gateway for super_admin", async () => {
      mockAuthValue = {
        user: { id: "u-admin", email: "admin@example.com" },
        organizationId: "org-admin",
      }
      mockPlatformRoleValue = "super_admin"
      const updatePayload = {
        name: "Updated Duitku",
        isDefault: false,
      }
      mockGatewayUpdate.mockResolvedValueOnce({
        id: "gw-1",
        name: "Updated Duitku",
        isDefault: false,
      })

      const res = await app().handle(
        new Request("http://localhost/gateways/gw-1", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
        })
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.name).toBe("Updated Duitku")
      expect(mockGatewayUpdate).toHaveBeenCalledWith("gw-1", {
        name: "Updated Duitku",
        config: undefined,
        isDefault: false,
        supportedCurrencies: undefined,
      })
    })

    it("returns 500 when updating gateway fails with unexpected error", async () => {
      mockAuthValue = {
        user: { id: "u-admin", email: "admin@example.com" },
        organizationId: "org-admin",
      }
      mockPlatformRoleValue = "super_admin"
      mockGatewayUpdate.mockRejectedValueOnce(
        new Error("Database connection error")
      )

      const res = await app().handle(
        new Request("http://localhost/gateways/gw-1", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Updated Duitku" }),
        })
      )

      expect(res.status).toBe(500)
    })
  })

  describe("GET /gateways/providers", () => {
    it("returns list of supported providers with schema", async () => {
      mockAuthValue = {
        user: { id: "u-admin", email: "admin@example.com" },
        organizationId: "org-admin",
      }
      mockPlatformRoleValue = "super_admin"

      const res = await app().handle(
        new Request("http://localhost/gateways/providers")
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(Array.isArray(json)).toBe(true)
      expect(json[0].value).toBe("duitku")
      expect(json[0].label).toBe("Duitku")
      expect(json[0].configFields[0].key).toBe("merchantCode")
    })
  })

  describe("PATCH /gateways/:id/toggle", () => {
    it("toggles gateway status", async () => {
      mockAuthValue = {
        user: { id: "u-admin", email: "admin@example.com" },
        organizationId: "org-admin",
      }
      mockPlatformRoleValue = "super_admin"
      mockGatewayToggle.mockResolvedValueOnce({
        id: "gw-1",
        isActive: false,
      })

      const res = await app().handle(
        new Request("http://localhost/gateways/gw-1/toggle", {
          method: "PATCH",
        })
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.isActive).toBe(false)
      expect(mockGatewayToggle).toHaveBeenCalledWith("gw-1")
    })

    it("returns 500 when toggling gateway fails with unexpected error", async () => {
      mockAuthValue = {
        user: { id: "u-admin", email: "admin@example.com" },
        organizationId: "org-admin",
      }
      mockPlatformRoleValue = "super_admin"
      mockGatewayToggle.mockRejectedValueOnce(
        new Error("Database connection error")
      )

      const res = await app().handle(
        new Request("http://localhost/gateways/gw-1/toggle", {
          method: "PATCH",
        })
      )

      expect(res.status).toBe(500)
    })
  })
})
