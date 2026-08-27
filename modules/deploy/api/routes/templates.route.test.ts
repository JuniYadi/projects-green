import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { AppTemplateBlueprint } from "@/modules/deploy/blueprint/app-template-blueprint.schema"
import type { AppTemplateCategory, AppTemplateVisibility } from "@prisma/client"

interface MockTemplate {
  id: string
  slug: string
  name: string
  tagline: string
  description: string
  category: AppTemplateCategory
  visibility: AppTemplateVisibility
  isOfficial: boolean
  isFeatured: boolean
  organizationId: string | null
  blueprintJson: AppTemplateBlueprint
}

const mockAuth: {
  user: { id: string; email: string } | null
  organizationId: string | null
} = {
  user: { id: "user-123", email: "developer@example.com" },
  organizationId: "org-1",
}

const mockWithAuth = mock(async () => mockAuth)

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

const mockTemplates: MockTemplate[] = []

const mockPrisma = {
  appTemplate: {
    findMany: mock(
      async ({
        where,
      }: {
        where?: {
          OR?: Array<{ visibility?: string; isOfficial?: boolean }>
          organizationId?: string
          category?: AppTemplateCategory
          isFeatured?: boolean
          AND?: Array<{
            OR?: Array<{
              name?: { contains: string }
              tagline?: { contains: string }
              description?: { contains: string }
            }>
          }>
        }
      }) => {
        let filtered = [...mockTemplates]

        if (where?.OR && Array.isArray(where.OR)) {
          filtered = filtered.filter((t) =>
            where.OR?.some((cond) => {
              if (cond.visibility && t.visibility === cond.visibility)
                return true
              if (
                cond.isOfficial !== undefined &&
                t.isOfficial === cond.isOfficial
              )
                return true
              return false
            })
          )
        }

        if (where?.organizationId) {
          filtered = filtered.filter(
            (t) => t.organizationId === where.organizationId
          )
        }

        if (where?.category) {
          filtered = filtered.filter((t) => t.category === where.category)
        }

        if (where?.isFeatured !== undefined) {
          filtered = filtered.filter((t) => t.isFeatured === where.isFeatured)
        }

        if (where?.AND && Array.isArray(where.AND)) {
          for (const andCond of where.AND) {
            if (andCond.OR && Array.isArray(andCond.OR)) {
              filtered = filtered.filter((t) =>
                andCond.OR?.some((orClause) => {
                  if (orClause.name?.contains) {
                    return t.name
                      .toLowerCase()
                      .includes(orClause.name.contains.toLowerCase())
                  }
                  if (orClause.tagline?.contains) {
                    return t.tagline
                      .toLowerCase()
                      .includes(orClause.tagline.contains.toLowerCase())
                  }
                  if (orClause.description?.contains) {
                    return t.description
                      .toLowerCase()
                      .includes(orClause.description.contains.toLowerCase())
                  }
                  return false
                })
              )
            }
          }
        }

        return filtered
      }
    ),
    findUnique: mock(
      async ({ where }: { where: { slug?: string; id?: string } }) => {
        if (where.slug) {
          return mockTemplates.find((t) => t.slug === where.slug) || null
        }
        if (where.id) {
          return mockTemplates.find((t) => t.id === where.id) || null
        }
        return null
      }
    ),
    create: mock(
      async ({
        data,
      }: {
        data: Omit<MockTemplate, "id"> & { [key: string]: unknown }
      }) => {
        const created: MockTemplate = {
          id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          slug: data.slug,
          name: data.name,
          tagline: data.tagline,
          description: data.description,
          category: data.category,
          visibility: data.visibility,
          isOfficial: data.isOfficial,
          isFeatured: data.isFeatured,
          organizationId: data.organizationId,
          blueprintJson: data.blueprintJson,
        }
        mockTemplates.push(created)
        return created
      }
    ),
    update: mock(
      async ({
        where,
        data,
      }: {
        where: { id: string }
        data: Partial<MockTemplate>
      }) => {
        const idx = mockTemplates.findIndex((t) => t.id === where.id)
        if (idx === -1) return null
        mockTemplates[idx] = {
          ...mockTemplates[idx],
          ...data,
        }
        return mockTemplates[idx]
      }
    ),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

// Dynamic import exception: testing module under test after mock.module registrations
const { appTemplateRoutes } = await import("./templates.route")

const validBlueprint: AppTemplateBlueprint = {
  version: "1.0.0",
  runtime: {
    image: "ghost:5-alpine",
    defaultPort: 2368,
    runAsNonRoot: true,
  },
  resources: {
    defaultCpu: 500,
    defaultMemory: 512,
  },
  dependencies: [
    {
      serviceType: "MYSQL",
      alias: "ghost_db",
      envPrefix: "database__connection",
    },
  ],
  envSchema: [
    {
      key: "url",
      label: "Blog URL",
      required: true,
      isSecret: false,
      dataType: "string",
      defaultValue: "http://localhost:2368",
    },
  ],
}

describe("appTemplateRoutes", () => {
  beforeEach(() => {
    mockTemplates.length = 0
    mockAuth.user = { id: "user-123", email: "developer@example.com" }
    mockAuth.organizationId = "org-1"

    // Seed sample templates
    mockTemplates.push(
      {
        id: "tpl-1",
        slug: "ghost-blog",
        name: "Ghost Blog",
        tagline: "Professional publishing platform",
        description: "Open source headless Node.js CMS",
        category: "CMS",
        visibility: "PUBLIC",
        isOfficial: true,
        isFeatured: true,
        organizationId: null,
        blueprintJson: validBlueprint,
      },
      {
        id: "tpl-2",
        slug: "n8n-automation",
        name: "n8n Workflow Automation",
        tagline: "Fair-code workflow automation tool",
        description: "Easily automate tasks across different services",
        category: "AUTOMATION",
        visibility: "PUBLIC",
        isOfficial: false,
        isFeatured: false,
        organizationId: null,
        blueprintJson: validBlueprint,
      },
      {
        id: "tpl-3",
        slug: "internal-crm",
        name: "Internal Custom CRM",
        tagline: "Org-1 private CRM tool",
        description: "Internal custom template",
        category: "UTILITIES",
        visibility: "PRIVATE",
        isOfficial: false,
        isFeatured: false,
        organizationId: "org-1",
        blueprintJson: validBlueprint,
      },
      {
        id: "tpl-4",
        slug: "rival-secret-bot",
        name: "Rival Secret Bot",
        tagline: "Org-2 confidential bot",
        description: "Internal bot for Org-2",
        category: "AI",
        visibility: "PRIVATE",
        isOfficial: false,
        isFeatured: false,
        organizationId: "org-2",
        blueprintJson: validBlueprint,
      }
    )
  })

  describe("GET /templates", () => {
    it("returns only public and official templates", async () => {
      const response = await appTemplateRoutes.handle(
        new Request("http://localhost/templates")
      )
      expect(response.status).toBe(200)
      const data = (await response.json()) as MockTemplate[]
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(2)
      expect(data.map((t) => t.slug)).toEqual(["ghost-blog", "n8n-automation"])
    })

    it("filters public templates by category", async () => {
      const response = await appTemplateRoutes.handle(
        new Request("http://localhost/templates?category=CMS")
      )
      expect(response.status).toBe(200)
      const data = (await response.json()) as MockTemplate[]
      expect(data).toHaveLength(1)
      expect(data[0].slug).toBe("ghost-blog")
    })

    it("filters public templates by search query", async () => {
      const response = await appTemplateRoutes.handle(
        new Request("http://localhost/templates?search=Workflow")
      )
      expect(response.status).toBe(200)
      const data = (await response.json()) as MockTemplate[]
      expect(data).toHaveLength(1)
      expect(data[0].slug).toBe("n8n-automation")
    })

    it("filters public templates by featured flag", async () => {
      const response = await appTemplateRoutes.handle(
        new Request("http://localhost/templates?featured=true")
      )
      expect(response.status).toBe(200)
      const data = (await response.json()) as MockTemplate[]
      expect(data).toHaveLength(1)
      expect(data[0].slug).toBe("ghost-blog")
    })
  })

  describe("GET /templates/workspace", () => {
    it("returns private templates owned by caller organization", async () => {
      const response = await appTemplateRoutes.handle(
        new Request("http://localhost/templates/workspace")
      )
      expect(response.status).toBe(200)
      const data = (await response.json()) as MockTemplate[]
      expect(data).toHaveLength(1)
      expect(data[0].slug).toBe("internal-crm")
      expect(data[0].organizationId).toBe("org-1")
    })

    it("returns 401 when unauthenticated", async () => {
      mockAuth.user = null
      const response = await appTemplateRoutes.handle(
        new Request("http://localhost/templates/workspace")
      )
      expect(response.status).toBe(401)
      const data = (await response.json()) as { error: string }
      expect(data.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when no organization context", async () => {
      mockAuth.organizationId = null
      const response = await appTemplateRoutes.handle(
        new Request("http://localhost/templates/workspace")
      )
      expect(response.status).toBe(403)
      const data = (await response.json()) as { error: string }
      expect(data.error).toBe("NO_ORGANIZATION")
    })
  })

  describe("GET /templates/:slug (Anti-IDOR & Scoping)", () => {
    it("allows access to official/public templates", async () => {
      const res1 = await appTemplateRoutes.handle(
        new Request("http://localhost/templates/ghost-blog")
      )
      expect(res1.status).toBe(200)
      const data1 = (await res1.json()) as MockTemplate
      expect(data1.slug).toBe("ghost-blog")

      const res2 = await appTemplateRoutes.handle(
        new Request("http://localhost/templates/n8n-automation")
      )
      expect(res2.status).toBe(200)
      const data2 = (await res2.json()) as MockTemplate
      expect(data2.slug).toBe("n8n-automation")
    })

    it("allows access to owned private template", async () => {
      const response = await appTemplateRoutes.handle(
        new Request("http://localhost/templates/internal-crm")
      )
      expect(response.status).toBe(200)
      const data = (await response.json()) as MockTemplate
      expect(data.slug).toBe("internal-crm")
    })

    it("returns 404 for unowned private template (Anti-IDOR protection)", async () => {
      const response = await appTemplateRoutes.handle(
        new Request("http://localhost/templates/rival-secret-bot")
      )
      expect(response.status).toBe(404)
      const data = (await response.json()) as { error: string }
      expect(data.error).toBe("NOT_FOUND")
    })

    it("returns 404 for non-existent template", async () => {
      const response = await appTemplateRoutes.handle(
        new Request("http://localhost/templates/does-not-exist")
      )
      expect(response.status).toBe(404)
      const data = (await response.json()) as { error: string }
      expect(data.error).toBe("NOT_FOUND")
    })
  })

  describe("POST /templates", () => {
    it("creates a custom template with PRIVATE visibility and caller's orgId", async () => {
      const payload = {
        name: "My Custom Analytics",
        tagline: "Self-hosted analytics engine",
        description: "Fast lightweight web analytics",
        category: "ANALYTICS",
        blueprintJson: validBlueprint,
      }

      const response = await appTemplateRoutes.handle(
        new Request("http://localhost/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      )

      expect(response.status).toBe(201)
      const data = (await response.json()) as MockTemplate
      expect(data.slug).toBe("my-custom-analytics")
      expect(data.organizationId).toBe("org-1")
      expect(data.visibility).toBe("PRIVATE")
      expect(data.isOfficial).toBe(false)
      expect(data.isFeatured).toBe(false)
    })

    it("rejects invalid blueprintJson with 422", async () => {
      const payload = {
        name: "Broken App",
        tagline: "Broken runtime",
        description: "Missing required fields",
        category: "UTILITIES",
        blueprintJson: {
          version: "1.0.0",
          runtime: {
            // missing image and port
          },
        },
      }

      const response = await appTemplateRoutes.handle(
        new Request("http://localhost/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      )

      expect(response.status).toBe(422)
      const data = (await response.json()) as {
        error: string
        errors?: Record<string, string>
      }
      expect(data.error).toBe("INVALID_BLUEPRINT")
      expect(data.errors).toBeDefined()
    })
    it("rejects invalid category with 422", async () => {
      const payload = {
        name: "Custom App",
        tagline: "Invalid category app",
        description: "Test description",
        category: "INVALID_CAT",
        blueprintJson: validBlueprint,
      }

      const response = await appTemplateRoutes.handle(
        new Request("http://localhost/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      )

      expect(response.status).toBe(422)
      const data = (await response.json()) as { error: string }
      expect(data.error).toBe("INVALID_CATEGORY")
    })

    it("requires authentication and organization context", async () => {
      mockAuth.organizationId = null
      const response = await appTemplateRoutes.handle(
        new Request("http://localhost/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Test",
            tagline: "Test",
            description: "Test",
            category: "CMS",
            blueprintJson: validBlueprint,
          }),
        })
      )
      expect(response.status).toBe(403)
    })
  })

  describe("POST /templates/:id/submit-review", () => {
    it("updates visibility to PENDING_REVIEW for owned template", async () => {
      const response = await appTemplateRoutes.handle(
        new Request("http://localhost/templates/tpl-3/submit-review", {
          method: "POST",
        })
      )

      expect(response.status).toBe(200)
      const data = (await response.json()) as MockTemplate
      expect(data.id).toBe("tpl-3")
      expect(data.visibility).toBe("PENDING_REVIEW")
    })

    it("returns 404 when trying to submit another org's template", async () => {
      const response = await appTemplateRoutes.handle(
        new Request("http://localhost/templates/tpl-4/submit-review", {
          method: "POST",
        })
      )

      expect(response.status).toBe(404)
      const data = (await response.json()) as { error: string }
      expect(data.error).toBe("NOT_FOUND")
    })
    it("rejects submission if template is already PUBLIC or PENDING_REVIEW", async () => {
      mockTemplates.push({
        id: "tpl-5",
        slug: "already-public-crm",
        name: "Already Public CRM",
        tagline: "Org-1 public CRM",
        description: "Public template",
        category: "UTILITIES",
        visibility: "PUBLIC",
        isOfficial: false,
        isFeatured: false,
        organizationId: "org-1",
        blueprintJson: validBlueprint,
      })

      const response = await appTemplateRoutes.handle(
        new Request("http://localhost/templates/tpl-5/submit-review", {
          method: "POST",
        })
      )

      expect(response.status).toBe(422)
      const data = (await response.json()) as { error: string }
      expect(data.error).toBe("INVALID_STATE")
    })
  })
})
