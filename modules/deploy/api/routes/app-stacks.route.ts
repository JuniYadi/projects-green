import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { prisma } from "@/lib/prisma"
import {
  toDeploymentHistoryDTO,
  toDeploymentStatusDTO,
  toStackSummaryDTO,
  computeNextRenewalDate,
} from "../../deploy-monitor.dto"

import { mapRecentDeploySource } from "../../recent-sources.dto"

import { queryAppLogs } from "../../opensearch/opensearch-query.service"
const MAX_RECENT_SOURCE_LIMIT = 3

export const recentSourcesRoutes = new Elysia({ prefix: "/deploy" }).get(
  "/recent-sources",
  async ({ query, set }) => {
    const auth = await withAuth()
    if (!auth.user) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
    }

    if (!auth.organizationId) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Organization required" }
    }

    const requestedLimit = query.limit ?? MAX_RECENT_SOURCE_LIMIT
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(
          MAX_RECENT_SOURCE_LIMIT,
          Math.max(1, Math.floor(requestedLimit))
        )
      : MAX_RECENT_SOURCE_LIMIT
    const stacks = await prisma.applicationStack.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: { updatedAt: "desc" },
      include: {
        repositoryConnection: {
          select: {
            ownerLogin: true,
            githubRepositoryId: true,
            repoName: true,
          },
        },
      },
    })

    return {
      ok: true,
      data: stacks
        .map((stack) => mapRecentDeploySource(stack))
        .filter(
          (source): source is NonNullable<typeof source> => source !== null
        )
        .slice(0, limit),
    }
  },
  {
    query: t.Object({
      limit: t.Optional(t.Numeric()),
    }),
  }
)

const MAX_HISTORY_PAGE_SIZE = 100

export const MAX_CPU = 4000
export const MAX_MEMORY = 4096
export const MAX_ALLOWED_REPLICAS = 8

