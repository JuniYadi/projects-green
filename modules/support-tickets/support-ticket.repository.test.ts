import { beforeEach, describe, expect, it, mock } from "bun:test"

// Shared mock functions
const mockFindUnique = mock()
const mockFindMany = mock()
const mockCreate = mock()
const mockUpdate = mock()
const mockDelete = mock()
const mockUpdateMany = mock()
const mockReplyCreate = mock()
const mockReplyUpdate = mock()
const mockSessionCreate = mock()
const mockSessionUpdate = mock()
const mockSessionFindMany = mock()

// Sample ticket record returned from Prisma
const basePrismaTicket = {
  id: "ticket_1",
  ticketNumber: "TCK-1001",
  organizationId: "org_1",
  requesterWorkosUserId: "user_r",
  assignedAgentWorkosUserId: "user_a",
  department: "TECHNICAL" as const,
  priority: "MEDIUM" as const,
  service: "DEPLOY" as const,
  status: "OPEN" as const,
  subject: "Test ticket",
  description: "A description",
  secureForm: null,
  attachmentsJson: null,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  resolvedAt: null,
  closedAt: null,
}

// Build a tx mock that delegates to shared mock functions
const createTxMock = () => ({
  supportTicket: {
    findUnique: mockFindUnique,
    create: mockCreate,
    update: mockUpdate,
    findMany: mockFindMany,
    updateMany: mockUpdateMany,
  },
  supportTicketReply: {
    create: mockReplyCreate,
    update: mockReplyUpdate,
    updateMany: mockUpdateMany,
  },
  supportTicketAttachmentUploadSession: {
    findMany: mockSessionFindMany,
    create: mockSessionCreate,
    update: mockSessionUpdate,
    updateMany: mockUpdateMany,
    findUnique: mockFindUnique,
  },
})

// Create the tx mock once so it shares mock function references
const txMock = createTxMock()

mock.module("@/lib/prisma", () => ({
  prisma: {
    supportTicket: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
    supportTicketReply: {
      create: mockReplyCreate,
      update: mockReplyUpdate,
      updateMany: mockUpdateMany,
    },
    supportTicketAttachmentUploadSession: {
      findUnique: mockFindUnique,
      findMany: mockSessionFindMany,
      create: mockSessionCreate,
      update: mockSessionUpdate,
      updateMany: mockUpdateMany,
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      return fn(txMock)
    },
  },
}))

const repoModule =
  await import("@/modules/support-tickets/support-ticket.repository")
const repository = repoModule.supportTicketRepository

