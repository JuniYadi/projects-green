import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { prisma } from "@/lib/prisma"

export const createDocsConsoleRoutes = () =>
  new Elysia()
    .get("/docs/list", async ({ set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      const organizationId = auth.organizationId ?? null

      // Fetch all docs visible to this org (org-specific + global)
      // If an org doc exists for a path, it should probably override or be listed alongside.
      // For a simple listing, we'll fetch all and group by path, preferring org-specific.
      const docs = await prisma.knowledgeDocument.findMany({
        where: {
          OR: [
            { organizationId: organizationId },
            { organizationId: null }
          ]
        },
        orderBy: [
          { path: "asc" },
          { organizationId: "desc" } // nulls last in some DBs, but here we want non-null first for same path
        ]
      })

      // Unique by path, preferring organizationId if present
      const uniqueDocs = Array.from(
        docs.reduce((acc, doc) => {
          if (!acc.has(doc.path) || doc.organizationId !== null) {
            acc.set(doc.path, {
              id: doc.id,
              path: doc.path,
              title: doc.title,
              updatedAt: doc.updatedAt.toISOString(),
              isGlobal: doc.organizationId === null
            })
          }
          return acc
        }, new Map()).values()
      )

      return {
        ok: true,
        docs: uniqueDocs
      }
    })
    .get("/docs/search", async ({ query, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      const { q } = query
      if (!q) {
        return { ok: true, docs: [] }
      }

      const organizationId = auth.organizationId ?? null

      // Simple search for now
      const docs = await prisma.knowledgeDocument.findMany({
        where: {
          AND: [
            {
              OR: [
                { organizationId: organizationId },
                { organizationId: null }
              ]
            },
            {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { searchText: { contains: q, mode: "insensitive" } }
              ]
            }
          ]
        },
        take: 10
      })

      return {
        ok: true,
        docs: docs.map(d => ({
          id: d.id,
          path: d.path,
          title: d.title,
          updatedAt: d.updatedAt.toISOString(),
          isGlobal: d.organizationId === null
        }))
      }
    }, {
      query: t.Object({
        q: t.Optional(t.String())
      })
    })

export const docsConsoleRoutes = createDocsConsoleRoutes()
