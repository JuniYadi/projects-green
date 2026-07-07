import { describe, expect, it, beforeEach, mock } from "bun:test"
import { Elysia } from "elysia"

import { setMockAuthContext } from "@/lib/whatsapp/__tests__/auth-mock"
import { workosNodeMock } from "@/test/workos-node-mock"

// ─── Prisma mock ────────────────────────────────────────────────────────────────

const mockTemplateCreate = mock(async () => ({
  id: "tpl-1",
  slug: "hello_world",
  name: "Hello World",
  description: "A greeting template",
  organizationId: "org-1",
  whatsappDeviceId: null,
  syncStatus: "NOT_SYNCED" as const,
  metaStatus: null,
  lastSyncedAt: null,
  category: "UTILITY" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  languages: [],
}))

const mockTemplateUpdate = mock(async () => ({
  id: "tpl-1",
  slug: "hello_world",
  name: "Hello World Updated",
  description: "Updated description",
  organizationId: "org-1",
  whatsappDeviceId: null,
  syncStatus: "NOT_SYNCED" as const,
  metaStatus: null,
  lastSyncedAt: null,
  category: "MARKETING" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  languages: [],
}))

const mockTemplateFindUnique = mock(async () => ({
  id: "tpl-1",
  slug: "hello_world",
  name: "Hello World",
  description: "A greeting template",
  organizationId: "org-1",
  whatsappDeviceId: null,
  syncStatus: "NOT_SYNCED" as const,
  metaStatus: null,
  lastSyncedAt: null,
  category: "UTILITY" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  languages: [],
}))

const mockLogAudit = mock(async () => {})

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappTemplate: {
      create: mockTemplateCreate,
      update: mockTemplateUpdate,
      findUnique: mockTemplateFindUnique,
    },
  },
}))

mock.module("@/modules/whatsapp/audit/whatsapp-audit.service", () => ({
  logWhatsappAuditEvent: mockLogAudit,
}))

mock.module("@workos-inc/node", () => workosNodeMock)

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: mock(async () => ({
    type: "workos" as const,
    userId: "user-1",
    email: "admin@example.com",
    organizationId: "org-1",
    orgRole: "admin" as const,
    platformRole: "none" as const,
    source: "proxy_header",
  })),
}))

const { templatesRoutes } = await import("./templates.route")

function createTestApp() {
  return new Elysia().use(templatesRoutes).compile()
}

describe("templatesRoutes", () => {
  beforeEach(() => {
    setMockAuthContext({
      type: "workos",
      userId: "user-1",
      email: "admin@example.com",
      organizationId: "org-1",
      orgRole: "admin",
      platformRole: "none",
    })
    mockTemplateCreate.mockClear()
    mockTemplateUpdate.mockClear()
    mockLogAudit.mockClear()
  })

  describe("POST /", () => {
    it("creates a template with category UTILITY", async () => {
      const app = createTestApp()

      const body = {
        slug: "hello_world",
        name: "Hello World",
        description: "A greeting template",
        category: "UTILITY",
        languages: [
          {
            lang: "en",
            headerType: "NONE",
            headerText: "",
            headerUrl: "",
            body: "Hello {{1}}",
            footer: "",
          },
        ],
      }

      const res = await app.handle(
        new Request("http://localhost/templates/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.template.name).toBe("Hello World")
      expect(json.template.category).toBe("UTILITY")
    })

    it("creates a template with MARKETING category", async () => {
      const app = createTestApp()

      const body = {
        slug: "promo_template",
        name: "Promo Template",
        category: "MARKETING",
        languages: [
          {
            lang: "en",
            headerType: "TEXT",
            headerText: "Sale!",
            headerUrl: "",
            body: "Get {{1}}% off",
            footer: "",
          },
        ],
      }

      const res = await app.handle(
        new Request("http://localhost/templates/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      )

      // Route accepts MARKETING value; mock returns fixed UTILITY
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.template).toBeDefined()
    })

    it("creates a template without category (optional)", async () => {
      const app = createTestApp()

      const body = {
        slug: "no_category",
        name: "No Category Template",
        languages: [
          {
            lang: "en",
            headerType: "NONE",
            headerText: "",
            headerUrl: "",
            body: "Hello",
            footer: "",
          },
        ],
      }

      const res = await app.handle(
        new Request("http://localhost/templates/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      )

      // Route accepts create without category; mock returns fixed data
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.template).toBeDefined()
    })

    it("rejects invalid category value", async () => {
      const app = createTestApp()

      const body = {
        slug: "bad_category",
        name: "Bad Category",
        category: "INVALID_CATEGORY",
        languages: [
          {
            lang: "en",
            headerType: "NONE",
            headerText: "",
            headerUrl: "",
            body: "Hello",
            footer: "",
          },
        ],
      }

      const res = await app.handle(
        new Request("http://localhost/templates/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      )

      // Elysia validation returns 422 for invalid body schema
      expect(res.status).toBe(422)
    })
  })

  describe("PATCH /:id", () => {
    it("updates template category to AUTHENTICATION", async () => {
      const app = createTestApp()

      const body = {
        category: "AUTHENTICATION",
      }

      const res = await app.handle(
        new Request("http://localhost/templates/tpl-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.template).toBeDefined()
    })

    it("updates template name and category together", async () => {
      const app = createTestApp()

      const body = {
        name: "Updated Name",
        category: "MARKETING",
      }

      const res = await app.handle(
        new Request("http://localhost/templates/tpl-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.template).toBeDefined()
    })
  })

  describe("category in DTO response", () => {
    it("returns category in template DTO on create", async () => {
      const app = createTestApp()

      const body = {
        slug: "dto_test",
        name: "DTO Test",
        category: "UTILITY",
        languages: [
          {
            lang: "en",
            headerType: "NONE",
            headerText: "",
            headerUrl: "",
            body: "Test",
            footer: "",
          },
        ],
      }

      const res = await app.handle(
        new Request("http://localhost/templates/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.template).toBeDefined()
      expect(json.template.category).toBe("UTILITY")
    })
  })
})
