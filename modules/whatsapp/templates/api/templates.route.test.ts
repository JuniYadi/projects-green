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

const mockTemplateCreate = mock(
  async (): Promise<MockTemplate> => ({
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
)

const mockTemplateUpdate = mock(
  async (): Promise<MockTemplate> => ({
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
  })
)

const mockTemplateFindUnique = mock(
  async (): Promise<MockTemplate> => ({
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
)
const mockTemplateFindMany = mock(async () => [])
const mockTemplateCount = mock(async () => 0)
const mockSubscriptionFindFirst = mock(async () => ({
  id: "sub-1",
  organizationId: "org-1",
  status: "ACTIVE",
}))
const mockLogAudit = mock(async () => {})
const mockDeviceFindFirst = mock(
  async (): Promise<any> => ({
    id: "dev-1",
    tokenEncrypted: "encrypted-token",
    whatsappBusinessAccountId: "waba-1",
    whatsappPhoneId: "phone-1",
    organizationId: "org-1",
    status: "ACTIVE",
  })
)

const mockCreateMetaTemplate = mock(async () => ({
  id: "meta-tpl-1",
  status: "PENDING",
}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappTemplate: {
      create: mockTemplateCreate,
      update: mockTemplateUpdate,
      findUnique: mockTemplateFindUnique,
      findMany: mockTemplateFindMany,
      count: mockTemplateCount,
    },
    whatsappDevice: {
      findFirst: mockDeviceFindFirst,
    },
    serviceSubscription: {
      findFirst: mockSubscriptionFindFirst,
    },
  },
}))

mock.module("@/lib/whatsapp/meta-cloud/device-client", () => ({
  WhatsAppDeviceClient: {
    fromDevice: mock(async () => ({
      createTemplate: mockCreateMetaTemplate,
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
})
