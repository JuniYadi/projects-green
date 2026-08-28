import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import type { PlatformAccessRole } from "@/lib/platform-role"

// ── Mock AuthKit and Platform Role for admin guard ──────

const mockAuth: {
  user: { id: string; email: string } | null
  organizationId: string | null
} = {
  user: { id: "admin_user_1", email: "admin@example.com" },
  organizationId: "org_admin",
}

let mockPlatformRole: PlatformAccessRole = "super_admin"

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mock(async () => mockAuth),
}))

mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: mock(async () => mockPlatformRole),
}))

const mockRenderEmailTemplate = mock()

mock.module("@/lib/email-templates", () => ({
  EMAIL_TEMPLATES: [
    {
      id: "invoice-created",
      name: "Invoice Created",
      category: "Invoice",
      subject: "Invoice {{invoiceNumber}} - Payment Due {{dueAt}}",
      from: "billing@yourapp.com",
    },
    {
      id: "ticket-created",
      name: "Ticket Created",
      category: "Support",
      subject: "Your support ticket #{{ticketNumber}} has been created",
      from: "support@yourapp.com",
    },
  ],
  renderEmailTemplate: mockRenderEmailTemplate,
}))

// Test seam: dynamic import after mock.module to ensure mock resolution
const { emailTemplateRoutes } = await import("./email-templates.route")

describe("emailTemplateRoutes", () => {
  const app = new Elysia().use(emailTemplateRoutes).compile()

  beforeEach(() => {
    mockAuth.user = { id: "admin_user_1", email: "admin@example.com" }
    mockAuth.organizationId = "org_admin"
    mockPlatformRole = "super_admin"

    mockRenderEmailTemplate.mockReset()
  })

  describe("GET /email-templates", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockAuth.user = null

      const res = await app.handle(
        new Request("http://localhost/email-templates")
      )

      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when user is not super_admin", async () => {
      mockPlatformRole = "none"

      const res = await app.handle(
        new Request("http://localhost/email-templates")
      )

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("FORBIDDEN")
    })

    it("returns 200 with list of email templates for super admin", async () => {
      const res = await app.handle(
        new Request("http://localhost/email-templates")
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.data).toHaveLength(2)
      expect(json.data[0].id).toBe("invoice-created")
      expect(json.data[1].id).toBe("ticket-created")
    })
  })

  describe("GET /email-templates/:id/preview", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockAuth.user = null

      const res = await app.handle(
        new Request("http://localhost/email-templates/invoice-created/preview")
      )

      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when user is not super_admin", async () => {
      mockPlatformRole = "none"

      const res = await app.handle(
        new Request("http://localhost/email-templates/invoice-created/preview")
      )

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("FORBIDDEN")
    })

    it("returns 404 when template id is not found in catalog", async () => {
      const res = await app.handle(
        new Request("http://localhost/email-templates/nonexistent-id/preview")
      )

      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("NOT_FOUND")
      expect(json.message).toBe("Template not found")
    })

    it("returns 200 with rendered HTML when template exists", async () => {
      const renderedHtml = "<html><body><h1>Invoice Created</h1></body></html>"
      mockRenderEmailTemplate.mockResolvedValueOnce(renderedHtml)

      const res = await app.handle(
        new Request("http://localhost/email-templates/invoice-created/preview")
      )

      expect(res.status).toBe(200)
      expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8")
      const text = await res.text()
      expect(text).toBe(renderedHtml)
      expect(mockRenderEmailTemplate).toHaveBeenCalledWith("invoice-created")
    })
  })
})
