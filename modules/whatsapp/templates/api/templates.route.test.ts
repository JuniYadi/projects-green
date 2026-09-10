import { describe, expect, it, beforeEach, mock } from "bun:test"
import { Elysia } from "elysia"
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
const mockTemplateFindMany = mock(async () => [])
const mockTemplateCount = mock(async () => 0)
const mockTemplateDelete = mock(async () => ({ id: "tpl-1" }))
const mockEnqueueTemplateSync = mock(async () => {})
const mockSubscriptionFindFirst = mock(async () => ({
  id: "sub-1",
  organizationId: "org-1",
  status: "ACTIVE",
}))
const mockLogAudit = mock(async () => {})
const mockDeviceFindFirst = mock(async (): Promise<any> => ({
  id: "dev-1",
  tokenEncrypted: "encrypted-token",
  whatsappBusinessAccountId: "waba-1",
  whatsappPhoneId: "phone-1",
  organizationId: "org-1",
  status: "ACTIVE",
}))
const mockCreateMetaTemplate = mock(async () => ({
  id: "meta-tpl-1",
  status: "PENDING",
}))
const mockDeleteMetaTemplate = mock(async () => ({
  success: true,
}))
const mockDeviceFindUnique = mock(async (): Promise<any> => ({
  id: "dev-1",
  tokenEncrypted: "encrypted-token",
  whatsappBusinessAccountId: "waba-1",
  whatsappPhoneId: "phone-1",
  organizationId: "org-1",
  status: "ACTIVE",
}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappTemplate: {
      create: mockTemplateCreate,
      update: mockTemplateUpdate,
      findUnique: mockTemplateFindUnique,
      findMany: mockTemplateFindMany,
      count: mockTemplateCount,
      delete: mockTemplateDelete,
    },
    whatsappDevice: {
      findFirst: mockDeviceFindFirst,
      findUnique: mockDeviceFindUnique,
    },
    serviceSubscription: {
      findFirst: mockSubscriptionFindFirst,
    },
  },
}))
mock.module("@/lib/queue/whatsapp-template-sync", () => ({
  enqueueWhatsAppTemplateSync: mockEnqueueTemplateSync,
}))

mock.module("@/lib/whatsapp/meta-cloud/device-client", () => ({
  WhatsAppDeviceClient: {
    fromDevice: mock(async () => ({
      createTemplate: mockCreateMetaTemplate,
      deleteTemplate: mockDeleteMetaTemplate,
    })),
  },
}))
mock.module("@/modules/whatsapp/audit/whatsapp-audit.service", () => ({
  logWhatsappAuditEvent: mockLogAudit,
}))

mock.module("@workos-inc/node", () => workosNodeMock)

let currentAuth: any = {
  type: "workos" as const,
  userId: "user-1",
  email: "admin@example.com",
  organizationId: "org-1",
  orgRole: "admin" as const,
  platformRole: "none" as const,
  source: "proxy_header",
}

export const setMockAuthContext = (overrides: any) => {
  currentAuth = overrides ? { ...currentAuth, ...overrides } : null
}

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: mock(async () => currentAuth),
}))
const { templatesRoutes } = await import("./templates.route")

function createTestApp() {
  return new Elysia().use(templatesRoutes).compile()
}

