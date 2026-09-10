import { describe, expect, it } from "bun:test"

import type {
  SupportTicket,
  SupportTicketReply,
  SupportTicketThread,
  SupportTicketListResult,
} from "./support-ticket.types"
import {
  toSupportTicketDTO,
  toSupportTicketReplyDTO,
  toSupportTicketThreadDTO,
  toSupportTicketListDTO,
} from "./support-ticket.dto"

describe("SupportTicket DTO mappers", () => {
  const mockTicket: SupportTicket = {
    id: "ticket_1",
    ticketNumber: "TICK-0001",
    organizationId: "org_1",
    organizationName: "Acme Corp",
    organizationMetadata: { tier: "enterprise" },
    requesterWorkosUserId: "user_1",
    requesterName: "Alice",
    assignedAgentWorkosUserId: "agent_1",
    department: "technical",
    service: "deploy",
    priority: "high",
    status: "open",
    subject: "Deployment issue",
    description: "Build failed",
    descriptionHtml: "<p>Build failed</p>",
    secureForm: null,
    attachmentMetadata: [],
    createdAt: new Date("2026-09-10T00:00:00.000Z"),
    updatedAt: new Date("2026-09-10T01:00:00.000Z"),
    resolvedAt: null,
    closedAt: null,
  }

  const mockReply: SupportTicketReply = {
    id: "reply_1",
    ticketId: "ticket_1",
    authorWorkosUserId: "user_1",
    body: "Here is more context",
    bodyHtml: "<p>Here is more context</p>",
    secureForm: null,
    isInternalNote: false,
    attachmentMetadata: [],
    createdAt: new Date("2026-09-10T02:00:00.000Z"),
    updatedAt: new Date("2026-09-10T02:00:00.000Z"),
  }

  describe("toSupportTicketDTO", () => {
    it("maps dates to ISO strings and preserves fields", () => {
      const dto = toSupportTicketDTO(mockTicket)
      expect(dto.id).toBe("ticket_1")
      expect(dto.ticketNumber).toBe("TICK-0001")
      expect(dto.createdAt).toBe("2026-09-10T00:00:00.000Z")
      expect(dto.updatedAt).toBe("2026-09-10T01:00:00.000Z")
      expect(dto.resolvedAt).toBeNull()
      expect(dto.closedAt).toBeNull()
      expect(dto.organizationName).toBe("Acme Corp")
    })

    it("handles string dates or null optional fields", () => {
      const dto = toSupportTicketDTO({
        ...mockTicket,
        resolvedAt: new Date("2026-09-10T03:00:00.000Z"),
        closedAt: new Date("2026-09-10T04:00:00.000Z"),
        organizationName: undefined,
        requesterName: undefined,
      })
      expect(dto.resolvedAt).toBe("2026-09-10T03:00:00.000Z")
      expect(dto.closedAt).toBe("2026-09-10T04:00:00.000Z")
      expect(dto.organizationName).toBeNull()
      expect(dto.requesterName).toBeNull()
    })
  })

  describe("toSupportTicketReplyDTO", () => {
    it("maps reply dates to ISO strings", () => {
      const dto = toSupportTicketReplyDTO(mockReply)
      expect(dto.id).toBe("reply_1")
      expect(dto.createdAt).toBe("2026-09-10T02:00:00.000Z")
      expect(dto.body).toBe("Here is more context")
      expect(dto.bodyHtml).toBe("<p>Here is more context</p>")
    })
  })

  describe("toSupportTicketThreadDTO", () => {
    it("maps entire thread including ticket and replies", () => {
      const thread: SupportTicketThread = {
        ticket: mockTicket,
        replies: [mockReply],
        users: {
          user_1: {
            name: "Alice",
            avatarUrl: null,
            isStaff: false,
          },
        },
      }
      const dto = toSupportTicketThreadDTO(thread)
      expect(dto.ticket.id).toBe("ticket_1")
      expect(dto.replies).toHaveLength(1)
      expect(dto.replies[0]?.id).toBe("reply_1")
      expect(dto.users?.user_1?.name).toBe("Alice")
    })
  })

  describe("toSupportTicketListDTO", () => {
    it("maps list result to list DTO", () => {
      const listResult: SupportTicketListResult = {
        tickets: [mockTicket],
        total: 1,
        page: 1,
        pageSize: 10,
      }
      const dto = toSupportTicketListDTO(listResult)
      expect(dto.tickets).toHaveLength(1)
      expect(dto.tickets[0]?.id).toBe("ticket_1")
      expect(dto.total).toBe(1)
      expect(dto.page).toBe(1)
      expect(dto.pageSize).toBe(10)
    })
  })
})
