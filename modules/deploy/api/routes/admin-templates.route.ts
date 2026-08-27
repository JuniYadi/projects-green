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