const defaultRejectReason: string | null = null

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
  rejectReason = defaultRejectReason,
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
        rejectReason,
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
    mockTemplateFindUnique.mockImplementation(async () => ({
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
    mockTemplateUpdate.mockImplementation(async () => ({
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
    mockTemplateFindMany.mockClear()
    mockTemplateCount.mockClear()
    mockDeviceFindFirst.mockClear()
    mockSubscriptionFindFirst.mockClear()
    mockTemplateDelete.mockClear()
    mockEnqueueTemplateSync.mockClear()
    mockDeviceFindFirst.mockResolvedValue({
      id: "dev-1",
      tokenEncrypted: "encrypted-token",
      whatsappBusinessAccountId: "waba-1",
      whatsappPhoneId: "phone-1",
      organizationId: "org-1",
      status: "ACTIVE",
    })
    mockSubscriptionFindFirst.mockResolvedValue({
      id: "sub-1",
      organizationId: "org-1",
      status: "ACTIVE",
    })
    mockLogAudit.mockClear()
  })
  describe("POST /", () => {
    it("creates a template with category UTILITY and active device & subscription", async () => {
      const app = createTestApp()

      const body = {
        slug: "hello_world",
        name: "Hello World",
        description: "A greeting template",
        whatsappDeviceId: "device-1",
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

    it("direct pushes to Meta and updates syncStatus to SYNCED when device credentials exist", async () => {
      mockTemplateCreate.mockResolvedValueOnce({
        id: "tpl-pushed",
        slug: "hello_direct_push",
        name: "Hello Direct Push",
        description: "A pushed template",
        organizationId: "org-1",
        whatsappDeviceId: "dev-1",
        syncStatus: "NOT_SYNCED",
        metaStatus: null,
        lastSyncedAt: null,
        category: "UTILITY",
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: [
          {
            id: "lang-1",
            lang: "id",
            headerType: "NONE",
            headerText: "",
            headerUrl: "",
            body: "Halo {{1}}",
            footer: "",
            parameters: null,
            buttons: null,
            isApproved: false,
            metaStatus: null,
            rejectReason: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            whatsappTemplateId: "tpl-pushed",
          },
        ],
      })

      mockTemplateUpdate.mockResolvedValueOnce({
        id: "tpl-pushed",
        slug: "hello_direct_push",
        name: "Hello Direct Push",
        description: "A pushed template",
        organizationId: "org-1",
        whatsappDeviceId: "dev-1",
        syncStatus: "SYNCED",
        metaStatus: "PENDING",
        lastSyncedAt: new Date(),
        category: "UTILITY",
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: [
          {
            id: "lang-1",
            lang: "id",
            headerType: "NONE",
            headerText: "",
            headerUrl: "",
            body: "Halo {{1}}",
            footer: "",
            parameters: null,
            buttons: null,
            isApproved: false,
            metaStatus: "PENDING",
            rejectReason: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            whatsappTemplateId: "tpl-pushed",
          },
        ],
      })

      const app = createTestApp()
      const body = {
        slug: "hello_direct_push",
        name: "Hello Direct Push",
        whatsappDeviceId: "dev-1",
        category: "UTILITY",
        languages: [
          {
            lang: "id",
            headerType: "NONE",
            headerText: "",
            headerUrl: "",
            body: "Halo {{1}}",
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
      expect(mockCreateMetaTemplate).toHaveBeenCalled()
      expect(json.template.syncStatus).toBe("SYNCED")
      expect(json.template.metaStatus).toBe("PENDING")
    })

    it("creates template successfully when authenticated via API key (type platform)", async () => {
      setMockAuthContext({
        type: "platform",
        keyId: "key-1",
        keyName: "WhatsApp organization API key",
        organizationId: "org-1",
        environment: "LIVE",
        scopes: [],
        source: "api_key",
      })
      mockDeviceFindFirst.mockResolvedValueOnce({
        id: "dev-1",
        token: "tok-1",
        tokenEncrypted: "encrypted",
        tokenIv: "iv",
        whatsappPhoneId: "phone-1",
        whatsappBusinessAccountId: "waba-1",
      } as any)

      const app = createTestApp()
      const body = {
        slug: "hello_api_key",
        name: "Hello API Key",
        whatsappDeviceId: "dev-1",
        category: "UTILITY",
        languages: [
          {
            lang: "id",
            headerType: "NONE",
            headerText: "",
            headerUrl: "",
            body: "Halo {{1}}",
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
    })

    it("rejects creation if whatsappDeviceId is missing", async () => {
      const app = createTestApp()

      const body = {
        slug: "hello_world",
        name: "Hello World",
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

      expect(res.status).toBe(422)
    })

    it("rejects creation if device is not found or not active", async () => {
      mockDeviceFindFirst.mockResolvedValueOnce(null as any)
      const app = createTestApp()

      const body = {
        slug: "hello_world",
        name: "Hello World",
        whatsappDeviceId: "device-inactive",
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

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("DEVICE_NOT_ACTIVE")
    })

    it("rejects creation if organization has no active subscription", async () => {
      mockSubscriptionFindFirst.mockResolvedValueOnce(null as any)
      const app = createTestApp()

      const body = {
        slug: "hello_world",
        name: "Hello World",
        whatsappDeviceId: "device-1",
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

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("SUBSCRIPTION_REQUIRED")
    })
    it("creates a template with MARKETING category", async () => {
      const app = createTestApp()

      const body = {
        slug: "promo_template",
        name: "Promo Template",
        whatsappDeviceId: "device-1",
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
        whatsappDeviceId: "device-1",
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
        whatsappDeviceId: "device-1",
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
    it("updates un-submitted draft template category to AUTHENTICATION", async () => {
      mockTemplateFindUnique.mockResolvedValueOnce({
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
      })
      mockTemplateUpdate.mockResolvedValueOnce({
        id: "tpl-1",
        slug: "hello_world",
        name: "Hello World",
        description: "A greeting template",
        organizationId: "org-1",
        whatsappDeviceId: null,
        syncStatus: "NOT_SYNCED",
        metaStatus: null,
        lastSyncedAt: null,
        category: "AUTHENTICATION",
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: [],
      })
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
      const json = await res.json()
      expect(res.status).toBe(200)
      expect(json.template).toBeDefined()
      expect(json.template.category).toBe("AUTHENTICATION")
    })

    it("updates languages with upsert and excludes protected fields", async () => {
      mockTemplateFindUnique.mockResolvedValueOnce({
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
      })
      const app = createTestApp()

      const body = {
        name: "Updated template",
        organizationId: "attacker-org",
        syncStatus: "SYNCED",
        languages: [
          {
            id: "lang-en-1",
            lang: "en",
            headerType: "NONE",
            headerText: "",
            headerUrl: "",
            body: "Updated body",
            parameters: [{ type: "text" }],
            footer: "",
            buttons: [{ type: "QUICK_REPLY", text: "More" }],
          },
        ],
      }

      const res = await app.handle(
        new Request("http://localhost/templates/tpl-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      )

      expect(res.status).toBe(200)
      const calls = mockTemplateUpdate.mock.calls as unknown as Array<
        [{ data: Record<string, unknown> }]
      >
      const updateCall = calls.at(-1)?.[0]
      expect(updateCall?.data).toEqual({
        name: "Updated template",
        languages: {
          upsert: [
            {
              where: { id: "lang-en-1" },
              create: {
                lang: "en",
                headerType: "NONE",
                headerUrl: "",
                headerText: "",
                body: "Updated body",
                parameters: [{ type: "text" }],
                footer: "",
                buttons: [{ type: "QUICK_REPLY", text: "More" }],
              },
              update: {
                headerType: "NONE",
                headerUrl: "",
                headerText: "",
                body: "Updated body",
                parameters: [{ type: "text" }],
                footer: "",
                buttons: [{ type: "QUICK_REPLY", text: "More" }],
              },
            },
          ],
        },
      })
    })

    it("rejects update on templates submitted to Meta (immutable)", async () => {
      mockTemplateFindUnique.mockResolvedValueOnce({
        id: "tpl-synced",
        slug: "hello_world",
        name: "Hello World",
        description: "A greeting template",
        organizationId: "org-1",
        whatsappDeviceId: "dev-1",
        syncStatus: "SYNCED",
        metaStatus: "APPROVED",
        lastSyncedAt: new Date(),
        category: "UTILITY",
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: [],
      })

      const app = createTestApp()
      const body = { name: "Trying to rename" }

      const res = await app.handle(
        new Request("http://localhost/templates/tpl-synced", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      )

      expect(res.status).toBe(422)
      const json = await res.json()
      expect(json.error).toBe("TEMPLATE_IMMUTABLE")
      expect(json.message).toContain(
        "Templates submitted to Meta cannot be modified"
      )
    })

    it("allows update on synced templates pending Meta approval", async () => {
      mockTemplateFindUnique.mockResolvedValueOnce({
        id: "tpl-synced-pending",
        slug: "hello_world",
        name: "Hello World",
        description: "A greeting template",
        organizationId: "org-1",
        whatsappDeviceId: "dev-1",
        syncStatus: "SYNCED",
        metaStatus: "PENDING",
        lastSyncedAt: new Date(),
        category: "UTILITY",
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: [],
      })

      const app = createTestApp()
      const body = { name: "Rename while pending" }

      const res = await app.handle(
        new Request("http://localhost/templates/tpl-synced-pending", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      )

      expect(res.status).toBe(200)
    })
  })

  describe("category in DTO response", () => {
    it("returns category in template DTO on create", async () => {
      const app = createTestApp()

      const body = {
        slug: "dto_test",
        name: "DTO Test",
        whatsappDeviceId: "device-1",
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

    it("returns a Meta status reason separately from rejection status", async () => {
      mockTemplateFindUnique.mockResolvedValueOnce(
        approvedTemplate({
          rejectReason: "Template no longer meets utility guidance",
        })
      )
      const app = createTestApp()

      const res = await app.handle(
        new Request("http://localhost/templates/tpl-approved")
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.template.metaStatus).toBe("APPROVED")
      expect(json.template.languages[0].metaReason).toBe(
        "Template no longer meets utility guidance"
      )
    })
  })
  describe("GET / query filters", () => {
    it("returns only approved template variants for the selected organization device", async () => {
      mockTemplateFindMany.mockResolvedValueOnce([])
      mockTemplateCount.mockResolvedValueOnce(0)
      const app = createTestApp()

      const res = await app.handle(
        new Request(
          "http://localhost/templates?whatsappDeviceId=device-1&broadcastEligible=true"
        )
      )

      expect(res.status).toBe(200)
      expect(mockTemplateFindMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          whatsappDeviceId: "device-1",
          syncStatus: "SYNCED",
          metaStatus: "APPROVED",
          languages: {
            some: {
              OR: [{ isApproved: true }, { metaStatus: "APPROVED" }],
            },
          },
        },
        include: {
          whatsappDevice: {
            select: {
              id: true,
              phoneNumber: true,
              status: true,
              whatsappBusinessAccountId: true,
              whatsappPhoneId: true,
            },
          },
          languages: {
            where: {
              OR: [{ isApproved: true }, { metaStatus: "APPROVED" }],
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 50,
      })
    })

    it("filters templates by wabaId by resolving deviceId", async () => {
      mockDeviceFindFirst.mockResolvedValueOnce({
        id: "device-waba-1",
        organizationId: "org-1",
        status: "ACTIVE",
      })
      const app = createTestApp()
      const res = await app.handle(
        new Request("http://localhost/templates?wabaId=waba-123")
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(mockDeviceFindFirst).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          whatsappBusinessAccountId: "waba-123",
        },
        select: { id: true },
      })
    })
  })
  describe("GET /", () => {
    it("returns 401 when unauthenticated", async () => {
      setMockAuthContext(null)
      const res = await createTestApp().handle(
        new Request("http://localhost/templates/")
      )
      expect(res.status).toBe(401)
      expect((await res.json()).error).toBe("UNAUTHORIZED")
      expect(mockTemplateFindMany).not.toHaveBeenCalled()
    })

    it("requires an organization for non-super-admin users", async () => {
      setMockAuthContext({ organizationId: null })
      const res = await createTestApp().handle(
        new Request("http://localhost/templates/")
      )
      expect(res.status).toBe(403)
      expect((await res.json()).error).toBe("FORBIDDEN")
    })

    it("does not add an organization filter for super admins", async () => {
      setMockAuthContext({ platformRole: "super_admin" })
      const res = await createTestApp().handle(
        new Request(
          "http://localhost/templates/?sort=asc&syncStatus=NOT_SYNCED"
        )
      )
      expect(res.status).toBe(200)
      expect(mockTemplateFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { syncStatus: "NOT_SYNCED" },
          orderBy: { createdAt: "asc" },
        })
      )
      expect(mockTemplateCount).toHaveBeenCalledWith({
        where: { syncStatus: "NOT_SYNCED" },
      })
    })

    it("returns an empty result when phoneId has no matching device", async () => {
      mockDeviceFindFirst.mockResolvedValueOnce(null)
      const res = await createTestApp().handle(
        new Request("http://localhost/templates/?phoneId=missing-phone")
      )
      expect(res.status).toBe(200)
      expect(mockDeviceFindFirst).toHaveBeenCalledWith({
        where: { organizationId: "org-1", whatsappPhoneId: "missing-phone" },
        select: { id: true },
      })
      expect(mockTemplateFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: "org-1",
            whatsappDeviceId: "non-existent-device-id",
          },
        })
      )
    })

    it("combines waba and phone filters when resolving a device", async () => {
      mockDeviceFindFirst.mockResolvedValueOnce({ id: "resolved-device" })
      const res = await createTestApp().handle(
        new Request("http://localhost/templates/?wabaId=waba-9&phoneId=phone-9")
      )
      expect(res.status).toBe(200)
      expect(mockDeviceFindFirst).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          whatsappBusinessAccountId: "waba-9",
          whatsappPhoneId: "phone-9",
        },
        select: { id: true },
      })
      expect(mockTemplateFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: "org-1",
            whatsappDeviceId: "resolved-device",
          },
        })
      )
    })
  })

  describe("GET /:id", () => {
    it("returns 401 when unauthenticated", async () => {
      setMockAuthContext(null)
      const res = await createTestApp().handle(
        new Request("http://localhost/templates/tpl-1")
      )
      expect(res.status).toBe(401)
      expect((await res.json()).error).toBe("UNAUTHORIZED")
    })

    it("returns 404 when the template does not exist", async () => {
      mockTemplateFindUnique.mockResolvedValueOnce(null as never)
      const res = await createTestApp().handle(
        new Request("http://localhost/templates/missing")
      )
      expect(res.status).toBe(404)
      expect((await res.json()).error).toBe("NOT_FOUND")
    })

    it("rejects access to a template owned by another organization", async () => {
      mockTemplateFindUnique.mockResolvedValueOnce({
        ...approvedTemplate(),
        organizationId: "org-other",
      } as unknown as MockTemplate)
      const res = await createTestApp().handle(
        new Request("http://localhost/templates/cross-org")
      )
      expect(res.status).toBe(403)
      expect((await res.json()).error).toBe("FORBIDDEN")
    })

    it("returns a template for its organization", async () => {
      mockTemplateFindUnique.mockResolvedValueOnce(
        approvedTemplate() as unknown as MockTemplate
      )
      const res = await createTestApp().handle(
        new Request("http://localhost/templates/tpl-approved")
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.template.id).toBe("tpl-approved")
    })
  })

  describe("DELETE /:id", () => {
    it("returns 401 when unauthenticated", async () => {
      setMockAuthContext(null)
      const res = await createTestApp().handle(
        new Request("http://localhost/templates/tpl-1", { method: "DELETE" })
      )
      expect(res.status).toBe(401)
      expect((await res.json()).error).toBe("UNAUTHORIZED")
    })

    it("returns 404 when deleting a missing template", async () => {
      mockTemplateFindUnique.mockResolvedValueOnce(null as never)
      const res = await createTestApp().handle(
        new Request("http://localhost/templates/missing", { method: "DELETE" })
      )
      expect(res.status).toBe(404)
      expect(mockTemplateDelete).not.toHaveBeenCalled()
    })

    it("rejects deleting a template from another organization", async () => {
      mockTemplateFindUnique.mockResolvedValueOnce({
        ...approvedTemplate(),
        organizationId: "org-other",
      } as unknown as MockTemplate)
      const res = await createTestApp().handle(
        new Request("http://localhost/templates/cross-org", {
          method: "DELETE",
        })
      )
      expect(res.status).toBe(403)
      expect(mockTemplateDelete).not.toHaveBeenCalled()
    })

    it("deletes an organization template and records an audit event", async () => {
      mockTemplateFindUnique.mockResolvedValueOnce({
        ...approvedTemplate(),
        name: "Delete me",
      } as unknown as MockTemplate)
      const res = await createTestApp().handle(
        new Request("http://localhost/templates/tpl-approved", {
          method: "DELETE",
        })
      )
      expect(res.status).toBe(200)
      expect((await res.json()).ok).toBe(true)
      expect(mockTemplateDelete).toHaveBeenCalledWith({
        where: { id: "tpl-approved" },
      })
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "TEMPLATE_DELETED",
          organizationId: "org-1",
        })
      )
    })

    it("calls Meta deleteTemplate when template is linked to a device", async () => {
      mockDeleteMetaTemplate.mockClear()
      mockTemplateFindUnique.mockResolvedValueOnce({
        ...approvedTemplate(),
        slug: "my_template",
        name: "My Template",
        whatsappDeviceId: "dev-1",
      } as unknown as MockTemplate)
      mockDeviceFindUnique.mockResolvedValueOnce({
        id: "dev-1",
        tokenEncrypted: "encrypted-token",
        whatsappBusinessAccountId: "waba-1",
        whatsappPhoneId: "phone-1",
      })

      const res = await createTestApp().handle(
        new Request("http://localhost/templates/tpl-approved", {
          method: "DELETE",
        })
      )
      expect(res.status).toBe(200)
      expect(mockDeleteMetaTemplate).toHaveBeenCalledWith("my_template")
      expect(mockTemplateDelete).toHaveBeenCalledWith({
        where: { id: "tpl-approved" },
      })
    })

    it("proceeds with local deletion if Meta returns 404 (already deleted in Meta)", async () => {
      const { MetaCloudError } =
        await import("@/lib/whatsapp/meta-cloud/errors")
      mockDeleteMetaTemplate.mockRejectedValueOnce(
        new MetaCloudError("Template does not exist", { httpStatus: 404 })
      )
      mockTemplateFindUnique.mockResolvedValueOnce({
        ...approvedTemplate(),
        slug: "already_deleted",
        whatsappDeviceId: "dev-1",
      } as unknown as MockTemplate)
      mockDeviceFindUnique.mockResolvedValueOnce({
        id: "dev-1",
        tokenEncrypted: "encrypted-token",
        whatsappBusinessAccountId: "waba-1",
        whatsappPhoneId: "phone-1",
      })

      const res = await createTestApp().handle(
        new Request("http://localhost/templates/tpl-approved", {
          method: "DELETE",
        })
      )
      expect(res.status).toBe(200)
      expect(mockTemplateDelete).toHaveBeenCalledWith({
        where: { id: "tpl-approved" },
      })
    })

    it("returns 502 and preserves local template if Meta deletion fails with non-404 error", async () => {
      const { MetaCloudError } =
        await import("@/lib/whatsapp/meta-cloud/errors")
      mockTemplateDelete.mockClear()
      mockDeleteMetaTemplate.mockRejectedValueOnce(
        new MetaCloudError("Meta permission denied", {
          httpStatus: 403,
          code: 200,
        })
      )
      mockTemplateFindUnique.mockResolvedValueOnce({
        ...approvedTemplate(),
        slug: "failing_template",
        whatsappDeviceId: "dev-1",
      } as unknown as MockTemplate)
      mockDeviceFindUnique.mockResolvedValueOnce({
        id: "dev-1",
        tokenEncrypted: "encrypted-token",
        whatsappBusinessAccountId: "waba-1",
        whatsappPhoneId: "phone-1",
      })

      const res = await createTestApp().handle(
        new Request("http://localhost/templates/tpl-approved", {
          method: "DELETE",
        })
      )
      expect(res.status).toBe(502)
      const body = await res.json()
      expect(body.error).toBe("META_DELETION_FAILED")
      expect(mockTemplateDelete).not.toHaveBeenCalled()
    })
  })

  describe("POST /:id/sync", () => {
    it("returns 401 when unauthenticated", async () => {
      setMockAuthContext(null)
      const res = await createTestApp().handle(
        new Request("http://localhost/templates/tpl-1/sync", { method: "POST" })
      )
      expect(res.status).toBe(401)
    })

    it("returns 404 for a missing template", async () => {
      mockTemplateFindUnique.mockResolvedValueOnce(null as never)
      const res = await createTestApp().handle(
        new Request("http://localhost/templates/missing/sync", {
          method: "POST",
        })
      )
      expect(res.status).toBe(404)
    })

    it("rejects sync across organizations", async () => {
      mockTemplateFindUnique.mockResolvedValueOnce({
        ...approvedTemplate(),
        organizationId: "org-other",
        whatsappDeviceId: "dev-other",
      } as unknown as MockTemplate)
      const res = await createTestApp().handle(
        new Request("http://localhost/templates/cross-org/sync", {
          method: "POST",
        })
      )
      expect(res.status).toBe(403)
      expect(mockEnqueueTemplateSync).not.toHaveBeenCalled()
    })

    it("rejects sync when the template has no device", async () => {
      const res = await createTestApp().handle(
        new Request("http://localhost/templates/tpl-1/sync", { method: "POST" })
      )
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe("BAD_REQUEST")
    })

    it("enqueues a sync job for a device-backed template", async () => {
      mockTemplateFindUnique.mockResolvedValueOnce({
        ...approvedTemplate(),
        whatsappDeviceId: "dev-1",
      } as unknown as MockTemplate)
      const res = await createTestApp().handle(
        new Request("http://localhost/templates/tpl-approved/sync", {
          method: "POST",
        })
      )
      expect(res.status).toBe(200)
      expect((await res.json()).message).toBe("Sync job enqueued.")
      expect(mockEnqueueTemplateSync).toHaveBeenCalledWith(
        "org-1",
        "dev-1",
        "sync-templates"
      )
    })

    it("returns 500 and audits when enqueueing fails", async () => {
      mockTemplateFindUnique.mockResolvedValueOnce({
        ...approvedTemplate(),
        whatsappDeviceId: "dev-1",
      } as unknown as MockTemplate)
      mockEnqueueTemplateSync.mockRejectedValueOnce(
        new Error("queue unavailable")
      )
      const res = await createTestApp().handle(
        new Request("http://localhost/templates/tpl-approved/sync", {
          method: "POST",
        })
      )
      expect(res.status).toBe(500)
      expect((await res.json()).error).toBe("INTERNAL")
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "TEMPLATE_SYNC_FAILED",
          status: "FAILED",
        })
      )
    })
  })
})
