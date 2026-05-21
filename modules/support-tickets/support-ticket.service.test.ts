import { describe, expect, it } from "bun:test"

import { SupportTicketStatusTransitionError } from "@/modules/support-tickets/support-ticket.policy"
import {
  createSupportTicketService,
  SupportTicketAccessDeniedError,
} from "@/modules/support-tickets/support-ticket.service"
import type { SupportTicketRepository } from "@/modules/support-tickets/support-ticket.repository"
import type {
  SupportTicket,
  SupportTicketThread,
} from "@/modules/support-tickets/support-ticket.types"

const baseTicket: SupportTicket = {
  id: "ticket_1",
  ticketNumber: "TCK-0001",
  organizationId: "org_1",
  requesterWorkosUserId: "user_requester",
  assignedAgentWorkosUserId: "user_agent",
  department: "technical",
  status: "open",
  subject: "Cannot deploy",
  description: "Deployment fails during build.",
  attachmentMetadata: [],
  createdAt: new Date("2026-05-01T00:00:00.000Z"),
  updatedAt: new Date("2026-05-01T00:00:00.000Z"),
  resolvedAt: null,
  closedAt: null,
}

const createRepositoryStub = () => {
  const tickets = new Map<string, SupportTicket>([[baseTicket.id, baseTicket]])
  const replies: SupportTicketThread["replies"] = []

  const repository: SupportTicketRepository = {
    async createTicket(input) {
      const ticket: SupportTicket = {
        id: `ticket_${tickets.size + 1}`,
        ticketNumber: input.ticketNumber,
        organizationId: input.organizationId,
        requesterWorkosUserId: input.requesterWorkosUserId,
        assignedAgentWorkosUserId: null,
        department: input.department,
        status: "open",
        subject: input.subject,
        description: input.description ?? null,
        attachmentMetadata: input.attachmentMetadata ?? [],
        createdAt: new Date("2026-05-02T00:00:00.000Z"),
        updatedAt: new Date("2026-05-02T00:00:00.000Z"),
        resolvedAt: null,
        closedAt: null,
      }

      tickets.set(ticket.id, ticket)
      return ticket
    },
    async listTicketsByOrganization(input) {
      return [...tickets.values()].filter((ticket) => {
        return ticket.organizationId === input.organizationId
      })
    },
    async getTicketById(ticketId) {
      return tickets.get(ticketId) ?? null
    },
    async getTicketThread(ticketId) {
      const ticket = tickets.get(ticketId)
      if (!ticket) {
        return null
      }

      return {
        ticket,
        replies: replies.filter((reply) => reply.ticketId === ticketId),
      }
    },
    async updateTicketStatus(input) {
      const current = tickets.get(input.ticketId)
      if (!current) {
        throw new Error("missing ticket")
      }

      const updatedTicket: SupportTicket = {
        ...current,
        status: input.status,
        resolvedAt: input.resolvedAt,
        closedAt: input.closedAt,
      }

      tickets.set(input.ticketId, updatedTicket)
      return updatedTicket
    },
    async createReply(input) {
      const reply: SupportTicketThread["replies"][number] = {
        id: `reply_${replies.length + 1}`,
        ticketId: input.ticketId,
        authorWorkosUserId: input.authorWorkosUserId,
        body: input.body,
        isInternalNote: input.isInternalNote ?? false,
        attachmentMetadata: input.attachmentMetadata ?? [],
        createdAt: new Date("2026-05-03T00:00:00.000Z"),
        updatedAt: new Date("2026-05-03T00:00:00.000Z"),
      }

      replies.push(reply)
      return reply
    },
  }

  return {
    repository,
    tickets,
  }
}

describe("supportTicketService", () => {
  it("creates tickets with default open status and generated ticket number", async () => {
    const { repository } = createRepositoryStub()
    const service = createSupportTicketService({
      repository,
      ticketNumberFactory: () => "TCK-NEW-0001",
    })

    const ticket = await service.createTicket({
      organizationId: "org_1",
      requesterWorkosUserId: "user_requester",
      department: "billing",
      subject: "Need invoice correction",
    })

    expect(ticket.status).toBe("open")
    expect(ticket.ticketNumber).toBe("TCK-NEW-0001")
    expect(ticket.department).toBe("billing")
  })

  it("transitions status for assigned agents", async () => {
    const { repository } = createRepositoryStub()
    const service = createSupportTicketService({ repository })

    const updated = await service.transitionStatus({
      ticketId: "ticket_1",
      nextStatus: "in_progress",
      actor: {
        organizationId: "org_1",
        workosUserId: "user_agent",
      },
    })

    expect(updated.status).toBe("in_progress")
    expect(updated.resolvedAt).toBeNull()
    expect(updated.closedAt).toBeNull()
  })

  it("rejects invalid status transitions", async () => {
    const { repository, tickets } = createRepositoryStub()
    tickets.set("ticket_1", {
      ...baseTicket,
      status: "closed",
      closedAt: new Date("2026-05-04T00:00:00.000Z"),
    })

    const service = createSupportTicketService({ repository })

    await expect(
      service.transitionStatus({
        ticketId: "ticket_1",
        nextStatus: "open",
        actor: {
          canManageTickets: true,
          organizationId: "org_1",
          workosUserId: "user_manager",
        },
      })
    ).rejects.toBeInstanceOf(SupportTicketStatusTransitionError)
  })

  it("enforces ownership constraints for status updates", async () => {
    const { repository } = createRepositoryStub()
    const service = createSupportTicketService({ repository })

    await expect(
      service.transitionStatus({
        ticketId: "ticket_1",
        nextStatus: "in_progress",
        actor: {
          organizationId: "org_1",
          workosUserId: "user_requester",
        },
      })
    ).rejects.toBeInstanceOf(SupportTicketAccessDeniedError)
  })

  it("restricts internal replies to support staff", async () => {
    const { repository } = createRepositoryStub()
    const service = createSupportTicketService({ repository })

    await expect(
      service.addReply({
        actor: {
          organizationId: "org_1",
          workosUserId: "user_requester",
        },
        reply: {
          ticketId: "ticket_1",
          authorWorkosUserId: "user_requester",
          body: "private escalation details",
          isInternalNote: true,
        },
      })
    ).rejects.toBeInstanceOf(SupportTicketAccessDeniedError)
  })
})
