import {
  createSupportTicketInputSchema,
  createSupportTicketReplyInputSchema,
  supportTicketActorContextSchema,
  supportTicketStatusSchema,
} from "@/modules/support-tickets/support-ticket.schema"
import {
  createSupportTicketContentCipher,
  isSupportTicketEncryptedPayload,
  SupportTicketCiphertextFormatError,
  type SupportTicketContentCipher,
  SupportTicketDecryptionError,
  SupportTicketEncryptionConfigurationError,
} from "@/modules/support-tickets/support-ticket-content-cipher"
import {
  assertSupportTicketStatusTransition,
  canCloseSupportTicket,
  canCreateSupportTicketInternalReply,
  canCreateSupportTicketReply,
  canReadSupportTicket,
  canUpdateSupportTicketStatus,
  isAssignedAgent,
  isSupportTicketStatusTransitionAllowed,
} from "@/modules/support-tickets/support-ticket.policy"
import type { SupportTicketRepository } from "@/modules/support-tickets/support-ticket.repository"
import type {
  CreateSupportTicketInput,
  CreateSupportTicketReplyInput,
  SupportTicket,
  SupportTicketActorContext,
  SupportTicketAttachmentUploadSession,
  SupportTicketStatus,
  SupportTicketThread,
  SupportTicketDepartment,
  SupportTicketPriority,
  SupportTicketService as SupportTicketServiceType,
} from "@/modules/support-tickets/support-ticket.types"

export class SupportTicketNotFoundError extends Error {
  constructor(ticketId: string) {
    super(`Support ticket ${ticketId} was not found.`)
    this.name = "SupportTicketNotFoundError"
  }
}

export class SupportTicketAccessDeniedError extends Error {
  constructor(action: string) {
    super(`You do not have permission to ${action} this support ticket.`)
    this.name = "SupportTicketAccessDeniedError"
  }
}

export class SupportTicketContentUnavailableError extends Error {
  constructor() {
    super("Support ticket content is unavailable.")
    this.name = "SupportTicketContentUnavailableError"
  }
}

export type SupportTicketService = {
  addReply(input: {
    actor: SupportTicketActorContext
    reply: CreateSupportTicketReplyInput
  }): Promise<SupportTicketThread["replies"][number]>
  createTicket(input: CreateSupportTicketInput): Promise<SupportTicket>
  getTicketThread(input: {
    actor: SupportTicketActorContext
    ticketId: string
  }): Promise<SupportTicketThread>
  listTickets(input: {
    actor: SupportTicketActorContext
    limit?: number
  }): Promise<SupportTicket[]>
  transitionStatus(input: {
    actor: SupportTicketActorContext
    nextStatus: SupportTicketStatus
    ticketId: string
  }): Promise<SupportTicket>
  getAttachmentSession?(input: {
    actor: SupportTicketActorContext
    attachmentId: string
  }): Promise<SupportTicketAttachmentUploadSession | null>
  listAllTickets(input: {
    actor: SupportTicketActorContext
    limit?: number
  }): Promise<SupportTicket[]>
  updateTicket(input: {
    actor: SupportTicketActorContext
    ticketId: string
    data: {
      department?: SupportTicketDepartment
      priority?: SupportTicketPriority
      service?: SupportTicketServiceType | null
      subject?: string
      description?: string | null
      status?: SupportTicketStatus
      assignedAgentWorkosUserId?: string | null
    }
  }): Promise<SupportTicket>
  deleteTicket(input: {
    actor: SupportTicketActorContext
    ticketId: string
  }): Promise<boolean>
}

const defaultTicketNumberFactory = () => {
  const timestamp = Date.now().toString().slice(-8)
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase()

  return `TCK-${timestamp}-${suffix}`
}

type CreateSupportTicketServiceOptions = {
  contentCipher?: SupportTicketContentCipher
  repository?: SupportTicketRepository
  ticketNumberFactory?: () => string
}

