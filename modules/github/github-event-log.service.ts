import { Prisma } from "@prisma/client"

export type GithubEventDeletedState = "active" | "deleted" | "include_deleted"

export type GithubEventLogQuery = {
  page?: number
  pageSize?: number
  search?: string
  eventName?: string
  processStatus?: string
  eventDisposition?: string
  repositoryFullName?: string
  branch?: string
  from?: string
  until?: string
  deletedState?: GithubEventDeletedState
  sort?:
    | "receivedAt"
    | "eventName"
    | "repositoryFullName"
    | "branch"
    | "processStatus"
    | "eventDisposition"
  order?: "asc" | "desc"
}

type EventLogPrisma = {
  githubWebhookEvent: {
    findMany: (args: {
      where?: Prisma.GithubWebhookEventWhereInput
      select?: Prisma.GithubWebhookEventSelect
      orderBy?: Record<string, string>
      skip?: number
      take?: number
    }) => Promise<unknown[]>
    count: (args: {
      where?: Prisma.GithubWebhookEventWhereInput
    }) => Promise<number>
    findUnique: (args: {
      where: { id: string }
      select?: Prisma.GithubWebhookEventSelect
    }) => Promise<unknown>
    update: (args: {
      where: { id: string }
      data: Record<string, unknown>
    }) => Promise<unknown>
    updateMany: (args: {
      where: Prisma.GithubWebhookEventWhereInput
      data: Record<string, unknown>
    }) => Promise<{ count: number }>
    deleteMany: (args: {
      where: Prisma.GithubWebhookEventWhereInput
    }) => Promise<{ count: number }>
  }
}

const listSelect = {
  id: true,
  deliveryId: true,
  eventName: true,
  action: true,
  githubInstallationId: true,
  githubRepositoryId: true,
  repositoryFullName: true,
  repositoryOwner: true,
  repositoryName: true,
  ref: true,
  branch: true,
  commitSha: true,
  commitMessage: true,
  commitAuthorName: true,
  commitAuthorEmail: true,
  commitUrl: true,
  senderLogin: true,
  senderAvatarUrl: true,
  repositoryConnectionId: true,
  applicationStackId: true,
  eventDisposition: true,
  ignoreReason: true,
  responseStatus: true,
  handlerDurationMs: true,
  enqueueStatus: true,
  processStatus: true,
  processError: true,
  receivedAt: true,
  processedAt: true,
  deletedAt: true,
  deleteReason: true,
  permanentDeleteAfter: true,
} satisfies Prisma.GithubWebhookEventSelect

const buildWhere = (
  query: GithubEventLogQuery
): Prisma.GithubWebhookEventWhereInput => {
  const where: Prisma.GithubWebhookEventWhereInput = {}

  if (!query.deletedState || query.deletedState === "active") {
    where.deletedAt = null
  } else if (query.deletedState === "deleted") {
    where.deletedAt = { not: null }
  }

  if (!query.eventDisposition) {
    where.eventDisposition = { in: ["tracked", "error"] }
  } else {
    where.eventDisposition = query.eventDisposition
  }

  if (query.eventName) where.eventName = query.eventName
  if (query.processStatus) where.processStatus = query.processStatus
  if (query.repositoryFullName)
    where.repositoryFullName = query.repositoryFullName
  if (query.branch) where.branch = query.branch

  if (query.from || query.until) {
    where.receivedAt = {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.until ? { lte: new Date(query.until) } : {}),
    }
  }

  if (query.search?.trim()) {
    const contains = query.search.trim()
    where.OR = [
      { repositoryFullName: { contains, mode: "insensitive" } },
      { commitSha: { contains, mode: "insensitive" } },
      { commitMessage: { contains, mode: "insensitive" } },
      { senderLogin: { contains, mode: "insensitive" } },
      { deliveryId: { contains, mode: "insensitive" } },
    ]
  }

  return where
}

export const listGithubWebhookEvents = async ({
  prisma,
  query,
}: {
  prisma: EventLogPrisma
  query: GithubEventLogQuery
}) => {
  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25))
  const sort = query.sort ?? "receivedAt"
  const order = query.order ?? "desc"
  const where = buildWhere(query)

  const [items, total] = await Promise.all([
    prisma.githubWebhookEvent.findMany({
      where,
      select: listSelect,
      orderBy: { [sort]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.githubWebhookEvent.count({ where }),
  ])

  return { items, total, page, pageSize }
}

export const getGithubWebhookEventDetail = ({
  prisma,
  id,
}: {
  prisma: EventLogPrisma
  id: string
}) =>
  prisma.githubWebhookEvent.findUnique({
    where: { id },
    select: {
      id: true,
      deliveryId: true,
      eventName: true,
      action: true,
      githubInstallationId: true,
      githubRepositoryId: true,
      repositoryFullName: true,
      repositoryOwner: true,
      repositoryName: true,
      ref: true,
      branch: true,
      commitSha: true,
      commitMessage: true,
      commitAuthorName: true,
      commitAuthorEmail: true,
      commitUrl: true,
      senderLogin: true,
      senderAvatarUrl: true,
      repositoryConnectionId: true,
      applicationStackId: true,
      eventDisposition: true,
      ignoreReason: true,
      responseStatus: true,
      handlerDurationMs: true,
      enqueueStatus: true,
      processStatus: true,
      processError: true,
      payloadJson: true,
      receivedAt: true,
      processedAt: true,
      deletedAt: true,
      deleteReason: true,
      permanentDeleteAfter: true,
    },
  })

export const restoreGithubWebhookEvent = ({
  prisma,
  id,
}: {
  prisma: EventLogPrisma
  id: string
}) =>
  prisma.githubWebhookEvent.update({
    where: { id },
    data: {
      deletedAt: null,
      deleteReason: null,
      permanentDeleteAfter: null,
    },
  })

export const cleanupGithubWebhookEvents = async ({
  prisma,
  now = new Date(),
}: {
  prisma: EventLogPrisma
  now?: Date
}) => {
  const softDeleteBefore = new Date(now)
  softDeleteBefore.setDate(softDeleteBefore.getDate() - 30)

  const permanentDeleteAfter = new Date(now)
  permanentDeleteAfter.setDate(permanentDeleteAfter.getDate() + 15)

  const softDeleteResult = await prisma.githubWebhookEvent.updateMany({
    where: {
      deletedAt: null,
      receivedAt: { lt: softDeleteBefore },
    },
    data: {
      deletedAt: now,
      deleteReason: "retention_30_days",
      permanentDeleteAfter,
    },
  })

  const permanentDeleteResult = await prisma.githubWebhookEvent.deleteMany({
    where: {
      deletedAt: { not: null },
      permanentDeleteAfter: { lte: now },
    },
  })

  return {
    softDeleted: softDeleteResult.count,
    permanentlyDeleted: permanentDeleteResult.count,
  }
}
