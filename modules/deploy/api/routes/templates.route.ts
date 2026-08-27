import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { prisma } from "@/lib/prisma"
import { validateBlueprint } from "@/modules/deploy/blueprint/app-template-blueprint.service"
import type { Prisma } from "@prisma/client"

export const slugify = (value: string): string => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
  return slug || "template"
}

export const appTemplateRoutes = new Elysia({ prefix: "/templates" })
  // GET /api/templates - Public & official templates only
  .get(
    "/",
    async ({ query }) => {
      const where: Prisma.AppTemplateWhereInput = {
        OR: [{ visibility: "PUBLIC" }, { isOfficial: true }],
      }

      if (query.category) {
        where.category =
          query.category as Prisma.EnumAppTemplateCategoryFilter["equals"]
      }

      if (query.featured !== undefined) {
        where.isFeatured = query.featured === "true" || query.featured === "1"
      }

      if (query.search?.trim()) {
        const term = query.search.trim()
        where.AND = [
          {
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { tagline: { contains: term, mode: "insensitive" } },
              { description: { contains: term, mode: "insensitive" } },
            ],
          },
        ]
      }

      const templates = await prisma.appTemplate.findMany({
        where,
        orderBy: [
          { isFeatured: "desc" },
          { installCount: "desc" },
          { createdAt: "desc" },
        ],
      })

      return templates
    },
    {
      query: t.Object({
        category: t.Optional(t.String()),
        search: t.Optional(t.String()),
        featured: t.Optional(t.String()),
      }),
    }
  )

  // GET /api/templates/workspace - Authenticated tenant organization templates only
  .get("/workspace", async ({ set }) => {
    const auth = await withAuth()
    if (!auth.user) {
      set.status = 401
      return { error: "UNAUTHORIZED", message: "Authentication required." }
    }
    if (!auth.organizationId) {
      set.status = 403
      return {
        error: "NO_ORGANIZATION",
        message: "Active organization context required.",
      }
    }

    const templates = await prisma.appTemplate.findMany({
      where: {
        organizationId: auth.organizationId,
      },
      orderBy: { createdAt: "desc" },
    })

    return templates
  })

  // GET /api/templates/:slug - Fetch template by slug (public/official or caller's org)
  .get(
    "/:slug",
    async ({ params: { slug }, set }) => {
      const auth = await withAuth()

      const template = await prisma.appTemplate.findUnique({
        where: { slug },
      })

      if (!template) {
        set.status = 404
        return { error: "NOT_FOUND", message: "Template not found." }
      }

      const isPublicOrOfficial =
        template.visibility === "PUBLIC" || template.isOfficial
      const isOwner =
        Boolean(auth.organizationId) &&
        template.organizationId === auth.organizationId

      if (!isPublicOrOfficial && !isOwner) {
        set.status = 404
        return { error: "NOT_FOUND", message: "Template not found." }
      }

      return template
    },
    {
      params: t.Object({
        slug: t.String(),
      }),
    }
  )

  // POST /api/templates - Create custom template tied to caller's org
  .post(
    "/",
    async ({ body, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { error: "UNAUTHORIZED", message: "Authentication required." }
      }
      if (!auth.organizationId) {
        set.status = 403
        return {
          error: "NO_ORGANIZATION",
          message: "Active organization context required.",
        }
      }

      const VALID_CATEGORIES = [
        "AI",
        "AUTOMATION",
        "CMS",
        "DATABASE",
        "DEVELOPER_TOOLS",
        "ANALYTICS",
        "UTILITIES",
      ] as const
      if (
        !VALID_CATEGORIES.includes(
          body.category as (typeof VALID_CATEGORIES)[number]
        )
      ) {
        set.status = 422
        return {
          error: "INVALID_CATEGORY",
          message: "Category must be one of the allowed values.",
        }
      }

      const validation = validateBlueprint(body.blueprintJson)
      if (!validation.valid || !validation.data) {
        set.status = 422
        return {
          error: "INVALID_BLUEPRINT",
          message: "Blueprint validation failed.",
          errors: validation.errors,
        }
      }
      const baseSlug = slugify(body.name)
      let uniqueSlug = baseSlug
      let counter = 1

      // Ensure slug uniqueness
      while (
        await prisma.appTemplate.findUnique({ where: { slug: uniqueSlug } })
      ) {
        uniqueSlug = `${baseSlug}-${counter}`
        counter++
      }

      const created = await prisma.appTemplate.create({
        data: {
          organizationId: auth.organizationId,
          slug: uniqueSlug,
          name: body.name.trim(),
          tagline: body.tagline.trim(),
          description: body.description.trim(),
          category:
            body.category as Prisma.EnumAppTemplateCategoryFilter["equals"],
          blueprintJson: validation.data as unknown as Prisma.InputJsonValue,
          iconUrl: body.iconUrl?.trim() || null,
          readmeMarkdown: body.readmeMarkdown?.trim() || null,
          visibility: "PRIVATE",
          isOfficial: false,
          isFeatured: false,
        },
      })

      set.status = 201
      return created
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        tagline: t.String({ minLength: 1 }),
        description: t.String({ minLength: 1 }),
        category: t.String(),
        blueprintJson: t.Any(),
        iconUrl: t.Optional(t.String()),
        readmeMarkdown: t.Optional(t.String()),
      }),
    }
  )

  // POST /api/templates/:id/submit-review - Sets visibility to PENDING_REVIEW if caller owns it
  .post(
    "/:id/submit-review",
    async ({ params: { id }, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { error: "UNAUTHORIZED", message: "Authentication required." }
      }
      if (!auth.organizationId) {
        set.status = 403
        return {
          error: "NO_ORGANIZATION",
          message: "Active organization context required.",
        }
      }

      const template = await prisma.appTemplate.findUnique({
        where: { id },
      })

      if (!template || template.organizationId !== auth.organizationId) {
        set.status = 404
        return { error: "NOT_FOUND", message: "Template not found." }
      }
      if (
        template.visibility !== "PRIVATE" &&
        template.visibility !== "REJECTED"
      ) {
        set.status = 422
        return {
          error: "INVALID_STATE",
          message:
            "Only PRIVATE or REJECTED templates can be submitted for review.",
        }
      }

      const updated = await prisma.appTemplate.update({
        where: { id },
        data: {
          visibility: "PENDING_REVIEW",
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
