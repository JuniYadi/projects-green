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
  verifiedAt: Date | null
  reviewedBy: string | null
  reviewNotes: string | null
  createdAt: Date
  updatedAt: Date
}

const mockAuth: {
  user: { id: string; email: string } | null
  organizationId: string | null
  role?: string | null
  roles?: string[] | null
} = {
  user: { id: "admin-user", email: "admin@example.com" },
  organizationId: "org-admin",
  role: null,
  roles: null,
}

let mockPlatformRole: "none" | "super_admin" = "super_admin"

const mockWithAuth = mock(async () => mockAuth)
mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: mock(async () => mockPlatformRole),
}))

const mockTemplates: MockTemplate[] = []

const mockPrisma = {
  appTemplate: {
    findMany: mock(async (args?: { where?: any; orderBy?: any }) => {
      let filtered = [...mockTemplates]
      if (args?.where) {
        const where = args.where
        if (where.visibility) {
          filtered = filtered.filter((t) => t.visibility === where.visibility)
        }
        if (where.category) {
          filtered = filtered.filter((t) => t.category === where.category)
        }
        if (where.AND && Array.isArray(where.AND)) {
          for (const condition of where.AND) {
            if (condition.OR && Array.isArray(condition.OR)) {
              filtered = filtered.filter((t) =>
                condition.OR.some((sub: any) => {
                  if (sub.name?.contains) {
                    return t.name
                      .toLowerCase()
                      .includes(sub.name.contains.toLowerCase())
                  }
                  if (sub.tagline?.contains) {
                    return t.tagline
                      .toLowerCase()
                      .includes(sub.tagline.contains.toLowerCase())
                  }
                  if (sub.description?.contains) {
                    return t.description
                      .toLowerCase()
                      .includes(sub.description.contains.toLowerCase())
                  }
                  if (sub.slug?.contains) {
                    return t.slug
                      .toLowerCase()
                      .includes(sub.slug.contains.toLowerCase())
                  }
                  return false
                })
              )
            }
          }
        }
      }
      return filtered
    }),
    findUnique: mock(
      async ({ where }: { where: { id?: string; slug?: string } }) => {
        if (where.id) {
          return mockTemplates.find((t) => t.id === where.id) || null
        }
        if (where.slug) {
          return mockTemplates.find((t) => t.slug === where.slug) || null
        }
        return null
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
        if (idx === -1) {
          throw new Error("Template not found")
        }
        mockTemplates[idx] = {
          ...mockTemplates[idx],
          ...data,
          updatedAt: new Date(),
        }
        return mockTemplates[idx]
      }
    ),
    create: mock(
      async ({
        data,
      }: {
        data: Omit<
          MockTemplate,
          "id" | "createdAt" | "updatedAt" | "reviewNotes"
        >
      }) => {
        const newTemplate: MockTemplate = {
          id: `tpl-${mockTemplates.length + 1}`,
          slug: data.slug,
          name: data.name,
          tagline: data.tagline,
          description: data.description,
          category: data.category,
          visibility: data.visibility,
          isOfficial: data.isOfficial ?? true,
          isFeatured: data.isFeatured ?? false,
          organizationId: data.organizationId ?? null,
          blueprintJson: data.blueprintJson,
          verifiedAt: data.verifiedAt ?? null,
          reviewedBy: data.reviewedBy ?? null,
          reviewNotes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        mockTemplates.push(newTemplate)
        return newTemplate
      }
    ),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const { adminTemplateRoutes } = await import("./admin-templates.route")

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
  dependencies: [],
  envSchema: [],
}

describe("adminTemplateRoutes", () => {
  beforeEach(() => {
    mockTemplates.length = 0
    mockAuth.user = { id: "admin-user", email: "admin@example.com" }
    mockAuth.organizationId = "org-admin"
    mockAuth.role = null
    mockAuth.roles = null
    mockPlatformRole = "super_admin"

    mockTemplates.push({
      id: "tpl-1",
      slug: "custom-ghost",
      name: "Custom Ghost",
      tagline: "Publishing platform",
      description: "Ghost blog description",
      category: "CMS",
      visibility: "PENDING_REVIEW",
      isOfficial: false,
      isFeatured: false,
      organizationId: "org-user",
      blueprintJson: validBlueprint,
      verifiedAt: null,
      reviewedBy: null,
      reviewNotes: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    })

    mockTemplates.push({
      id: "tpl-2",
      slug: "official-redis",
      name: "Official Redis",
      tagline: "In-memory cache",
      description: "Fast Redis store",
      category: "DATABASE",
      visibility: "PUBLIC",
      isOfficial: true,
      isFeatured: true,
      organizationId: null,
      blueprintJson: validBlueprint,
      verifiedAt: new Date("2026-01-01T00:00:00Z"),
      reviewedBy: "admin-user",
      reviewNotes: null,
      createdAt: new Date("2026-01-02T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    })
  })

  describe("GET /admin/templates", () => {
    it("returns 403 when user is not super admin", async () => {
      mockPlatformRole = "none"
      const res = await adminTemplateRoutes.handle(
        new Request("http://localhost/admin/templates", {
          method: "GET",
        })
      )
      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toContain("Forbidden")
    })

    it("returns all templates for super admin", async () => {
      const res = await adminTemplateRoutes.handle(
        new Request("http://localhost/admin/templates", {
          method: "GET",
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveLength(2)
    })

    it("filters templates by visibility", async () => {
      const res = await adminTemplateRoutes.handle(
        new Request(
          "http://localhost/admin/templates?visibility=PENDING_REVIEW",
          {
            method: "GET",
          }
        )
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveLength(1)
      expect(data[0].id).toBe("tpl-1")
    })

    it("filters templates by category and search", async () => {
      const res = await adminTemplateRoutes.handle(
        new Request(
          "http://localhost/admin/templates?category=DATABASE&search=Redis",
          {
            method: "GET",
          }
        )
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveLength(1)
      expect(data[0].id).toBe("tpl-2")
    })
  })

  describe("POST /admin/templates/:id/approve", () => {
    it("approves pending template and sets verifiedAt/reviewedBy", async () => {
      const res = await adminTemplateRoutes.handle(
        new Request("http://localhost/admin/templates/tpl-1/approve", {
          method: "POST",
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.visibility).toBe("PUBLIC")
      expect(data.reviewedBy).toBe("admin-user")
      expect(data.verifiedAt).toBeDefined()
    })

    it("returns 404 for non-existent template", async () => {
      const res = await adminTemplateRoutes.handle(
        new Request(
          "http://localhost/admin/templates/tpl-nonexistent/approve",
          {
            method: "POST",
          }
        )
      )
      expect(res.status).toBe(404)
    })
  })

  describe("POST /admin/templates/:id/reject", () => {
    it("rejects template with review notes", async () => {
      const res = await adminTemplateRoutes.handle(
        new Request("http://localhost/admin/templates/tpl-1/reject", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewNotes: "Container port is misconfigured",
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.visibility).toBe("REJECTED")
      expect(data.reviewNotes).toBe("Container port is misconfigured")
      expect(data.reviewedBy).toBe("admin-user")
    })
  })

  describe("POST /admin/templates/:id/toggle-featured", () => {
    it("toggles isFeatured boolean flag", async () => {
      const res = await adminTemplateRoutes.handle(
        new Request("http://localhost/admin/templates/tpl-1/toggle-featured", {
          method: "POST",
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.isFeatured).toBe(true)

      const res2 = await adminTemplateRoutes.handle(
        new Request("http://localhost/admin/templates/tpl-1/toggle-featured", {
          method: "POST",
        })
      )
      expect(res2.status).toBe(200)
      const data2 = await res2.json()
      expect(data2.isFeatured).toBe(false)
    })
  })
  describe("POST /admin/templates blueprint validation", () => {
    it("rejects invalid blueprintJson with 400", async () => {
      const res = await adminTemplateRoutes.handle(
        new Request("http://localhost/admin/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: "invalid-bp-tpl",
            name: "Invalid BP Template",
            tagline: "Tagline",
            description: "Description",
            category: "CMS",
            visibility: "PUBLIC",
            blueprintJson: { version: "1.0.0" }, // missing runtime, resources
          }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe("Invalid blueprintJson")
      expect(data.details).toBeDefined()
    })

    it("creates template when blueprintJson is valid", async () => {
      const res = await adminTemplateRoutes.handle(
        new Request("http://localhost/admin/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: "valid-bp-tpl",
            name: "Valid BP Template",
            tagline: "Tagline",
            description: "Description",
            category: "CMS",
            visibility: "PUBLIC",
            blueprintJson: validBlueprint,
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.slug).toBe("valid-bp-tpl")
    })
  })

  describe("PUT /admin/templates/:id blueprint validation", () => {
    it("rejects invalid blueprintJson with 400", async () => {
      const res = await adminTemplateRoutes.handle(
        new Request("http://localhost/admin/templates/tpl-1", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blueprintJson: { version: "1.0.0" }, // missing runtime, resources
          }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe("Invalid blueprintJson")
    })

    it("updates template when blueprintJson is valid", async () => {
      const res = await adminTemplateRoutes.handle(
        new Request("http://localhost/admin/templates/tpl-1", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blueprintJson: validBlueprint,
          }),
        })
      )
      expect(res.status).toBe(200)
    })
  })
})
