import { prisma } from "@/lib/prisma"
import { getCachedOrganizations } from "@/lib/workos-directory"
import { StackStatus, type Prisma } from "@prisma/client"
import { releaseManagedStock } from "@/modules/deploy/app-managed-stock.service"

export type AdminStackDTO = {
  id: string
  slug: string
  name: string
  framework: string | null
  organizationId: string
  organizationName: string | null
  status: string
  subdomain: string | null
  customDomain: string | null
  clusterName: string | null
  clusterCode: string | null
  cpu: number | null
  memory: number | null
  replicas: number | null
  billingMode: string | null
  billingState: string | null
  createdAt: string
  updatedAt: string
  lastDeployedAt: string | null
  deploymentsCount: number
}

export type AdminStacksListQuery = {
  page?: number
  limit?: number
  organizationId?: string
  query?: string
  status?: string
}

export async function listAdminStacks(params: AdminStacksListQuery = {}) {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(100, Math.max(1, params.limit ?? 20))
  const skip = (page - 1) * limit

  const where: Prisma.ApplicationStackWhereInput = {}

  const organizationId = params.organizationId?.trim()
  if (
    organizationId &&
    organizationId !== "undefined" &&
    organizationId !== "null"
  ) {
    where.organizationId = {
      contains: organizationId,
      mode: "insensitive",
    }
  }

  const status = params.status?.trim()
  if (
    status &&
    status !== "ALL" &&
    status !== "undefined" &&
    status !== "null" &&
    (Object.values(StackStatus) as string[]).includes(status)
  ) {
    where.status = status as StackStatus
  }

  const query = params.query?.trim()
  if (query && query !== "undefined" && query !== "null") {
    where.OR = [
      { id: { contains: query, mode: "insensitive" } },
      { slug: { contains: query, mode: "insensitive" } },
      { name: { contains: query, mode: "insensitive" } },
    ]
  }

  const [total, stacks] = await Promise.all([
    prisma.applicationStack.count({ where }),
    prisma.applicationStack.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        cluster: {
          select: {
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            deployments: true,
          },
        },
      },
    }),
  ])

  const orgIds = stacks.map((s) => s.organizationId).filter(Boolean)
  const orgMap = await getCachedOrganizations(orgIds)

  const data: AdminStackDTO[] = stacks.map((s) => {
    const meta =
      typeof s.metadataJson === "object" && s.metadataJson !== null
        ? (s.metadataJson as Record<string, unknown>)
        : {}

    const billingState =
      meta.billingState === "SUSPENDED"
        ? "SUSPENDED"
        : meta.billingState === "PAYMENT_GRACE"
          ? "PAYMENT_GRACE"
          : "ACTIVE"

    return {
      id: s.id,
      slug: s.slug,
      name: s.name,
      framework: s.framework ?? null,
      organizationId: s.organizationId,
      organizationName: orgMap.get(s.organizationId)?.name ?? null,
      status: s.status,
      subdomain: s.subdomain ?? null,
      customDomain: s.customDomain ?? null,
      clusterName: s.cluster?.name ?? null,
      clusterCode: s.cluster?.code ?? null,
      cpu: s.cpu ?? null,
      memory: s.memory ?? null,
      replicas: typeof meta.replicas === "number" ? meta.replicas : null,
      billingMode: s.billingMode ?? null,
      billingState,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      lastDeployedAt: s.lastDeployedAt ? s.lastDeployedAt.toISOString() : null,
      deploymentsCount: s._count.deployments,
    }
  })

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

/**
 * Admin suspend: sets the stack status to STOPPED.
 * This is an administrative override that marks the app as stopped in the DB.
 * A follow-up ArgoCD/Helm sync will reconcile the runtime state.
 */
export async function adminSuspendStack(stackId: string) {
  const stack = await prisma.applicationStack.findUnique({
    where: { id: stackId },
  })
  if (!stack) throw new Error(`NOT_FOUND: Stack ${stackId} not found`)

  return prisma.applicationStack.update({
    where: { id: stackId },
    data: {
      status: "STOPPED",
    },
  })
}

/**
 * Admin terminate: removes the stack record and releases any managed DB stock.
 * Stock cleanup is deliberately non-fatal so stale Vault state cannot block
 * removal of the stack itself.
 */
export async function adminDeleteStack(stackId: string) {
  const stack = await prisma.applicationStack.findUnique({
    where: { id: stackId },
  })
  if (!stack) throw new Error(`NOT_FOUND: Stack ${stackId} not found`)

  await releaseManagedStock(stackId).catch((error) => {
    console.error(
      `[adminDeleteStack] releaseManagedStock failed for stack ${stackId}:`,
      error
    )
  })

  return prisma.applicationStack.delete({ where: { id: stackId } })
}
