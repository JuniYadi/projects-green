import { prisma } from "@/lib/prisma"
import { StackStatus, type Prisma } from "@prisma/client"

export type AdminDeploymentDTO = {
  id: string
  stackId: string
  stackSlug: string
  stackName: string
  organizationId: string
  status: string
  triggerType: string
  commitSha: string | null
  commitMessage: string | null
  commitAuthor: string | null
  branchName: string
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  failureReason: string | null
  createdAt: string
  updatedAt: string
  eventsCount: number
}

export type AdminDeploymentsListQuery = {
  page?: number
  limit?: number
  organizationId?: string
  query?: string
  status?: string
}

export async function listAdminDeployments(
  params: AdminDeploymentsListQuery = {}
) {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(100, Math.max(1, params.limit ?? 20))
  const skip = (page - 1) * limit

  const where: Prisma.ApplicationDeploymentWhereInput = {}

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
      { commitSha: { contains: query, mode: "insensitive" } },
      { commitMessage: { contains: query, mode: "insensitive" } },
      { branchName: { contains: query, mode: "insensitive" } },
      { stack: { slug: { contains: query, mode: "insensitive" } } },
      { stack: { name: { contains: query, mode: "insensitive" } } },
    ]
  }

  const [total, deployments] = await Promise.all([
    prisma.applicationDeployment.count({ where }),
    prisma.applicationDeployment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        stack: {
          select: {
            slug: true,
            name: true,
            framework: true,
          },
        },
        _count: {
          select: {
            events: true,
          },
        },
      },
    }),
  ])

  const data: AdminDeploymentDTO[] = deployments.map((d) => {
    const started = d.startedAt
      ? new Date(d.startedAt).getTime()
      : new Date(d.createdAt).getTime()
    const completed = d.completedAt ? new Date(d.completedAt).getTime() : null
    const durationMs = completed ? Math.max(0, completed - started) : null

    return {
      id: d.id,
      stackId: d.stackId,
      stackSlug: d.stack.slug,
      stackName: d.stack.name,
      organizationId: d.organizationId,
      status: d.status,
      triggerType: d.triggerType,
      commitSha: d.commitSha,
      commitMessage: d.commitMessage,
      commitAuthor: d.commitAuthor,
      branchName: d.branchName,
      startedAt: (d.startedAt ?? d.createdAt).toISOString(),
      completedAt: d.completedAt ? d.completedAt.toISOString() : null,
      durationMs,
      failureReason: d.failureReason,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      eventsCount: d._count.events,
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
