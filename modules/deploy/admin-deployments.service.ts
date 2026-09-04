import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

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

  if (params.organizationId && params.organizationId.trim()) {
    where.organizationId = {
      contains: params.organizationId.trim(),
      mode: "insensitive",
    }
  }

  if (params.status && params.status !== "ALL") {
    where.status = params.status as Prisma.EnumStackStatusFilter["equals"]
  }

  if (params.query && params.query.trim()) {
    const q = params.query.trim()
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      { commitSha: { contains: q, mode: "insensitive" } },
      { commitMessage: { contains: q, mode: "insensitive" } },
      { branchName: { contains: q, mode: "insensitive" } },
      { stack: { slug: { contains: q, mode: "insensitive" } } },
      { stack: { name: { contains: q, mode: "insensitive" } } },
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
      startedAt: d.startedAt.toISOString(),
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
