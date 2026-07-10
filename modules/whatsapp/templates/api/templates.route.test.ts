import { describe, expect, it, beforeEach, mock } from "bun:test"
import { Elysia } from "elysia"

import { setMockAuthContext } from "@/lib/whatsapp/__tests__/auth-mock"
import { workosNodeMock } from "@/test/workos-node-mock"

// ─── Prisma mock ────────────────────────────────────────────────────────────────

type MockTemplate = {
  id: string
  slug: string
  name: string
  description: string | null
  organizationId: string
  whatsappDeviceId: string | null
  syncStatus: string
  metaStatus: string | null
  lastSyncedAt: Date | null
  category: string | null
  createdAt: Date
  updatedAt: Date
  languages: Record<string, unknown>[]
}

const mockTemplateCreate = mock(async (): Promise<MockTemplate> => ({
  id: "tpl-1",
  slug: "hello_world",
  name: "Hello World",
  description: "A greeting template",
  organizationId: "org-1",
  whatsappDeviceId: null,
  syncStatus: "NOT_SYNCED",
  metaStatus: null,
  lastSyncedAt: null,
  category: "UTILITY",
  createdAt: new Date(),
  updatedAt: new Date(),
  languages: [],
}))

const mockTemplateUpdate = mock(async (): Promise<MockTemplate> => ({
  id: "tpl-1",
  slug: "hello_world",
  name: "Hello World Updated",
  description: "Updated description",
  organizationId: "org-1",
  whatsappDeviceId: null,
  syncStatus: "NOT_SYNCED",
  metaStatus: null,
  lastSyncedAt: null,
  category: "MARKETING",
  createdAt: new Date(),
  updatedAt: new Date(),
  languages: [],
}))

const mockTemplateFindUnique = mock(async (): Promise<MockTemplate> => ({
  id: "tpl-1",
  slug: "hello_world",
  name: "Hello World",
  description: "A greeting template",
  organizationId: "org-1",
  whatsappDeviceId: null,
  syncStatus: "NOT_SYNCED",
  metaStatus: null,
  lastSyncedAt: null,
  category: "UTILITY",
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

// Helper to build an approved template with one language
function approvedTemplate({
  langId = "lang-en-1",
  lang = "en",
  headerType = "NONE",
  headerText = "",
  headerUrl = "",
  body = "Hello {{1}}",
  footer = "",
  parameters = null,
  buttons = null,
} = {}) {
  return {
    id: "tpl-approved",
    slug: "approved_greeting",
    name: "Approved Greeting",
    description: "An approved template",
    organizationId: "org-1",
    whatsappDeviceId: null,
    syncStatus: "SYNCED" as const,
    metaStatus: "APPROVED" as const,
    lastSyncedAt: new Date(),
    category: "UTILITY" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    languages: [
      {
        id: langId,
        lang,
        headerType,
        headerText,
        headerUrl,
        body,
        footer,
        parameters,
        buttons,
        isApproved: true,
        metaStatus: "APPROVED",
        createdAt: new Date(),
        updatedAt: new Date(),
        whatsappTemplateId: "tpl-approved",
      },
    ],
  }
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
    mockTemplateFindUnique.mockClear()
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

    describe("approved template restrictions", () => {
      it("rejects core field update on approved template", async () => {
        mockTemplateFindUnique.mockImplementation(async () => approvedTemplate())

        const app = createTestApp()
        const body = { name: "Trying to rename" }

        const res = await app.handle(
          new Request("http://localhost/templates/tpl-approved", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        )

        expect(res.status).toBe(422)
        const json = await res.json()
        expect(json.error).toBe("VALIDATION_ERROR")
        expect(json.message).toBe("Approved templates can only add language variants.")
      })

      it("rejects editing existing language on approved template", async () => {
        mockTemplateFindUnique.mockImplementation(async () => approvedTemplate())

        const app = createTestApp()
        const body = {
          languages: [
            {
              id: "lang-en-1", // existing language id
              lang: "en",
              headerType: "NONE",
              body: "Modified body",
              footer: "",
            },
          ],
        }

        const res = await app.handle(
          new Request("http://localhost/templates/tpl-approved", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        )

        expect(res.status).toBe(422)
        const json = await res.json()
        expect(json.error).toBe("VALIDATION_ERROR")
        expect(json.message).toBe("Approved template language variants cannot be edited.")
      })

      it("rejects adding duplicate language to approved template", async () => {
        mockTemplateFindUnique.mockImplementation(async () => approvedTemplate())

        const app = createTestApp()
        const body = {
          languages: [
            {
              lang: "en", // same lang as existing
              headerType: "NONE",
              body: "Different body",
              footer: "",
            },
          ],
        }

        const res = await app.handle(
          new Request("http://localhost/templates/tpl-approved", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        )

        expect(res.status).toBe(422)
        const json = await res.json()
        expect(json.error).toBe("VALIDATION_ERROR")
        expect(json.message).toBe("Approved template language variants cannot be edited.")
      })

      it("rejects structure mismatch on new language for approved template", async () => {
        mockTemplateFindUnique.mockImplementation(async () =>
          approvedTemplate({ headerType: "TEXT", headerText: "Hello" })
        )

        const app = createTestApp()
        const body = {
          languages: [
            {
              lang: "id",
              headerType: "TEXT",
              headerText: "Different header", // mismatch with approved "Hello"
              body: "Body",
              footer: "",
            },
          ],
        }

        const res = await app.handle(
          new Request("http://localhost/templates/tpl-approved", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        )

        expect(res.status).toBe(422)
        const json = await res.json()
        expect(json.error).toBe("VALIDATION_ERROR")
        expect(json.message).toBe("New language variants must match the approved template structure.")
      })

      it("accepts new language variant with matching structure on approved template", async () => {
        const template = approvedTemplate({
          headerType: "TEXT",
          headerText: "Hello",
          body: "Get {{1}} off",
        })
        mockTemplateFindUnique.mockImplementation(async () => template)
        mockTemplateUpdate.mockImplementation(async () => ({
          ...template,
          languages: [
            ...template.languages,
            {
              id: "lang-id-new",
              lang: "id",
              headerType: "TEXT",
              headerText: "Hello",
              headerUrl: "",
              body: "Get {{1}} off",
              footer: "",
              parameters: null,
              buttons: null,
              isApproved: false,
              metaStatus: "PENDING",
              createdAt: new Date(),
              updatedAt: new Date(),
              whatsappTemplateId: "tpl-approved",
            },
          ],
        }))

        const app = createTestApp()
        const body = {
          languages: [
            {
              lang: "id",
              headerType: "TEXT",
              headerText: "Hello",
              body: "Get {{1}} off",
              footer: "",
            },
          ],
        }

        const res = await app.handle(
          new Request("http://localhost/templates/tpl-approved", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        )

        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.ok).toBe(true)
      })
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