const createLazyDefaultRepository = (): SupportTicketRepository => {
  const loadRepository = async () => {
    const repositoryModule =
      await import("@/modules/support-tickets/support-ticket.repository")

    return repositoryModule.supportTicketRepository
  }

  return {
    async createUploadSession(input) {
      const repository = await loadRepository()
      return repository.createUploadSession(input)
    },
    async getUploadSessionById(id) {
      const repository = await loadRepository()
      return repository.getUploadSessionById(id)
    },
    async markUploadSessionRegistered(input) {
      const repository = await loadRepository()
      return repository.markUploadSessionRegistered(input)
    },
    async deleteUploadSession(id) {
      const repository = await loadRepository()
      return repository.deleteUploadSession(id)
    },
    async createTicket(input) {
      const repository = await loadRepository()
      return repository.createTicket(input)
    },
    async listTicketsByOrganization(input) {
      const repository = await loadRepository()
      return repository.listTicketsByOrganization(input)
    },
    async getTicketById(ticketId) {
      const repository = await loadRepository()
      return repository.getTicketById(ticketId)
    },
    async getTicketThread(input) {
      const repository = await loadRepository()
      return repository.getTicketThread(input)
    },
    async updateTicketStatus(input) {
      const repository = await loadRepository()
      return repository.updateTicketStatus(input)
    },
    async listAllTickets(input) {
      const repository = await loadRepository()
      return repository.listAllTickets(input)
    },
    async updateTicket(input) {
      const repository = await loadRepository()
      return repository.updateTicket(input)
    },
    async deleteTicket(ticketId) {
      const repository = await loadRepository()
      return repository.deleteTicket(ticketId)
    },
    async createReply(input) {
      const repository = await loadRepository()
      return repository.createReply(input)
    },
  }
}

const toTransitionTimestamps = (
  current: SupportTicket,
  nextStatus: SupportTicketStatus,
  now: Date
) => {
  if (nextStatus === "closed") {
    return {
      resolvedAt: current.resolvedAt ?? now,
      closedAt: now,
    }
  }

  if (nextStatus === "resolved") {
    return {
      resolvedAt: now,
      closedAt: null,
    }
  }

  return {
    resolvedAt: null,
    closedAt: null,
  }
}

const createLazyDefaultContentCipher = (): SupportTicketContentCipher => {
  let cipher: SupportTicketContentCipher | null = null

  return {
    encrypt(value) {
      cipher ??= createSupportTicketContentCipher()
      return cipher.encrypt(value)
    },
    decrypt(value) {
      cipher ??= createSupportTicketContentCipher()
      return cipher.decrypt(value)
    },
  }
}

const toSafeContentError = (error: unknown) => {
  if (
    error instanceof SupportTicketEncryptionConfigurationError ||
    error instanceof SupportTicketCiphertextFormatError ||
    error instanceof SupportTicketDecryptionError
  ) {
    return new SupportTicketContentUnavailableError()
  }

  return error
}

const maybeDecryptLegacyValue = (
  cipher: SupportTicketContentCipher,
  value: string | null
) => {
  if (!value || !isSupportTicketEncryptedPayload(value)) {
    return value
  }

  return cipher.decrypt(value)
}

const encryptTicketContent = (
  cipher: SupportTicketContentCipher,
  input: CreateSupportTicketInput
): CreateSupportTicketInput => {
  return {
    ...input,
    secureForm: input.secureForm ? cipher.encrypt(input.secureForm) : null,
  }
}

const decryptTicketContent = (
  cipher: SupportTicketContentCipher,
  ticket: SupportTicket
): SupportTicket => {
  return {
    ...ticket,
    subject: maybeDecryptLegacyValue(cipher, ticket.subject) ?? "",
    description: maybeDecryptLegacyValue(cipher, ticket.description),
    secureForm: maybeDecryptLegacyValue(cipher, ticket.secureForm),
  }
}

const encryptReplyContent = (
  cipher: SupportTicketContentCipher,
  input: CreateSupportTicketReplyInput
): CreateSupportTicketReplyInput => {
  return {
    ...input,
    secureForm: input.secureForm ? cipher.encrypt(input.secureForm) : null,
  }
}

