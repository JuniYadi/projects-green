import { describe, expect, it } from "bun:test"

import { SupportTicketStatusTransitionError } from "@/modules/support-tickets/support-ticket.policy"
import {
  createSupportTicketContentCipher,
  type SupportTicketContentCipher,
} from "@/modules/support-tickets/support-ticket-content-cipher"
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

const identityCipher: SupportTicketContentCipher = {
  encrypt(value) {
    return value
  },
  decrypt(value) {
    return value
  },
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
      contentCipher: identityCipher,
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
    const service = createSupportTicketService({
      contentCipher: identityCipher,
      repository,
    })

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

    const service = createSupportTicketService({
      contentCipher: identityCipher,
      repository,
    })

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
    const service = createSupportTicketService({
      contentCipher: identityCipher,
      repository,
    })

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
    const service = createSupportTicketService({
      contentCipher: identityCipher,
      repository,
    })

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

  it("encrypts before persistence and decrypts on authorized read/reply", async () => {
    const contentCipher = createSupportTicketContentCipher({
      key: "base64:bjY4kQV6Dj6MimVz5Zt2JYhjpQf8j2uZMQvNclTBIw4=",
    })
    const encryptedBaseTicket: SupportTicket = {
      ...baseTicket,
      subject: contentCipher.encrypt(baseTicket.subject),
      description: contentCipher.encrypt(baseTicket.description ?? ""),
    }
    const tickets = new Map<string, SupportTicket>([
      [encryptedBaseTicket.id, encryptedBaseTicket],
    ])
    const replies: SupportTicketThread["replies"] = []
    let storedTicketSubject = ""
    let storedTicketDescription = ""
    let storedReplyBody = ""

    const repository: SupportTicketRepository = {
      async createTicket(input) {
        storedTicketSubject = input.subject
        storedTicketDescription = input.description ?? ""
        const ticket: SupportTicket = {
          id: "ticket_2",
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
        storedReplyBody = input.body
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

    const service = createSupportTicketService({
      contentCipher,
      repository,
      ticketNumberFactory: () => "TCK-NEW-0001",
    })

    const createdTicket = await service.createTicket({
      organizationId: "org_1",
      requesterWorkosUserId: "user_requester",
      department: "technical",
      subject: "Cannot deploy",
      description: "Deployment fails during build.",
    })

    expect(storedTicketSubject).not.toBe("Cannot deploy")
    expect(storedTicketDescription).not.toBe("Deployment fails during build.")
    expect(storedTicketSubject.startsWith("stenc.v1.")).toBe(true)
    expect(createdTicket.subject).toBe("Cannot deploy")
    expect(createdTicket.description).toBe("Deployment fails during build.")

    const createdReply = await service.addReply({
      actor: {
        canManageTickets: true,
        organizationId: "org_1",
        workosUserId: "user_agent",
      },
      reply: {
        ticketId: "ticket_1",
        authorWorkosUserId: "user_agent",
        body: "Please attach a build log.",
        isInternalNote: false,
      },
    })

    expect(storedReplyBody).not.toBe("Please attach a build log.")
    expect(storedReplyBody.startsWith("stenc.v1.")).toBe(true)
    expect(createdReply.body).toBe("Please attach a build log.")

    const thread = await service.getTicketThread({
      actor: {
        organizationId: "org_1",
        workosUserId: "user_requester",
      },
      ticketId: "ticket_1",
    })

    expect(thread.ticket.subject).toBe("Cannot deploy")
    expect(thread.ticket.description).toBe("Deployment fails during build.")
    expect(thread.replies[0]?.body).toBe("Please attach a build log.")
  })

  it("checks authorization before decrypting thread content", async () => {
    let decryptCalls = 0
    const spyCipher: SupportTicketContentCipher = {
      encrypt(value) {
        return value
      },
      decrypt(value) {
        decryptCalls += 1
        return value
      },
    }
    const { repository } = createRepositoryStub()
    const service = createSupportTicketService({
      contentCipher: spyCipher,
      repository,
    })

    await expect(
      service.getTicketThread({
        actor: {
          organizationId: "org_1",
          workosUserId: "user_unauthorized",
        },
        ticketId: "ticket_1",
      })
    ).rejects.toBeInstanceOf(SupportTicketAccessDeniedError)
    expect(decryptCalls).toBe(0)
  })
})