describe("SupportTicketRepository", () => {
  // ─── Helpers ───────────────────────────────────────────────────────
  beforeEach(() => {
    mockFindUnique.mockReset()
    mockFindMany.mockReset()
    mockCreate.mockReset()
    mockUpdate.mockReset()
    mockDelete.mockReset()
    mockUpdateMany.mockReset()
    mockReplyCreate.mockReset()
    mockReplyUpdate.mockReset()
    mockSessionCreate.mockReset()
    mockSessionUpdate.mockReset()
    mockSessionFindMany.mockReset()
  })

  // ─── getTicketById ─────────────────────────────────────────────────
  describe("getTicketById", () => {
    it("returns mapped ticket when found", async () => {
      mockFindUnique.mockResolvedValue(basePrismaTicket)
      const result = await repository.getTicketById("ticket_1")
      expect(result).not.toBeNull()
      expect(result!.id).toBe("ticket_1")
      expect(result!.status).toBe("open") // domain-mapped
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "ticket_1" } })
    })

    it("returns null when ticket not found", async () => {
      mockFindUnique.mockResolvedValue(null)
      const result = await repository.getTicketById("nonexistent")
      expect(result).toBeNull()
    })
  })

  // ─── listTicketsByOrganization ─────────────────────────────────────
  describe("listTicketsByOrganization", () => {
    it("returns mapped tickets for the organization", async () => {
      mockFindMany.mockResolvedValue([basePrismaTicket])
      const result = await repository.listTicketsByOrganization({
        organizationId: "org_1",
      })
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe("ticket_1")
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { organizationId: "org_1" },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    })

    it("applies custom limit", async () => {
      mockFindMany.mockResolvedValue([])
      await repository.listTicketsByOrganization({
        organizationId: "org_1",
        limit: 10,
      })
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      )
    })

    it("returns empty array when no tickets", async () => {
      mockFindMany.mockResolvedValue([])
      const result = await repository.listTicketsByOrganization({
        organizationId: "org_empty",
      })
      expect(result).toEqual([])
    })
  })

  // ─── listAllTickets ────────────────────────────────────────────────
  describe("listAllTickets", () => {
    it("returns all mapped tickets with default limit", async () => {
      mockFindMany.mockResolvedValue([basePrismaTicket])
      const result = await repository.listAllTickets({})
      expect(result).toHaveLength(1)
      expect(mockFindMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    })

    it("applies custom limit", async () => {
      mockFindMany.mockResolvedValue([])
      await repository.listAllTickets({ limit: 5 })
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      )
    })
  })

  // ─── deleteTicket ──────────────────────────────────────────────────
  describe("deleteTicket", () => {
    it("calls prisma delete and returns true", async () => {
      mockDelete.mockResolvedValue(basePrismaTicket)
      const result = await repository.deleteTicket("ticket_1")
      expect(result).toBe(true)
      expect(mockDelete).toHaveBeenCalledWith({ where: { id: "ticket_1" } })
    })
  })

  // ─── createUploadSession ───────────────────────────────────────────
  describe("createUploadSession", () => {
    const sessionInput = {
      id: "session_1",
      organizationId: "org_1",
      uploaderWorkosUserId: "user_1",
      target: "create" as const,
      ticketId: null,
      fileName: "file.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      checksumSha256: null,
      storageKey: "key/file.pdf",
      storageBucket: "bucket",
      expiresAt: new Date("2030-01-01"),
    }

    it("creates session and returns mapped record", async () => {
      mockSessionCreate.mockResolvedValue({
        id: "session_1",
        organizationId: "org_1",
        uploaderWorkosUserId: "user_1",
        target: "CREATE",
        ticketId: null,
        fileName: "file.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        checksumSha256: null,
        storageKey: "key/file.pdf",
        storageBucket: "bucket",
        expiresAt: new Date("2030-01-01"),
        registeredAt: null,
        consumedAt: null,
        consumedTicketId: null,
        consumedReplyId: null,
        createdAt: new Date("2026-06-01"),
        updatedAt: new Date("2026-06-01"),
      })
      const result = await repository.createUploadSession(sessionInput)
      expect(result.id).toBe("session_1")
      expect(mockSessionCreate).toHaveBeenCalled()
    })
  })

  // ─── getUploadSessionById ──────────────────────────────────────────
  describe("getUploadSessionById", () => {
    it("returns mapped session when found", async () => {
      mockFindUnique.mockResolvedValue({
        id: "session_1",
        organizationId: "org_1",
        uploaderWorkosUserId: "user_1",
        target: "CREATE",
        ticketId: null,
        fileName: "file.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        checksumSha256: null,
        storageKey: "key/file.pdf",
        storageBucket: "bucket",
        expiresAt: new Date("2030-01-01"),
        registeredAt: null,
        consumedAt: null,
        consumedTicketId: null,
        consumedReplyId: null,
        createdAt: new Date("2026-06-01"),
        updatedAt: new Date("2026-06-01"),
      })
      const result = await repository.getUploadSessionById("session_1")
      expect(result).not.toBeNull()
      expect(result!.id).toBe("session_1")
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: "session_1" },
      })
    })

    it("returns null when session not found", async () => {
      mockFindUnique.mockResolvedValue(null)
      const result = await repository.getUploadSessionById("nonexistent")
      expect(result).toBeNull()
    })
  })

  // ─── markUploadSessionRegistered ───────────────────────────────────
  describe("markUploadSessionRegistered", () => {
    const regInput = {
      id: "session_1",
      organizationId: "org_1",
      uploaderWorkosUserId: "user_1",
      target: "create" as const,
      ticketId: null,
      fileName: "file.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      checksumSha256: null,
      storageKey: "key/file.pdf",
      storageBucket: "bucket",
    }

    it("throws error when session does not exist", async () => {
      mockFindUnique.mockResolvedValue(null)
      await expect(
        repository.markUploadSessionRegistered(regInput)
      ).rejects.toThrow("Attachment upload session was not found.")
    })

    it("throws error when session payload does not match", async () => {
      mockFindUnique.mockResolvedValue({
        id: "session_1",
        organizationId: "org_other",
        uploaderWorkosUserId: "user_1",
        target: "CREATE",
        ticketId: null,
        fileName: "file.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        checksumSha256: null,
        storageKey: "key/file.pdf",
        storageBucket: "bucket",
        registeredAt: null,
        consumedAt: null,
        consumedTicketId: null,
        consumedReplyId: null,
        expiresAt: new Date("2030-01-01"),
        createdAt: new Date("2026-06-01"),
        updatedAt: new Date("2026-06-01"),
      })
      await expect(
        repository.markUploadSessionRegistered(regInput)
      ).rejects.toThrow("Attachment upload session payload mismatch.")
    })

    it("updates registeredAt when payload matches", async () => {
      mockFindUnique.mockResolvedValue({
        id: "session_1",
        organizationId: "org_1",
        uploaderWorkosUserId: "user_1",
        target: "CREATE",
        ticketId: null,
        fileName: "file.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        checksumSha256: null,
        storageKey: "key/file.pdf",
        storageBucket: "bucket",
        registeredAt: null,
        consumedAt: null,
        consumedTicketId: null,
        consumedReplyId: null,
        expiresAt: new Date("2030-01-01"),
        createdAt: new Date("2026-06-01"),
        updatedAt: new Date("2026-06-01"),
      })
      mockSessionUpdate.mockResolvedValue({
        id: "session_1",
        organizationId: "org_1",
        uploaderWorkosUserId: "user_1",
        target: "CREATE",
        ticketId: null,
        fileName: "file.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        checksumSha256: null,
        storageKey: "key/file.pdf",
        storageBucket: "bucket",
        registeredAt: new Date("2026-06-02"),
        consumedAt: null,
        consumedTicketId: null,
        consumedReplyId: null,
        expiresAt: new Date("2030-01-01"),
        createdAt: new Date("2026-06-01"),
        updatedAt: new Date("2026-06-02"),
      })
      const result = await repository.markUploadSessionRegistered(regInput)
      expect(result.id).toBe("session_1")
      expect(result.registeredAt).toBeInstanceOf(Date)
      expect(mockSessionUpdate).toHaveBeenCalled()
    })
  })

  // ─── updateTicketStatus (non-closed) ───────────────────────────────
  describe("updateTicketStatus", () => {
    it("updates status for non-closed transition using direct prisma", async () => {
      mockUpdate.mockResolvedValue({
        ...basePrismaTicket,
        status: "IN_PROGRESS" as const,
      })
      const result = await repository.updateTicketStatus({
        ticketId: "ticket_1",
        status: "in_progress",
        resolvedAt: null,
        closedAt: null,
      })
      expect(result.status).toBe("in_progress")
      expect(mockUpdate).toHaveBeenCalled()
    })

    it("updates status to closed using transaction with secureForm wipe", async () => {
      // For closed: uses $transaction. The tx mock delegates to mockUpdate for tx.supportTicket.update
      mockUpdate.mockResolvedValue({
        ...basePrismaTicket,
        status: "CLOSED" as const,
        closedAt: new Date("2026-06-02"),
        resolvedAt: new Date("2026-06-02"),
      })
      mockUpdateMany.mockResolvedValue({ count: 1 })

      const closedAt = new Date("2026-06-02")
      const result = await repository.updateTicketStatus({
        ticketId: "ticket_1",
        status: "closed",
        resolvedAt: closedAt,
        closedAt,
      })
      expect(result.status).toBe("closed")
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockUpdateMany).toHaveBeenCalled()
    })
  })

  // ─── updateTicket ──────────────────────────────────────────────────
  describe("updateTicket", () => {
    it("updates with basic fields using direct prisma", async () => {
      mockUpdate.mockResolvedValue({
        ...basePrismaTicket,
        department: "BILLING" as const,
        priority: "LOW" as const,
      })
      const result = await repository.updateTicket({
        ticketId: "ticket_1",
        data: { department: "billing", priority: "low" },
      })
      expect(result.department).toBe("billing")
      expect(result.priority).toBe("low")
      expect(mockUpdate).toHaveBeenCalled()
    })

    it("clears secureForm using transaction when clearSecureForm is true", async () => {
      mockUpdate.mockResolvedValue({
        ...basePrismaTicket,
        secureForm: null,
      })
      mockUpdateMany.mockResolvedValue({ count: 1 })

      const result = await repository.updateTicket({
        ticketId: "ticket_1",
        data: { status: "closed" },
        clearSecureForm: true,
      })
      expect(result).not.toBeNull()
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockUpdateMany).toHaveBeenCalled()
    })
  })

  // ─── createTicket (no upload sessions) ─────────────────────────────
  describe("createTicket", () => {
    it("creates a ticket without upload sessions", async () => {
      mockCreate.mockResolvedValue({
        ...basePrismaTicket,
        id: "new_ticket",
        attachmentsJson: null,
      })

      const result = await repository.createTicket({
        ticketNumber: "TCK-NEW-001",
        organizationId: "org_1",
        requesterWorkosUserId: "user_r",
        department: "technical",
        priority: "medium",
        subject: "New ticket",
      })

      expect(result.id).toBe("new_ticket")
      expect(result.status).toBe("open")
      expect(mockCreate).toHaveBeenCalled()
    })

    it("creates a ticket with upload sessions and merges attachments", async () => {
      // First: tx.supportTicket.create returns ticket with no attachments
      mockCreate.mockResolvedValue({
        ...basePrismaTicket,
        id: "new_ticket2",
        attachmentsJson: null,
      })

      // consumeUploadSessions: updateMany returns count 1, findMany returns sessions
      mockUpdateMany.mockResolvedValue({ count: 1 })
      mockSessionFindMany.mockResolvedValue([
        {
          id: "att_1",
          organizationId: "org_1",
          uploaderWorkosUserId: "user_r",
          target: "CREATE",
          ticketId: null,
          fileName: "file.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          checksumSha256: null,
          storageKey: "support/file.pdf",
          storageBucket: "bucket",
          expiresAt: new Date("2030-01-01"),
          registeredAt: new Date("2026-06-01"),
          consumedAt: new Date("2026-06-01"),
          consumedTicketId: null,
          consumedReplyId: null,
          createdAt: new Date("2026-06-01"),
          updatedAt: new Date("2026-06-01"),
        },
      ])

      // The second update (for merging attachments)
      mockUpdate.mockResolvedValue({
        ...basePrismaTicket,
        id: "new_ticket2",
        attachmentsJson: [{ id: "att_1", fileName: "file.pdf" }],
      })

      const result = await repository.createTicket({
        ticketNumber: "TCK-NEW-002",
        organizationId: "org_1",
        requesterWorkosUserId: "user_r",
        department: "technical",
        priority: "high",
        subject: "With uploads",
        uploadSessionIds: ["att_1"],
      })

      expect(result.id).toBe("new_ticket2")
      expect(mockCreate).toHaveBeenCalled()
      expect(mockUpdate).toHaveBeenCalled()
    })
  })

  // ─── createReply ──────────────────────────────────────────────────
  describe("createReply", () => {
    it("creates a reply without upload sessions", async () => {
      mockFindUnique.mockResolvedValue({ organizationId: "org_1" })
      mockReplyCreate.mockResolvedValue({
        id: "reply_1",
        ticketId: "ticket_1",
        authorWorkosUserId: "user_a",
        body: "Test reply",
        secureForm: null,
        isInternalNote: false,
        attachmentsJson: null,
        createdAt: new Date("2026-06-01"),
        updatedAt: new Date("2026-06-01"),
      })

      const result = await repository.createReply({
        ticketId: "ticket_1",
        authorWorkosUserId: "user_a",
        body: "Test reply",
      })

      expect(result.id).toBe("reply_1")
      expect(result.body).toBe("Test reply")
      expect(mockFindUnique).toHaveBeenCalled()
      expect(mockReplyCreate).toHaveBeenCalled()
    })

    it("throws when ticket does not exist", async () => {
      mockFindUnique.mockResolvedValue(null)

      await expect(
        repository.createReply({
          ticketId: "nonexistent",
          authorWorkosUserId: "user_a",
          body: "Test reply",
        })
      ).rejects.toThrow("Support ticket nonexistent was not found.")
    })
  })

  // ─── getTicketThread (preserve + expand) ───────────────────────────
  describe("getTicketThread — Prisma query params", () => {
    it("passes { isInternalNote: false } when includeInternalNotes is false", async () => {
      mockFindUnique.mockResolvedValue(null)

      await repository
        .getTicketThread({ ticketId: "ticket_1", includeInternalNotes: false })
        .catch(() => {})

      expect(mockFindUnique).toHaveBeenCalledTimes(1)
      const callArg = mockFindUnique.mock.calls[0]?.[0] as {
        include?: { replies?: { where?: unknown } }
      }
      expect(callArg.include?.replies?.where).toEqual({ isInternalNote: false })
    })

    it("passes undefined where when includeInternalNotes is true", async () => {
      mockFindUnique.mockResolvedValue(null)

      await repository
        .getTicketThread({ ticketId: "ticket_2", includeInternalNotes: true })
        .catch(() => {})

      expect(mockFindUnique).toHaveBeenCalledTimes(1)
      const callArg = mockFindUnique.mock.calls[0]?.[0] as {
        include?: { replies?: { where?: unknown } }
      }
      expect(callArg.include?.replies?.where).toBeUndefined()
    })

    it("passes { isInternalNote: false } when includeInternalNotes is undefined", async () => {
      mockFindUnique.mockResolvedValue(null)

      await repository.getTicketThread({ ticketId: "ticket_3" }).catch(() => {})

      expect(mockFindUnique).toHaveBeenCalledTimes(1)
      const callArg = mockFindUnique.mock.calls[0]?.[0] as {
        include?: { replies?: { where?: unknown } }
      }
      expect(callArg.include?.replies?.where).toEqual({ isInternalNote: false })
    })

    it("returns null when ticket not found", async () => {
      mockFindUnique.mockResolvedValue(null)
      const result = await repository.getTicketThread({ ticketId: "missing" })
      expect(result).toBeNull()
    })

    it("returns thread with ticket and replies when found", async () => {
      mockFindUnique.mockResolvedValue({
        ...basePrismaTicket,
        replies: [],
      })
      const result = await repository.getTicketThread({ ticketId: "ticket_1" })
      expect(result).not.toBeNull()
      expect(result!.ticket.id).toBe("ticket_1")
      expect(result!.replies).toEqual([])
    })
  })
})