const decryptReplyContent = (
  cipher: SupportTicketContentCipher,
  reply: SupportTicketThread["replies"][number]
): SupportTicketThread["replies"][number] => {
  return {
    ...reply,
    body: maybeDecryptLegacyValue(cipher, reply.body) ?? "",
    secureForm: maybeDecryptLegacyValue(cipher, reply.secureForm),
  }
}

/**
 * Determines the next status based on current status and replier role.
 * - Admin/agent replies to `open` → `in_progress`
 * - User replies while `in_progress` → `waiting_response`
 * - User replies while `waiting_response` → stays (no flip-flop)
 * - Admin/agent replies to `waiting_response` → `in_progress`
 */
const autoTransitionStatus = (
  currentStatus: SupportTicketStatus,
  isStaff: boolean
): SupportTicketStatus | null => {
  if (isStaff) {
    if (currentStatus === "open") return "in_progress"
    if (currentStatus === "waiting_response") return "in_progress"
  } else {
    if (currentStatus === "in_progress") return "waiting_response"
  }

  return null
}

export const createSupportTicketService = (
  options: CreateSupportTicketServiceOptions = {}
): SupportTicketService => {
  const repository = options.repository ?? createLazyDefaultRepository()
  const contentCipher =
    options.contentCipher ?? createLazyDefaultContentCipher()
  const ticketNumberFactory =
    options.ticketNumberFactory ?? defaultTicketNumberFactory

  return {
    async createTicket(input) {
      const parsedInput = createSupportTicketInputSchema.parse(input)
      const ticketNumber = ticketNumberFactory()

      try {
        const encryptedInput = encryptTicketContent(contentCipher, parsedInput)
        const storedTicket = await repository.createTicket({
          ...encryptedInput,
          ticketNumber,
        })

        return decryptTicketContent(contentCipher, storedTicket)
      } catch (error) {
        throw toSafeContentError(error)
      }
    },
    async listTickets(input) {
      const actor = supportTicketActorContextSchema.parse(input.actor)
      const tickets = await repository.listTicketsByOrganization({
        organizationId: actor.organizationId,
        limit: input.limit,
      })

      try {
        return tickets.map((ticket) =>
          decryptTicketContent(contentCipher, ticket)
        )
      } catch (error) {
        throw toSafeContentError(error)
      }
    },
    async getTicketThread(input) {
      const actor = supportTicketActorContextSchema.parse(input.actor)
      const ticketOwnership = await repository.getTicketById(input.ticketId)

      if (!ticketOwnership) {
        throw new SupportTicketNotFoundError(input.ticketId)
      }

      if (!canReadSupportTicket(actor, ticketOwnership)) {
        throw new SupportTicketAccessDeniedError("read")
      }

      const includeInternalNotes = actor.isSuperAdmin

      const ticketThread = await repository.getTicketThread({
        ticketId: input.ticketId,
        includeInternalNotes,
      })
      if (!ticketThread) {
        throw new SupportTicketNotFoundError(input.ticketId)
      }

      try {
        return {
          ticket: decryptTicketContent(contentCipher, ticketThread.ticket),
          replies: ticketThread.replies.map((reply) =>
            decryptReplyContent(contentCipher, reply)
          ),
        }
      } catch (error) {
        throw toSafeContentError(error)
      }
    },
    async transitionStatus(input) {
      const actor = supportTicketActorContextSchema.parse(input.actor)
      const nextStatus = supportTicketStatusSchema.parse(input.nextStatus)
      const ticket = await repository.getTicketById(input.ticketId)

      if (!ticket) {
        throw new SupportTicketNotFoundError(input.ticketId)
      }

      const isAllowedToUpdate =
        nextStatus === "closed"
          ? canCloseSupportTicket(actor, ticket)
          : canUpdateSupportTicketStatus(actor, ticket)

      if (!isAllowedToUpdate) {
        throw new SupportTicketAccessDeniedError("update status of")
      }

      assertSupportTicketStatusTransition(ticket.status, nextStatus)

      const now = new Date()
      const timestamps = toTransitionTimestamps(ticket, nextStatus, now)
      const updatedTicket = await repository.updateTicketStatus({
        ticketId: input.ticketId,
        status: nextStatus,
        resolvedAt: timestamps.resolvedAt,
        closedAt: timestamps.closedAt,
      })

      try {
        return decryptTicketContent(contentCipher, updatedTicket)
      } catch (error) {
        throw toSafeContentError(error)
      }
    },
    async addReply(input) {
      const actor = supportTicketActorContextSchema.parse(input.actor)
      const reply = createSupportTicketReplyInputSchema.parse(input.reply)
      const ticket = await repository.getTicketById(reply.ticketId)

      if (!ticket) {
        throw new SupportTicketNotFoundError(reply.ticketId)
      }

      if (reply.isInternalNote) {
        if (!canCreateSupportTicketInternalReply(actor, ticket)) {
          throw new SupportTicketAccessDeniedError("add an internal reply to")
        }
      } else if (!canCreateSupportTicketReply(actor, ticket)) {
        throw new SupportTicketAccessDeniedError("add a reply to")
      }

      try {
        const encryptedReply = encryptReplyContent(contentCipher, reply)
        const storedReply = await repository.createReply(encryptedReply)

        // Auto-transition status based on reply
        if (!reply.isInternalNote) {
          const staffRoles =
            actor.isSuperAdmin ||
            actor.canManageTickets ||
            isAssignedAgent(actor, ticket)
          const nextStatus = autoTransitionStatus(ticket.status, !!staffRoles)
          if (
            nextStatus &&
            isSupportTicketStatusTransitionAllowed(ticket.status, nextStatus)
          ) {
            const now = new Date()
            const timestamps = toTransitionTimestamps(ticket, nextStatus, now)
            await repository.updateTicketStatus({
              ticketId: ticket.id,
              status: nextStatus,
              resolvedAt: timestamps.resolvedAt,
              closedAt: timestamps.closedAt,
            })
          }
        }

        return decryptReplyContent(contentCipher, storedReply)
      } catch (error) {
        throw toSafeContentError(error)
      }
    },
    async getAttachmentSession(input) {
      supportTicketActorContextSchema.parse(input.actor)
      const session = await repository.getUploadSessionById(input.attachmentId)
      return session
    },
    async listAllTickets(input) {
      const actor = supportTicketActorContextSchema.parse(input.actor)
      if (!actor.isSuperAdmin) {
        throw new SupportTicketAccessDeniedError("list all")
      }

      const tickets = await repository.listAllTickets({
        limit: input.limit,
      })

      try {
        return tickets.map((ticket) =>
          decryptTicketContent(contentCipher, ticket)
        )
      } catch (error) {
        throw toSafeContentError(error)
      }
    },
    async updateTicket(input) {
      const actor = supportTicketActorContextSchema.parse(input.actor)
      if (!actor.isSuperAdmin) {
        throw new SupportTicketAccessDeniedError("update")
      }

      const ticket = await repository.getTicketById(input.ticketId)
      if (!ticket) {
        throw new SupportTicketNotFoundError(input.ticketId)
      }

      let clearSecureForm = false
      if (input.data.status === "closed" && ticket.status !== "closed") {
        clearSecureForm = true
      }

      const updatedTicket = await repository.updateTicket({
        ticketId: input.ticketId,
        data: input.data,
        clearSecureForm,
      })

      try {
        return decryptTicketContent(contentCipher, updatedTicket)
      } catch (error) {
        throw toSafeContentError(error)
      }
    },
    async deleteTicket(input) {
      const actor = supportTicketActorContextSchema.parse(input.actor)
      if (!actor.isSuperAdmin) {
        throw new SupportTicketAccessDeniedError("delete")
      }

      const ticket = await repository.getTicketById(input.ticketId)
      if (!ticket) {
        throw new SupportTicketNotFoundError(input.ticketId)
      }

      return repository.deleteTicket(input.ticketId)
    },
  }
}

export const supportTicketService = createSupportTicketService()
