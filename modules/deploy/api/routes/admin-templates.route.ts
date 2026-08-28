import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { prisma } from "@/lib/prisma"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import { hasScopedSuperAdminClaim } from "@/modules/tenants/tenant-policy"
import type { Prisma } from "@prisma/client"

export const adminTemplateRoutes = new Elysia({ prefix: "/admin/templates" })
  // GET /api/admin/templates - List all templates with filters (visibility, category, search)
  .get(
    "/",
    async ({ query, set }) => {
      const auth = await withAuth({ ensureSignedIn: true })
      if (!auth.user) {
        set.status = 401
        return { error: "Unauthorized" }
      }

      const platformRole = await getPlatformRoleForUser(auth.user)
      const isSuperAdmin =
        platformRole === "super_admin" ||
        hasScopedSuperAdminClaim(auth.role ?? null, auth.roles ?? null)

      if (!isSuperAdmin) {
        set.status = 403
        return { error: "Forbidden: Super Admin access required" }
      }

      const where: Prisma.AppTemplateWhereInput = {}

      if (query.visibility) {
        where.visibility =
          query.visibility as Prisma.EnumAppTemplateVisibilityFilter["equals"]
      }

      if (query.category) {
        where.category =
          query.category as Prisma.EnumAppTemplateCategoryFilter["equals"]
      }

      if (query.search?.trim()) {
        const term = query.search.trim()
        where.AND = [
          {
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { tagline: { contains: term, mode: "insensitive" } },
              { description: { contains: term, mode: "insensitive" } },
              { slug: { contains: term, mode: "insensitive" } },
            ],
          },
        ]
      }

      const templates = await prisma.appTemplate.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
      })

      return templates
    },
    {
      query: t.Object({
        visibility: t.Optional(t.String()),
        category: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    }
  )

  // GET /api/admin/templates/:id - Get single template by ID
  .get(
    "/:id",
    async ({ params: { id }, set }) => {
      const auth = await withAuth({ ensureSignedIn: true })
      if (!auth.user) {
        set.status = 401
        return { error: "Unauthorized" }
      }

      const platformRole = await getPlatformRoleForUser(auth.user)
      const isSuperAdmin =
        platformRole === "super_admin" ||
        hasScopedSuperAdminClaim(auth.role ?? null, auth.roles ?? null)

      if (!isSuperAdmin) {
        set.status = 403
        return { error: "Forbidden: Super Admin access required" }
      }

      const template = await prisma.appTemplate.findUnique({
        where: { id },
      })

      if (!template) {
        set.status = 404
        return { error: "Template not found" }
      }

      return template
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  // POST /api/admin/templates - Create a new official or platform template
  .post(
    "/",
    async ({ body, set }) => {
      const auth = await withAuth({ ensureSignedIn: true })
      if (!auth.user) {
        set.status = 401
        return { error: "Unauthorized" }
      }

      const platformRole = await getPlatformRoleForUser(auth.user)
      const isSuperAdmin =
        platformRole === "super_admin" ||
        hasScopedSuperAdminClaim(auth.role ?? null, auth.roles ?? null)

      if (!isSuperAdmin) {
        set.status = 403
        return { error: "Forbidden: Super Admin access required" }
      }

      const existing = await prisma.appTemplate.findUnique({
        where: { slug: body.slug },
      })
      if (existing) {
        set.status = 409
        return { error: "Template slug already exists" }
      }

      const template = await prisma.appTemplate.create({
        data: {
          slug: body.slug,
          name: body.name,
          tagline: body.tagline,
          description: body.description,
          readmeMarkdown: body.readmeMarkdown,
          iconUrl: body.iconUrl,
          category:
            body.category as Prisma.EnumAppTemplateCategoryFilter["equals"],
          visibility:
            body.visibility as Prisma.EnumAppTemplateVisibilityFilter["equals"],
          version: body.version || "1.0.0",
          blueprintJson: body.blueprintJson,
          isOfficial: body.isOfficial ?? true,
          isFeatured: body.isFeatured ?? false,
          priceMonthly:
            body.priceMonthly !== undefined
              ? new Prisma.Decimal(body.priceMonthly.toString())
              : null,
          currency: body.currency || "USD",
          reviewedBy: auth.user.id,
          verifiedAt: body.visibility === "PUBLIC" ? new Date() : null,
        },
      })

      return template
    },
    {
      body: t.Object({
        slug: t.String(),
        name: t.String(),
        tagline: t.String(),
        description: t.String(),
        readmeMarkdown: t.Optional(t.String()),
        iconUrl: t.Optional(t.String()),
        category: t.String(),
        visibility: t.String(),
        version: t.Optional(t.String()),
        blueprintJson: t.Any(),
        isOfficial: t.Optional(t.Boolean()),
        isFeatured: t.Optional(t.Boolean()),
        priceMonthly: t.Optional(t.Union([t.Number(), t.String()])),
        currency: t.Optional(t.String()),
      }),
    }
  )

  // PUT /api/admin/templates/:id - Update existing template
  .put(
    "/:id",
    async ({ params: { id }, body, set }) => {
      const auth = await withAuth({ ensureSignedIn: true })
      if (!auth.user) {
        set.status = 401
        return { error: "Unauthorized" }
      }

      const platformRole = await getPlatformRoleForUser(auth.user)
      const isSuperAdmin =
        platformRole === "super_admin" ||
        hasScopedSuperAdminClaim(auth.role ?? null, auth.roles ?? null)

      if (!isSuperAdmin) {
        set.status = 403
        return { error: "Forbidden: Super Admin access required" }
      }

      const existing = await prisma.appTemplate.findUnique({
        where: { id },
      })
      if (!existing) {
        set.status = 404
        return { error: "Template not found" }
      }

      if (body.slug && body.slug !== existing.slug) {
        const slugConflict = await prisma.appTemplate.findUnique({
          where: { slug: body.slug },
        })
        if (slugConflict) {
          set.status = 409
          return { error: "Template slug already in use" }
        }
      }

      const updated = await prisma.appTemplate.update({
        where: { id },
        data: {
          slug: body.slug ?? existing.slug,
          name: body.name ?? existing.name,
          tagline: body.tagline ?? existing.tagline,
          description: body.description ?? existing.description,
          readmeMarkdown:
            body.readmeMarkdown !== undefined
              ? body.readmeMarkdown
              : existing.readmeMarkdown,
          iconUrl: body.iconUrl !== undefined ? body.iconUrl : existing.iconUrl,
          category:
            (body.category as Prisma.EnumAppTemplateCategoryFilter["equals"]) ??
            existing.category,
          visibility:
            (body.visibility as Prisma.EnumAppTemplateVisibilityFilter["equals"]) ??
            existing.visibility,
          version: body.version ?? existing.version,
          blueprintJson: body.blueprintJson ?? existing.blueprintJson,
          isOfficial:
            body.isOfficial !== undefined
              ? body.isOfficial
              : existing.isOfficial,
          isFeatured:
            body.isFeatured !== undefined
              ? body.isFeatured
              : existing.isFeatured,
          priceMonthly:
            body.priceMonthly !== undefined
              ? new Prisma.Decimal(body.priceMonthly.toString())
              : existing.priceMonthly,
          currency: body.currency ?? existing.currency,
          reviewedBy: auth.user.id,
          verifiedAt:
            body.visibility === "PUBLIC" && !existing.verifiedAt
              ? new Date()
              : existing.verifiedAt,
        },
      })

      return updated
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        slug: t.Optional(t.String()),
        name: t.Optional(t.String()),
        tagline: t.Optional(t.String()),
        description: t.Optional(t.String()),
        readmeMarkdown: t.Optional(t.String()),
        iconUrl: t.Optional(t.String()),
        category: t.Optional(t.String()),
        visibility: t.Optional(t.String()),
        version: t.Optional(t.String()),
        blueprintJson: t.Optional(t.Any()),
        isOfficial: t.Optional(t.Boolean()),
        isFeatured: t.Optional(t.Boolean()),
        priceMonthly: t.Optional(t.Union([t.Number(), t.String()])),
        currency: t.Optional(t.String()),
      }),
    }
  )

  // DELETE /api/admin/templates/:id - Delete template
  .delete(
    "/:id",
    async ({ params: { id }, set }) => {
      const auth = await withAuth({ ensureSignedIn: true })
      if (!auth.user) {
        set.status = 401
        return { error: "Unauthorized" }
      }

      const platformRole = await getPlatformRoleForUser(auth.user)
      const isSuperAdmin =
        platformRole === "super_admin" ||
        hasScopedSuperAdminClaim(auth.role ?? null, auth.roles ?? null)

      if (!isSuperAdmin) {
        set.status = 403
        return { error: "Forbidden: Super Admin access required" }
      }

      const existing = await prisma.appTemplate.findUnique({
        where: { id },
      })
      if (!existing) {
        set.status = 404
        return { error: "Template not found" }
      }

      await prisma.appTemplate.delete({
        where: { id },
      })

      return { success: true, id }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )
  // POST /api/admin/templates/:id/approve - Approve template
  .post(
    "/:id/approve",
    async ({ params: { id }, set }) => {
      const auth = await withAuth({ ensureSignedIn: true })
      if (!auth.user) {
        set.status = 401
        return { error: "Unauthorized" }
      }

      const platformRole = await getPlatformRoleForUser(auth.user)
      const isSuperAdmin =
        platformRole === "super_admin" ||
        hasScopedSuperAdminClaim(auth.role ?? null, auth.roles ?? null)

      if (!isSuperAdmin) {
        set.status = 403
        return { error: "Forbidden: Super Admin access required" }
      }

      const template = await prisma.appTemplate.findUnique({
        where: { id },
      })

      if (!template) {
        set.status = 404
        return { error: "Template not found" }
      }

      const updated = await prisma.appTemplate.update({
        where: { id },
        data: {
          visibility: "PUBLIC",
          verifiedAt: new Date(),
          reviewedBy: auth.user.id,
        },
      })

      return updated
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  // POST /api/admin/templates/:id/reject - Reject template
  .post(
    "/:id/reject",
    async ({ params: { id }, body, set }) => {
      const auth = await withAuth({ ensureSignedIn: true })
      if (!auth.user) {
        set.status = 401
        return { error: "Unauthorized" }
      }

      const platformRole = await getPlatformRoleForUser(auth.user)
      const isSuperAdmin =
        platformRole === "super_admin" ||
        hasScopedSuperAdminClaim(auth.role ?? null, auth.roles ?? null)

      if (!isSuperAdmin) {
        set.status = 403
        return { error: "Forbidden: Super Admin access required" }
      }

      const template = await prisma.appTemplate.findUnique({
        where: { id },
      })

      if (!template) {
        set.status = 404
        return { error: "Template not found" }
      }

      const updated = await prisma.appTemplate.update({
        where: { id },
        data: {
          visibility: "REJECTED",
          reviewNotes: body.reviewNotes,
          reviewedBy: auth.user.id,
        },
      })

      return updated
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        reviewNotes: t.String(),
      }),
    }
  )

  // POST /api/admin/templates/:id/toggle-featured - Toggle isFeatured boolean
  .post(
    "/:id/toggle-featured",
    async ({ params: { id }, set }) => {
      const auth = await withAuth({ ensureSignedIn: true })
      if (!auth.user) {
        set.status = 401
        return { error: "Unauthorized" }
      }

      const platformRole = await getPlatformRoleForUser(auth.user)
      const isSuperAdmin =
        platformRole === "super_admin" ||
        hasScopedSuperAdminClaim(auth.role ?? null, auth.roles ?? null)

      if (!isSuperAdmin) {
        set.status = 403
        return { error: "Forbidden: Super Admin access required" }
      }

      const template = await prisma.appTemplate.findUnique({
        where: { id },
      })

      if (!template) {
        set.status = 404
        return { error: "Template not found" }
      }

      const updated = await prisma.appTemplate.update({
        where: { id },
        data: {
          isFeatured: !template.isFeatured,
        },
      })

      return updated
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )
