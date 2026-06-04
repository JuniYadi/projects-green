import { describe, expect, it, mock } from "bun:test"

/**
 * Direct query-level test for SupportTicketRepository.getTicketThread.
 *
 * Mocks @/lib/prisma and verifies the exact Prisma `where` clause passed
 * for different `includeInternalNotes` values.
 */
const mockFindUnique = mock()

// Must come BEFORE imports per Bun mock.module rules
mock.module("@/lib/prisma", () => {
  const mockPrisma = {
    supportTicket: {
      findUnique: mockFindUnique,
      findMany: async () => [],
      create: async () => ({ id: "new", attachmentsJson: null }),
      update: async () => ({ id: "updated", attachmentsJson: null }),
      delete: async () => ({ id: "deleted" }),
    },
    supportTicketReply: {
      updateMany: async () => ({ count: 0 }),
    },
    supportTicketAttachmentUploadSession: {
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => ({ id: "session" }),
      update: async () => ({ id: "session" }),
      updateMany: async () => ({ count: 0 }),
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      return fn({
        supportTicket: {
          findUnique: mockFindUnique,
          update: async () => ({ id: "t", attachmentsJson: null }),
          findMany: async () => [],
        },
        supportTicketAttachmentUploadSession: {
          updateMany: async () => ({ count: 0 }),
          findMany: async () => [],
        },
      })
    },
  }
  return { prisma: mockPrisma }
})

// Import after mock so the module gets the mocked Prisma
const repoModule = await import("@/modules/support-tickets/support-ticket.repository")
const repository = repoModule.supportTicketRepository

describe("SupportTicketRepository.getTicketThread — Prisma query params", () => {
  it("passes { isInternalNote: false } when includeInternalNotes is false", async () => {
    mockFindUnique.mockReset()
    // Simulate ticket not found — this exercises the query path
    mockFindUnique.mockResolvedValue(null)

    await repository
      .getTicketThread({ ticketId: "ticket_1", includeInternalNotes: false })
      .catch(() => {}) // null return is expected

    expect(mockFindUnique).toHaveBeenCalledTimes(1)

    const callArg = mockFindUnique.mock.calls[0]?.[0] as {
      include?: { replies?: { where?: unknown } }
    }
    expect(callArg.include?.replies?.where).toEqual({ isInternalNote: false })
  })

  it("passes undefined where when includeInternalNotes is true (admin view)", async () => {
    mockFindUnique.mockReset()
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

  it("passes { isInternalNote: false } when includeInternalNotes is undefined (default/omitted)", async () => {
    mockFindUnique.mockReset()
    mockFindUnique.mockResolvedValue(null)

    await repository
      .getTicketThread({ ticketId: "ticket_3" })
      .catch(() => {})

    expect(mockFindUnique).toHaveBeenCalledTimes(1)

    const callArg = mockFindUnique.mock.calls[0]?.[0] as {
      include?: { replies?: { where?: unknown } }
    }
    expect(callArg.include?.replies?.where).toEqual({ isInternalNote: false })
  })
})
