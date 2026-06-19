import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { prisma } from "@/lib/prisma"
import {
  toDeploymentStatusDTO,
  toStackSummaryDTO,
} from "../../deploy-monitor.dto"

/**
 * PGREEN-072 — Console Monitor/Manage truth path.
 *
 * Read-only stack listing + per-stack overview for the manage surface.
 * Returns real persisted ApplicationStack state (status, billing state,
 * latest deployment) so the console manage page reflects honest backend
 * state instead of simulated data. Empty results yield an honest empty
 * list rather than seeded mock apps.
 */
export const appStacksRoutes = new Elysia({ prefix: "/deploy/apps" })
  .get("/", async ({ set }) => {
    const auth = await withAuth()
    if (!auth.user) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
    }

    if (!auth.organizationId) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Organization required" }
    }

    const stacks = await prisma.applicationStack.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: { updatedAt: "desc" },
      include: {
        deployments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    })

    return { ok: true, data: stacks.map(toStackSummaryDTO) }
  })
  .get(
    "/:slug",
    async ({ params, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      if (!auth.organizationId) {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Organization required",
        }
      }

      const stack = await prisma.applicationStack.findUnique({
        where: {
          organizationId_slug: {
            organizationId: auth.organizationId,
            slug: params.slug,
          },
        },
        include: {
          deployments: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      })

      if (!stack) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Application not found",
        }
      }

      const latestDeployment = stack.deployments[0] ?? null

      return {
        ok: true,
        data: {
          stack: toStackSummaryDTO(stack),
          latestDeployment: latestDeployment
            ? toDeploymentStatusDTO(latestDeployment)
            : null,
        },
      }
    },
    {
      params: t.Object({
        slug: t.String(),
      }),
    }
  )
