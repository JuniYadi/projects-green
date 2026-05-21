import {
  createSupportTicketInputSchema,
  createSupportTicketReplyInputSchema,
  supportTicketActorContextSchema,
  supportTicketStatusSchema,
} from "@/modules/support-tickets/support-ticket.schema"
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

export const createSupportTicketService = (
  options: CreateSupportTicketServiceOptions = {}
): SupportTicketService => {
  const repository = options.repository ?? createLazyDefaultRepository()
  const ticketNumberFactory =
    options.ticketNumberFactory ?? defaultTicketNumberFactory

  return {
    async createTicket(input) {
      const parsedInput = createSupportTicketInputSchema.parse(input)

      return repository.createTicket({
        ...parsedInput,
        ticketNumber: ticketNumberFactory(),
      })
    },
    async listTickets(input) {
      const actor = supportTicketActorContextSchema.parse(input.actor)

      return repository.listTicketsByOrganization({
        organizationId: actor.organizationId,
        limit: input.limit,
      })
    },
    async getTicketThread(input) {
      const actor = supportTicketActorContextSchema.parse(input.actor)
      const ticket = await repository.getTicketThread(input.ticketId)

      if (!ticket) {
        throw new SupportTicketNotFoundError(input.ticketId)
      }

      if (!canReadSupportTicket(actor, ticket.ticket)) {
        throw new SupportTicketAccessDeniedError("read")
      }

      return ticket
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

      return repository.updateTicketStatus({
        ticketId: input.ticketId,
        status: nextStatus,
        resolvedAt: timestamps.resolvedAt,
        closedAt: timestamps.closedAt,
      })
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

      return repository.createReply(reply)
    },
  }
}

export const supportTicketService = createSupportTicketService()
