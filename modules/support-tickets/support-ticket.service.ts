import {
  createSupportTicketInputSchema,
  createSupportTicketReplyInputSchema,
  supportTicketActorContextSchema,
  supportTicketStatusSchema,
} from "@/modules/support-tickets/support-ticket.schema"
import {
  createSupportTicketContentCipher,
  SupportTicketCiphertextFormatError,
  type SupportTicketContentCipher,
  SupportTicketDecryptionError,
  SupportTicketEncryptionConfigurationError,
} from "@/modules/support-tickets/support-ticket-content-cipher"
import {
  assertSupportTicketStatusTransition,
  canCreateSupportTicketInternalReply,
  canCreateSupportTicketReply,
  canReadSupportTicket,
  canUpdateSupportTicketStatus,
} from "@/modules/support-tickets/support-ticket.policy"
import type { SupportTicketRepository } from "@/modules/support-tickets/support-ticket.repository"
import type {
  CreateSupportTicketInput,
  CreateSupportTicketReplyInput,
  SupportTicket,
  SupportTicketActorContext,
  SupportTicketStatus,
  SupportTicketThread,
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
    async getTicketThread(ticketId) {
      const repository = await loadRepository()
      return repository.getTicketThread(ticketId)
    },
    async updateTicketStatus(input) {
      const repository = await loadRepository()
      return repository.updateTicketStatus(input)
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

const encryptTicketContent = (
  cipher: SupportTicketContentCipher,
  input: CreateSupportTicketInput
): CreateSupportTicketInput => {
  return {
    ...input,
    subject: cipher.encrypt(input.subject),
    description: input.description ? cipher.encrypt(input.description) : null,
  }
}

const decryptTicketContent = (
  cipher: SupportTicketContentCipher,
  ticket: SupportTicket
): SupportTicket => {
  return {
    ...ticket,
    subject: cipher.decrypt(ticket.subject),
    description: ticket.description ? cipher.decrypt(ticket.description) : null,
  }
}

const encryptReplyContent = (
  cipher: SupportTicketContentCipher,
  input: CreateSupportTicketReplyInput
): CreateSupportTicketReplyInput => {
  return {
    ...input,
    body: cipher.encrypt(input.body),
  }
}

const decryptReplyContent = (
  cipher: SupportTicketContentCipher,
  reply: SupportTicketThread["replies"][number]
): SupportTicketThread["replies"][number] => {
  return {
    ...reply,
    body: cipher.decrypt(reply.body),
  }
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
        return tickets.map((ticket) => decryptTicketContent(contentCipher, ticket))
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

      const ticketThread = await repository.getTicketThread(input.ticketId)
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

      if (!canUpdateSupportTicketStatus(actor, ticket)) {
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
        return decryptReplyContent(contentCipher, storedReply)
      } catch (error) {
        throw toSafeContentError(error)
      }
    },
  }
}

export const supportTicketService = createSupportTicketService()
