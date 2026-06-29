import type {
  Prisma,
  SupportTicket as PrismaSupportTicket,
  SupportTicketAttachmentUploadSession as PrismaSupportTicketAttachmentUploadSession,
  SupportTicketAttachmentUploadTarget as PrismaSupportTicketAttachmentUploadTarget,
  SupportTicketDepartment as PrismaSupportTicketDepartment,
  SupportTicketPriority as PrismaSupportTicketPriority,
  SupportTicketReply as PrismaSupportTicketReply,
  SupportTicketService as PrismaSupportTicketService,
  SupportTicketStatus as PrismaSupportTicketStatus,
} from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { supportTicketAttachmentMetadataSchema } from "@/modules/support-tickets/support-ticket.schema"
import type {
  CreateSupportTicketInput,
  CreateSupportTicketReplyInput,
  SupportTicket,
  SupportTicketAttachmentMetadata,
  SupportTicketAttachmentUploadSession,
  SupportTicketAttachmentUploadTarget,
  SupportTicketDepartment,
  SupportTicketPriority,
  SupportTicketService as SupportTicketServiceCategory,
  SupportTicketStatus,
  SupportTicketThread,
} from "@/modules/support-tickets/support-ticket.types"

const DOMAIN_TO_PRISMA_STATUS: Record<
  SupportTicketStatus,
  PrismaSupportTicketStatus
> = {
  open: "OPEN",
  in_progress: "IN_PROGRESS",
  waiting_response: "WAITING_RESPONSE",
  on_hold: "ON_HOLD",
  resolved: "RESOLVED",
  closed: "CLOSED",
}

const PRISMA_TO_DOMAIN_STATUS: Record<
  PrismaSupportTicketStatus,
  SupportTicketStatus
> = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  WAITING_RESPONSE: "waiting_response",
  ON_HOLD: "on_hold",
  RESOLVED: "resolved",
  CLOSED: "closed",
}

const DOMAIN_TO_PRISMA_DEPARTMENT: Record<
  SupportTicketDepartment,
  PrismaSupportTicketDepartment
> = {
  billing: "BILLING",
  technical: "TECHNICAL",
  account: "ACCOUNT",
  compliance: "COMPLIANCE",
}

const PRISMA_TO_DOMAIN_DEPARTMENT: Record<
  PrismaSupportTicketDepartment,
  SupportTicketDepartment
> = {
  BILLING: "billing",
  TECHNICAL: "technical",
  ACCOUNT: "account",
  COMPLIANCE: "compliance",
}

const DOMAIN_TO_PRISMA_PRIORITY: Record<
  SupportTicketPriority,
  PrismaSupportTicketPriority
> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
}

const PRISMA_TO_DOMAIN_PRIORITY: Record<
  PrismaSupportTicketPriority,
  SupportTicketPriority
> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
}

const DOMAIN_TO_PRISMA_SERVICE: Record<
  SupportTicketServiceCategory,
  PrismaSupportTicketService
> = {
  auth: "AUTH",
  billing: "BILLING",
  deploy: "DEPLOY",
  domains: "DOMAINS",
  integrations: "INTEGRATIONS",
  data: "DATA",
  other: "OTHER",
}

const PRISMA_TO_DOMAIN_SERVICE: Record<
  PrismaSupportTicketService,
  SupportTicketServiceCategory
> = {
  AUTH: "auth",
  BILLING: "billing",
  DEPLOY: "deploy",
  DOMAINS: "domains",
  INTEGRATIONS: "integrations",
  DATA: "data",
  OTHER: "other",
}

const DOMAIN_TO_PRISMA_UPLOAD_TARGET: Record<
  SupportTicketAttachmentUploadTarget,
  PrismaSupportTicketAttachmentUploadTarget
> = {
  create: "CREATE",
  reply: "REPLY",
}

const PRISMA_TO_DOMAIN_UPLOAD_TARGET: Record<
  PrismaSupportTicketAttachmentUploadTarget,
  SupportTicketAttachmentUploadTarget
> = {
  CREATE: "create",
  REPLY: "reply",
}

const normalizeAttachmentMetadata = (
  value: Prisma.JsonValue | null
): SupportTicketAttachmentMetadata[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => supportTicketAttachmentMetadataSchema.safeParse(item))
    .filter((parsed) => parsed.success)
    .map((parsed) => parsed.data)
}