export function validateResourceBounds(params: {
  replicas: number
  cpu: number
  memory: number
  maxCpu?: number
  maxMemory?: number
  maxReplicas?: number
}): { valid: boolean; error?: string; message?: string } {
  const maxCpu = params.maxCpu ?? MAX_CPU
  const maxMemory = params.maxMemory ?? MAX_MEMORY
  const maxReplicas = params.maxReplicas ?? MAX_ALLOWED_REPLICAS

  if (params.replicas > maxReplicas) {
    return {
      valid: false,
      error: "REPLICAS_EXCEEDED",
      message: `Replicas (${params.replicas}) cannot exceed maximum allowed (${maxReplicas})`,
    }
  }

  const totalCpu = params.replicas * params.cpu
  if (totalCpu > maxCpu) {
    return {
      valid: false,
      error: "CPU_QUOTA_EXCEEDED",
      message: `Total CPU (${totalCpu}m) exceeds maximum quota (${maxCpu}m)`,
    }
  }

  const totalMemory = params.replicas * params.memory
  if (totalMemory > maxMemory) {
    return {
      valid: false,
      error: "MEMORY_QUOTA_EXCEEDED",
      message: `Total memory (${totalMemory}Mi) exceeds maximum quota (${maxMemory}Mi)`,
    }
  }

  return { valid: true }
}

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
        template: true,
        deployments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            createdAt: true,
            id: true,
            events: {
              orderBy: { createdAt: "asc" },
              select: { type: true, createdAt: true },
            },
          },
        },
      },
    })

    return {
      ok: true,
      data: stacks.map((stack) =>
        toStackSummaryDTO({
          ...stack,
          events: stack.deployments[0]?.events ?? [],
        })
      ),
    }
  })
  .get(
    "/:slug/history",
    async ({ params, query, set }) => {
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
        select: { id: true },
      })

      if (!stack) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Application not found",
        }
      }

      const page = Math.max(1, query.page ?? 1)
      const pageSize = Math.min(
        MAX_HISTORY_PAGE_SIZE,
        Math.max(1, query.pageSize ?? 20)
      )
      const where = { stackId: stack.id }
      const [total, deployments] = await Promise.all([
        prisma.applicationDeployment.count({ where }),
        prisma.applicationDeployment.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ])

      return {
        ok: true,
        data: deployments.map((deployment) =>
          toDeploymentHistoryDTO(deployment)
        ),
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      }
    },
    {
      params: t.Object({
        slug: t.String(),
      }),
      query: t.Object({
        page: t.Optional(t.Numeric({ minimum: 1 })),
        pageSize: t.Optional(t.Numeric({ minimum: 1 })),
      }),
    }
  )
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
          template: true,
          deployments: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              events: {
                orderBy: { createdAt: "asc" },
                select: { type: true, createdAt: true },
              },
            },
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

      const billingAccount = await prisma.billingAccount.findUnique({
        where: { organizationId: auth.organizationId },
        select: { currency: true },
      })
      const currency = billingAccount?.currency ?? "IDR"

      const catalogPlan = stack.resourcePlanId
        ? await prisma.servicePlan.findFirst({
            where: {
              package: { code: "APP_HOSTING" },
              code: stack.resourcePlanId.toUpperCase(),
              isActive: true,
            },
            include: {
              pricings: {
                where: { currency, isActive: true },
                take: 1,
              },
            },
          })
        : null
      return {
        ok: true,
        data: {
          stack: toStackSummaryDTO({
            ...stack,
            catalogPlan,
            events: latestDeployment?.events ?? [],
          }),
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
  .patch(
    "/:slug/scaling",
    async ({ params, body, set }) => {
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
      })

      if (!stack) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Application not found",
        }
      }

      const metadata =
        typeof stack.metadataJson === "object" && stack.metadataJson !== null
          ? (stack.metadataJson as Record<string, unknown>)
          : {}

      const replicas =
        body.replicas ??
        (typeof metadata.replicas === "number" ? metadata.replicas : 1)
      const cpu = body.cpu ?? stack.cpu ?? 1000
      const memory = body.memory ?? stack.memory ?? 512

      const validation = validateResourceBounds({
        replicas,
        cpu,
        memory,
        maxCpu: body.maxCpu ? Math.min(body.maxCpu, MAX_CPU) : MAX_CPU,
        maxMemory: body.maxMemory
          ? Math.min(body.maxMemory, MAX_MEMORY)
          : MAX_MEMORY,
        maxReplicas: body.maxReplicas
          ? Math.min(body.maxReplicas, MAX_ALLOWED_REPLICAS)
          : MAX_ALLOWED_REPLICAS,
      })

      if (!validation.valid) {
        set.status = 422
        return {
          ok: false,
          error: validation.error ?? "RESOURCE_QUOTA_EXCEEDED",
          message: validation.message ?? "Resource bounds exceeded",
        }
      }

      await prisma.applicationStack.update({
        where: { id: stack.id },
        data: {
          ...(body.cpu !== undefined ? { cpu: body.cpu } : {}),
          ...(body.memory !== undefined ? { memory: body.memory } : {}),
          metadataJson: {
            ...metadata,
            ...(body.replicas !== undefined ? { replicas: body.replicas } : {}),
          },
        },
      })

      return {
        ok: true,
        data: {
          replicas,
          cpu,
          memory,
          totalCpu: replicas * cpu,
          totalMemory: replicas * memory,
        },
      }
    },
    {
      params: t.Object({
        slug: t.String(),
      }),
      body: t.Object({
        replicas: t.Optional(t.Integer({ minimum: 1 })),
        cpu: t.Optional(t.Integer({ minimum: 1 })),
        memory: t.Optional(t.Integer({ minimum: 1 })),
        maxCpu: t.Optional(t.Integer({ minimum: 1 })),
        maxMemory: t.Optional(t.Integer({ minimum: 1 })),
        maxReplicas: t.Optional(t.Integer({ minimum: 1 })),
      }),
    }
  )
  .post(
    "/:slug/cancel",
    async ({ params, set }) => {
      const auth = await withAuth({ ensureSignedIn: true })
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
      })

      if (!stack) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Application not found",
        }
      }

      const metadata =
        typeof stack.metadataJson === "object" && stack.metadataJson !== null
          ? (stack.metadataJson as Record<string, unknown>)
          : {}

      const cancelledAt = new Date().toISOString()
      await prisma.applicationStack.update({
        where: { id: stack.id },
        data: {
          metadataJson: {
            ...metadata,
            cancellationScheduled: true,
            cancelledAt,
          },
        },
      })

      const activeUntil =
        (stack as unknown as { renewalAt?: string }).renewalAt ||
        computeNextRenewalDate(stack.createdAt) ||
        cancelledAt

      return {
        ok: true,
        message: "Service cancellation scheduled",
        activeUntil,
      }
    },
    {
      params: t.Object({
        slug: t.String(),
      }),
    }
  )
  .post(
    "/:slug/sync",
    async ({ params, set }) => {
      const auth = await withAuth({ ensureSignedIn: true })
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
      })

      if (!stack) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Application not found",
        }
      }

      await prisma.applicationStack.update({
        where: { id: stack.id },
        data: { updatedAt: new Date() },
      })

      return {
        ok: true,
        message: "Configuration synced successfully",
      }
    },
    {
      params: t.Object({
        slug: t.String(),
      }),
    }
  )
  .get(
    "/:slug/logs",
    async ({ params, query, set }) => {
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
        select: { id: true },
      })

      if (!stack) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Application not found",
        }
      }

      const limit = query.limit ? parseInt(query.limit, 10) : 100
      const order = query.order === "asc" ? "asc" : "desc"

      const result = await queryAppLogs({
        slug: params.slug,
        q: query.q,
        level: query.level as "ALL" | "INFO" | "WARN" | "ERROR" | undefined,
        source: query.source,
        from: query.from,
        to: query.to,
        limit,
        order,
      })

      return {
        ok: true,
        data: result.hits,
        total: result.total,
        took: result.took,
      }
    },
    {
      params: t.Object({
        slug: t.String(),
      }),
      query: t.Optional(
        t.Object({
          q: t.Optional(t.String()),
          level: t.Optional(t.String()),
          source: t.Optional(t.String()),
          from: t.Optional(t.String()),
          to: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          order: t.Optional(t.String()),
        })
      ),
    }
  )
