import { describe, expect, it } from "bun:test"

import { SupportTicketStatusTransitionError } from "@/modules/support-tickets/support-ticket.policy"
import {
  createSupportTicketContentCipher,
  type SupportTicketContentCipher,
} from "@/modules/support-tickets/support-ticket-content-cipher"
import {
  createSupportTicketService,
  SupportTicketAccessDeniedError,
  SupportTicketNotFoundError,
  SupportTicketContentUnavailableError,
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
  priority: "medium",
  service: "deploy",
  status: "open",
  subject: "Cannot deploy",
  description: "Deployment fails during build.",
  secureForm: null,
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
    async createUploadSession() {
      throw new Error("not implemented")
    },
    async getUploadSessionById() {
      return null
    },
    async markUploadSessionRegistered() {
      throw new Error("not implemented")
    },
    async createTicket(input) {
      const ticket: SupportTicket = {
        id: `ticket_${tickets.size + 1}`,
        ticketNumber: input.ticketNumber,
        organizationId: input.organizationId,
        requesterWorkosUserId: input.requesterWorkosUserId,
        assignedAgentWorkosUserId: null,
        department: input.department,
        priority: input.priority,
        service: input.service ?? null,
        status: "open",
        subject: input.subject,
        description: input.description ?? null,
        secureForm: input.secureForm ?? null,
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
        secureForm: input.secureForm ?? null,
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
  it("creates tickets with default open status, priority, and service", async () => {
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
      priority: "high",
      service: "billing",
      subject: "Need invoice correction",
      secureForm: "Card details",
    })

    expect(ticket.status).toBe("open")
    expect(ticket.ticketNumber).toBe("TCK-NEW-0001")
    expect(ticket.department).toBe("billing")
    expect(ticket.priority).toBe("high")
    expect(ticket.service).toBe("billing")
  })

  it("allows requester to close ticket", async () => {
    const { repository } = createRepositoryStub()
    const service = createSupportTicketService({
      contentCipher: identityCipher,
      repository,
    })

    const updated = await service.transitionStatus({
      ticketId: "ticket_1",
      nextStatus: "closed",
      actor: {
        organizationId: "org_1",
        workosUserId: "user_requester",
      },
    })

    expect(updated.status).toBe("closed")
    expect(updated.closedAt).not.toBeNull()
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

  it("encrypts secure form and keeps legacy encrypted content readable", async () => {
    const contentCipher = createSupportTicketContentCipher({
      key: "base64:bjY4kQV6Dj6MimVz5Zt2JYhjpQf8j2uZMQvNclTBIw4=",
    })
    const encryptedBaseTicket: SupportTicket = {
      ...baseTicket,
      subject: contentCipher.encrypt(baseTicket.subject),
      description: contentCipher.encrypt(baseTicket.description ?? ""),
      secureForm: contentCipher.encrypt("Legacy secure ticket"),
    }
    const tickets = new Map<string, SupportTicket>([
      [encryptedBaseTicket.id, encryptedBaseTicket],
    ])
    const replies: SupportTicketThread["replies"] = []
    let storedSecureTicket = ""
    let storedReplySecureForm = ""

    const repository: SupportTicketRepository = {
      async createUploadSession() {
        throw new Error("not implemented")
      },
      async getUploadSessionById() {
        return null
      },
      async markUploadSessionRegistered() {
        throw new Error("not implemented")
      },
      async createTicket(input) {
        storedSecureTicket = input.secureForm ?? ""
        const ticket: SupportTicket = {
          id: "ticket_2",
          ticketNumber: input.ticketNumber,
          organizationId: input.organizationId,
          requesterWorkosUserId: input.requesterWorkosUserId,
          assignedAgentWorkosUserId: null,
          department: input.department,
          priority: input.priority,
          service: input.service ?? null,
          status: "open",
          subject: input.subject,
          description: input.description ?? null,
          secureForm: input.secureForm ?? null,
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
        storedReplySecureForm = input.secureForm ?? ""
        const reply: SupportTicketThread["replies"][number] = {
          id: `reply_${replies.length + 1}`,
          ticketId: input.ticketId,
          authorWorkosUserId: input.authorWorkosUserId,
          body: input.body,
          secureForm: input.secureForm ?? null,
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
      priority: "medium",
      service: "deploy",
      subject: "Cannot deploy",
      description: "Deployment fails during build.",
      secureForm: "Sensitive API key",
    })

    expect(storedSecureTicket).not.toBe("Sensitive API key")
    expect(storedSecureTicket.startsWith("stenc.v1.")).toBe(true)
    expect(createdTicket.secureForm).toBe("Sensitive API key")

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
        secureForm: "Internal VPN endpoint",
        isInternalNote: false,
      },
    })

    expect(storedReplySecureForm).not.toBe("Internal VPN endpoint")
    expect(storedReplySecureForm.startsWith("stenc.v1.")).toBe(true)
    expect(createdReply.body).toBe("Please attach a build log.")
    expect(createdReply.secureForm).toBe("Internal VPN endpoint")

    const thread = await service.getTicketThread({
      actor: {
        organizationId: "org_1",
        workosUserId: "user_requester",
      },
      ticketId: "ticket_1",
    })

    expect(thread.ticket.subject).toBe("Cannot deploy")
    expect(thread.ticket.description).toBe("Deployment fails during build.")
    expect(thread.ticket.secureForm).toBe("Legacy secure ticket")
  })

  it("throws NotFoundError when ticket does not exist", async () => {
    const { repository } = createRepositoryStub()
    const service = createSupportTicketService({
      contentCipher: identityCipher,
      repository,
    })

    await expect(
      service.getTicketThread({
        ticketId: "nonexistent",
        actor: {
          organizationId: "org_1",
          workosUserId: "user_requester",
        },
      })
    ).rejects.toBeInstanceOf(SupportTicketNotFoundError)
  })

  it("throws ContentUnavailableError when content cannot be decrypted", async () => {
    const { SupportTicketCiphertextFormatError } = await import(
      "@/modules/support-tickets/support-ticket-content-cipher"
    )
    const brokenCipher: SupportTicketContentCipher = {
      encrypt(value) {
        return value
      },
      decrypt() {
        throw new SupportTicketCiphertextFormatError()
      },
    }

    const encryptedTicket: SupportTicket = {
      ...baseTicket,
      subject: "stenc.v1.encrypted",
      description: "stenc.v1.encrypted",
    }
    const tickets = new Map<string, SupportTicket>([
      [encryptedTicket.id, encryptedTicket],
    ])
    const replies: SupportTicketThread["replies"] = []

    const repository: SupportTicketRepository = {
      async createUploadSession() {
        throw new Error("not implemented")
      },
      async getUploadSessionById() {
        return null
      },
      async markUploadSessionRegistered() {
        throw new Error("not implemented")
      },
      async createTicket() {
        throw new Error("not implemented")
      },
      async listTicketsByOrganization() {
        return [...tickets.values()]
      },
      async getTicketById(ticketId) {
        return tickets.get(ticketId) ?? null
      },
      async getTicketThread(ticketId) {
        const ticket = tickets.get(ticketId)
        if (!ticket) {
          return null
        }
        return { ticket, replies }
      },
      async updateTicketStatus() {
        throw new Error("not implemented")
      },
      async createReply() {
        throw new Error("not implemented")
      },
    }

    const service = createSupportTicketService({
      contentCipher: brokenCipher,
      repository,
    })

    await expect(
      service.getTicketThread({
        ticketId: "ticket_1",
        actor: {
          organizationId: "org_1",
          workosUserId: "user_requester",
        },
      })
    ).rejects.toBeInstanceOf(SupportTicketContentUnavailableError)
  })

  it("generates ticket numbers in correct format", async () => {
    const { repository } = createRepositoryStub()
    const factory = () => "TCK-12345678-ABCDEF"

    const service = createSupportTicketService({
      contentCipher: identityCipher,
      repository,
      ticketNumberFactory: factory,
    })

    const ticket = await service.createTicket({
      organizationId: "org_1",
      requesterWorkosUserId: "user_requester",
      department: "technical",
      priority: "medium",
      subject: "Test ticket",
    })

    expect(ticket.ticketNumber).toBe("TCK-12345678-ABCDEF")
  })
})