const appendUniqueAttachments = (
  current: SupportTicketAttachmentMetadata[],
  incoming: SupportTicketAttachmentMetadata[]
) => {
  const next = [...current]

  for (const item of incoming) {
    const exists = next.some((existing) => {
      return existing.id === item.id || existing.storageKey === item.storageKey
    })

    if (!exists) {
      next.push(item)
    }
  }

  return next
}

const mapUploadSessionToAttachment = (
  session: PrismaSupportTicketAttachmentUploadSession
): SupportTicketAttachmentMetadata => {
  return {
    id: session.id,
    fileName: session.fileName,
    mimeType: session.mimeType,
    sizeBytes: session.sizeBytes,
    storageKey: session.storageKey,
    checksumSha256: session.checksumSha256,
    uploadedAt: (session.registeredAt ?? session.createdAt).toISOString(),
  }
}

const mapTicketRecord = (record: PrismaSupportTicket): SupportTicket => {
  return {
    id: record.id,
    ticketNumber: record.ticketNumber,
    organizationId: record.organizationId,
    requesterWorkosUserId: record.requesterWorkosUserId,
    assignedAgentWorkosUserId: record.assignedAgentWorkosUserId,
    department: PRISMA_TO_DOMAIN_DEPARTMENT[record.department],
    priority: PRISMA_TO_DOMAIN_PRIORITY[record.priority],
    service: record.service ? PRISMA_TO_DOMAIN_SERVICE[record.service] : null,
    status: PRISMA_TO_DOMAIN_STATUS[record.status],
    subject: record.subject,
    description: record.description,
    secureForm: record.secureForm,
    attachmentMetadata: normalizeAttachmentMetadata(record.attachmentsJson),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    resolvedAt: record.resolvedAt,
    closedAt: record.closedAt,
  }
}

