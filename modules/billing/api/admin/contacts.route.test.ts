import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import type { MockAuthContext } from "@/test/helpers/test-auth"
import {
  defaultAuth,
  mockPlatformRole,
  mockPlatformRoleNone,
} from "@/test/helpers/test-auth"

const mockBillingAccountFindUnique = mock()

const mockPrismaClient = {
  billingAccount: {
    findUnique: mockBillingAccountFindUnique,
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))

// Test boundary requires static import after mock.module setup
import { createAdminBillingContactsRoutes } from "./contacts.route"

describe("AdminBillingContactsRoute", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  describe("GET /admin/billing/orgs/:orgId/contacts", () => {
    const validOrgId = "550e8400-e29b-41d4-a716-446655440000"

    it("returns 401 when no auth user", async () => {
      const app = new Elysia()
        .use(
          createAdminBillingContactsRoutes({
            authenticate: async () => ({ user: null }) as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request(
          `http://localhost/admin/billing/orgs/${validOrgId}/contacts`
        )
      )

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when role is not super_admin", async () => {
      const app = new Elysia()
        .use(
          createAdminBillingContactsRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRoleNone,
          })
        )
        .compile()

      const response = await app.handle(
        new Request(
          `http://localhost/admin/billing/orgs/${validOrgId}/contacts`
        )
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 422 when orgId is not a valid UUID", async () => {
      const app = new Elysia()
        .use(
          createAdminBillingContactsRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/billing/orgs/invalid-uuid/contacts")
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("returns 404 when billing account is not found", async () => {
      mockBillingAccountFindUnique.mockResolvedValueOnce(null)

      const app = new Elysia()
        .use(
          createAdminBillingContactsRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request(
          `http://localhost/admin/billing/orgs/${validOrgId}/contacts`
        )
      )

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns billing contacts when account exists", async () => {
      const mockAccount = {
        id: "ba-123",
        organizationId: validOrgId,
        contacts: [
          {
            id: "contact-1",
            billingAccountId: "ba-123",
            name: "Accounting",
            email: "accounting@example.com",
            phone: "+62812345678",
            role: "PRIMARY",
            isInvoiceRecipient: true,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
      }

      mockBillingAccountFindUnique.mockResolvedValueOnce(mockAccount)

      const app = new Elysia()
        .use(
          createAdminBillingContactsRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request(
          `http://localhost/admin/billing/orgs/${validOrgId}/contacts`
        )
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.id).toBe("ba-123")
      expect(body.organizationId).toBe(validOrgId)
      expect(body.contacts).toHaveLength(1)
      expect(body.contacts[0].email).toBe("accounting@example.com")
    })
  })
})