const mapReplyRecord = (
  record: PrismaSupportTicketReply
): SupportTicketThread["replies"][number] => {
  return {
    id: record.id,
    ticketId: record.ticketId,
    authorWorkosUserId: record.authorWorkosUserId,
    body: record.body,
    secureForm: record.secureForm,
    isInternalNote: record.isInternalNote,
    attachmentMetadata: normalizeAttachmentMetadata(record.attachmentsJson),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

const mapUploadSessionRecord = (
  record: PrismaSupportTicketAttachmentUploadSession
): SupportTicketAttachmentUploadSession => {
  return {
    id: record.id,
    organizationId: record.organizationId,
    uploaderWorkosUserId: record.uploaderWorkosUserId,
    target: PRISMA_TO_DOMAIN_UPLOAD_TARGET[record.target],
    ticketId: record.ticketId,
    fileName: record.fileName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    checksumSha256: record.checksumSha256,
    storageKey: record.storageKey,
    storageBucket: record.storageBucket,
    expiresAt: record.expiresAt,
    registeredAt: record.registeredAt,
    consumedAt: record.consumedAt,
    consumedTicketId: record.consumedTicketId,
    consumedReplyId: record.consumedReplyId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

type ConsumeUploadSessionInput = {
  organizationId: string
  ticketId: string | null
  target: SupportTicketAttachmentUploadTarget
  uploadSessionIds: string[]
  uploaderWorkosUserId: string
}

type ConsumedUploadSessions = {
  attachments: SupportTicketAttachmentMetadata[]
  consumedAt: Date
}

const consumeUploadSessions = async (
  tx: Prisma.TransactionClient,
  input: ConsumeUploadSessionInput
) => {
  if (!input.uploadSessionIds.length) {
    return {
      attachments: [] as SupportTicketAttachmentMetadata[],
      consumedAt: new Date(),
    } satisfies ConsumedUploadSessions
  }

  const uniqueIds = [...new Set(input.uploadSessionIds)]
  const now = new Date()
  const consumedAt = new Date()

  const claimResult = await tx.supportTicketAttachmentUploadSession.updateMany({
    where: {
      id: {
        in: uniqueIds,
      },
      organizationId: input.organizationId,
      uploaderWorkosUserId: input.uploaderWorkosUserId,
      target: DOMAIN_TO_PRISMA_UPLOAD_TARGET[input.target],
      ticketId: input.ticketId,
      consumedAt: null,
      registeredAt: {
        not: null,
      },
      expiresAt: {
        gt: now,
      },
    },
    data: {
      consumedAt,
    },
  })

  if (claimResult.count !== uniqueIds.length) {
    throw new Error(
      "One or more attachment upload sessions are missing, expired, or not registered."
    )
  }

  const sessions = await tx.supportTicketAttachmentUploadSession.findMany({
    where: {
      id: {
        in: uniqueIds,
      },
      consumedAt,
    },
  })

  if (sessions.length !== uniqueIds.length) {
    throw new Error("Unable to finalize attachment upload session claims.")
  }

  return {
    attachments: sessions.map(mapUploadSessionToAttachment),
    consumedAt,
  } satisfies ConsumedUploadSessions
}

export type SupportTicketRepository = {
  createReply(
    input: CreateSupportTicketReplyInput
  ): Promise<SupportTicketThread["replies"][number]>
  createTicket(
    input: CreateSupportTicketInput & { ticketNumber: string }
  ): Promise<SupportTicket>
  createUploadSession(input: {
    checksumSha256?: string | null
    expiresAt: Date
    fileName: string
    id: string
    mimeType: string
    organizationId: string
    sizeBytes: number
    storageBucket: string
    storageKey: string
    target: SupportTicketAttachmentUploadTarget
    ticketId: string | null
    uploaderWorkosUserId: string
  }): Promise<SupportTicketAttachmentUploadSession>
  getTicketById(ticketId: string): Promise<SupportTicket | null>
  getTicketThread(input: {
    includeInternalNotes?: boolean
    ticketId: string
  }): Promise<SupportTicketThread | null>
  getUploadSessionById(
    id: string
  ): Promise<SupportTicketAttachmentUploadSession | null>
  deleteUploadSession(id: string): Promise<void>
  listTicketsByOrganization(input: {
    organizationId: string
    limit?: number
  }): Promise<SupportTicket[]>
  markUploadSessionRegistered(input: {
    checksumSha256?: string | null
    fileName: string
    id: string
    mimeType: string
    organizationId: string
    sizeBytes: number
    storageBucket: string
    storageKey: string
    target: SupportTicketAttachmentUploadTarget
    ticketId: string | null
    uploaderWorkosUserId: string
  }): Promise<SupportTicketAttachmentUploadSession>
  updateTicketStatus(input: {
    closedAt: Date | null
    resolvedAt: Date | null
    status: SupportTicketStatus
    ticketId: string
  }): Promise<SupportTicket>
  listAllTickets(input: { limit?: number }): Promise<SupportTicket[]>
  updateTicket(input: {
    ticketId: string
    data: {
      department?: SupportTicketDepartment
      priority?: SupportTicketPriority
      service?: SupportTicketServiceCategory | null
      subject?: string
      description?: string | null
      status?: SupportTicketStatus
      assignedAgentWorkosUserId?: string | null
    }
    clearSecureForm?: boolean
  }): Promise<SupportTicket>
  deleteTicket(ticketId: string): Promise<boolean>
}

export const supportTicketRepository: SupportTicketRepository = {
  async createUploadSession(input) {
    const record = await prisma.supportTicketAttachmentUploadSession.create({
      data: {
        id: input.id,
        organizationId: input.organizationId,
        uploaderWorkosUserId: input.uploaderWorkosUserId,
        target: DOMAIN_TO_PRISMA_UPLOAD_TARGET[input.target],
        ticketId: input.ticketId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        checksumSha256: input.checksumSha256 ?? null,
        storageKey: input.storageKey,
        storageBucket: input.storageBucket,
        expiresAt: input.expiresAt,
      },
    })

    return mapUploadSessionRecord(record)
  },
  async getUploadSessionById(id) {
    const record = await prisma.supportTicketAttachmentUploadSession.findUnique(
      {
        where: {
          id,
        },
      }
    )

    if (!record) {
      return null
    }

    return mapUploadSessionRecord(record)
  },
  async markUploadSessionRegistered(input) {
    const existing =
      await prisma.supportTicketAttachmentUploadSession.findUnique({
        where: {
          id: input.id,
        },
      })

    if (!existing) {
      throw new Error("Attachment upload session was not found.")
    }

    const target = DOMAIN_TO_PRISMA_UPLOAD_TARGET[input.target]
    const hasMismatch =
      existing.organizationId !== input.organizationId ||
      existing.uploaderWorkosUserId !== input.uploaderWorkosUserId ||
      existing.target !== target ||
      existing.ticketId !== input.ticketId ||
      existing.storageKey !== input.storageKey ||
      existing.storageBucket !== input.storageBucket ||
      existing.fileName !== input.fileName ||
      existing.mimeType !== input.mimeType ||
      existing.sizeBytes !== input.sizeBytes ||
      (existing.checksumSha256 ?? null) !== (input.checksumSha256 ?? null)

    if (hasMismatch) {
      throw new Error("Attachment upload session payload mismatch.")
    }

    const record = await prisma.supportTicketAttachmentUploadSession.update({
      where: {
        id: input.id,
      },
      data: {
        registeredAt: new Date(),
      },
    })

    return mapUploadSessionRecord(record)
  },
  async deleteUploadSession(id) {
    await prisma.supportTicketAttachmentUploadSession.delete({
      where: { id },
    })
  },
  async createTicket(input) {
    return prisma.$transaction(async (tx) => {
      const created = await tx.supportTicket.create({
        data: {
          ticketNumber: input.ticketNumber,
          organizationId: input.organizationId,
          requesterWorkosUserId: input.requesterWorkosUserId,
          department: DOMAIN_TO_PRISMA_DEPARTMENT[input.department],
          priority: DOMAIN_TO_PRISMA_PRIORITY[input.priority],
          service: input.service
            ? DOMAIN_TO_PRISMA_SERVICE[input.service]
            : null,
          status: "OPEN",
          subject: input.subject,
          description: input.description ?? null,
          secureForm: input.secureForm ?? null,
          attachmentsJson: (input.attachmentMetadata ?? []) as Prisma.JsonArray,
        },
      })

      const consumedSessions = await consumeUploadSessions(tx, {
        organizationId: input.organizationId,
        uploaderWorkosUserId: input.requesterWorkosUserId,
        target: "create",
        ticketId: null,
        uploadSessionIds: input.uploadSessionIds ?? [],
      })
      const uploadAttachments = consumedSessions.attachments

      const mergedAttachments = appendUniqueAttachments(
        normalizeAttachmentMetadata(created.attachmentsJson),
        uploadAttachments
      )

      if (uploadAttachments.length > 0) {
        await tx.supportTicketAttachmentUploadSession.updateMany({
          where: {
            id: {
              in: uploadAttachments.map((attachment) => attachment.id),
            },
            consumedAt: consumedSessions.consumedAt,
          },
          data: {
            consumedTicketId: created.id,
          },
        })
      }

      const updatedTicket =
        uploadAttachments.length > 0 ||
        (input.attachmentMetadata ?? []).length > 0
          ? await tx.supportTicket.update({
              where: {
                id: created.id,
              },
              data: {
                attachmentsJson: mergedAttachments as Prisma.JsonArray,
              },
            })
          : created

      return mapTicketRecord(updatedTicket)
    })
  },
  async getTicketById(ticketId) {
    const ticket = await prisma.supportTicket.findUnique({
      where: {
        id: ticketId,
      },
    })

    if (!ticket) {
      return null
    }

    return mapTicketRecord(ticket)
  },
  async listTicketsByOrganization(input) {
    const rows = await prisma.supportTicket.findMany({
      where: {
        organizationId: input.organizationId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: input.limit ?? 50,
    })

    return rows.map(mapTicketRecord)
  },
  async getTicketThread(input) {
    const ticket = await prisma.supportTicket.findUnique({
      where: {
        id: input.ticketId,
      },
      include: {
        replies: {
          where: input.includeInternalNotes
            ? undefined
            : { isInternalNote: false },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    })

    if (!ticket) {
      return null
    }

    return {
      ticket: mapTicketRecord(ticket),
      replies: ticket.replies.map(mapReplyRecord),
    }
  },
  async updateTicketStatus(input) {
    if (input.status === "closed") {
      return prisma.$transaction(async (tx) => {
        const ticket = await tx.supportTicket.update({
          where: {
            id: input.ticketId,
          },
          data: {
            status: DOMAIN_TO_PRISMA_STATUS[input.status],
            resolvedAt: input.resolvedAt,
            closedAt: input.closedAt,
            secureForm: null,
          },
        })

        await tx.supportTicketReply.updateMany({
          where: {
            ticketId: input.ticketId,
          },
          data: {
            secureForm: null,
          },
        })

        return mapTicketRecord(ticket)
      })
    }

    const ticket = await prisma.supportTicket.update({
      where: {
        id: input.ticketId,
      },
      data: {
        status: DOMAIN_TO_PRISMA_STATUS[input.status],
        resolvedAt: input.resolvedAt,
        closedAt: input.closedAt,
      },
    })

    return mapTicketRecord(ticket)
  },
  async listAllTickets(input) {
    const rows = await prisma.supportTicket.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: input.limit ?? 50,
    })

    return rows.map(mapTicketRecord)
  },
  async updateTicket(input) {
    const updateData: Prisma.SupportTicketUpdateInput = {}
    if (input.data.department !== undefined) {
      updateData.department = DOMAIN_TO_PRISMA_DEPARTMENT[input.data.department]
    }
    if (input.data.priority !== undefined) {
      updateData.priority = DOMAIN_TO_PRISMA_PRIORITY[input.data.priority]
    }
    if (input.data.service !== undefined) {
      updateData.service = input.data.service
        ? DOMAIN_TO_PRISMA_SERVICE[input.data.service]
        : null
    }
    if (input.data.subject !== undefined) {
      updateData.subject = input.data.subject
    }
    if (input.data.description !== undefined) {
      updateData.description = input.data.description
    }
    if (input.data.status !== undefined) {
      updateData.status = DOMAIN_TO_PRISMA_STATUS[input.data.status]
    }
    if (input.data.assignedAgentWorkosUserId !== undefined) {
      updateData.assignedAgentWorkosUserId =
        input.data.assignedAgentWorkosUserId
    }

    if (input.clearSecureForm) {
      updateData.secureForm = null
    }

    if (input.clearSecureForm) {
      return prisma.$transaction(async (tx) => {
        const ticket = await tx.supportTicket.update({
          where: {
            id: input.ticketId,
          },
          data: updateData,
        })

        await tx.supportTicketReply.updateMany({
          where: {
            ticketId: input.ticketId,
          },
          data: {
            secureForm: null,
          },
        })

        return mapTicketRecord(ticket)
      })
    }

    const ticket = await prisma.supportTicket.update({
      where: {
        id: input.ticketId,
      },
      data: updateData,
    })

    return mapTicketRecord(ticket)
  },
  async deleteTicket(ticketId) {
    await prisma.supportTicket.delete({
      where: {
        id: ticketId,
      },
    })
    return true
  },
  async createReply(input) {
    return prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.findUnique({
        where: {
          id: input.ticketId,
        },
        select: {
          organizationId: true,
        },
      })

      if (!ticket) {
        throw new Error(`Support ticket ${input.ticketId} was not found.`)
      }

      const created = await tx.supportTicketReply.create({
        data: {
          ticketId: input.ticketId,
          authorWorkosUserId: input.authorWorkosUserId,
          body: input.body,
          secureForm: input.secureForm ?? null,
          isInternalNote: input.isInternalNote ?? false,
          attachmentsJson: (input.attachmentMetadata ?? []) as Prisma.JsonArray,
        },
      })

      const consumedSessions = await consumeUploadSessions(tx, {
        organizationId: ticket.organizationId,
        uploaderWorkosUserId: input.authorWorkosUserId,
        target: "reply",
        ticketId: input.ticketId,
        uploadSessionIds: input.uploadSessionIds ?? [],
      })
      const uploadAttachments = consumedSessions.attachments

      const mergedAttachments = appendUniqueAttachments(
        normalizeAttachmentMetadata(created.attachmentsJson),
        uploadAttachments
      )

      if (uploadAttachments.length > 0) {
        await tx.supportTicketAttachmentUploadSession.updateMany({
          where: {
            id: {
              in: uploadAttachments.map((attachment) => attachment.id),
            },
            consumedAt: consumedSessions.consumedAt,
          },
          data: {
            consumedReplyId: created.id,
          },
        })
      }

      const updatedReply =
        uploadAttachments.length > 0 ||
        (input.attachmentMetadata ?? []).length > 0
          ? await tx.supportTicketReply.update({
              where: {
                id: created.id,
              },
              data: {
                attachmentsJson: mergedAttachments as Prisma.JsonArray,
              },
            })
          : created

      return mapReplyRecord(updatedReply)
    })
  },
}
