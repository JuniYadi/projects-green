import { beforeEach, describe, expect, it, mock } from "bun:test"

import {
  createSupportTicketAttachmentService,
  SupportTicketAttachmentAccessDeniedError,
  SupportTicketAttachmentNotFoundError,
  SupportTicketAttachmentUploadExpiredError,
  SupportTicketAttachmentUploadMismatchError,
} from "@/modules/support-tickets/support-ticket-attachment.service"
import {
  SupportTicketAttachmentUploadNotFoundError,
  SupportTicketAttachmentUploadValidationError,
} from "@/modules/support-tickets/support-ticket-attachment.storage"
import { SupportTicketAttachmentValidationError } from "@/modules/support-tickets/support-ticket-attachment.validation"
import type { SupportTicket } from "@/modules/support-tickets/support-ticket.types"

// Stateful mock prisma for lazy repository tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockLazySessions = new Map<string, any>()

const mockSessionCreate = mock()
const mockSessionFindUnique = mock()
const mockSessionUpdate = mock()
const mockTicketFindUnique = mock()

mock.module("@/lib/prisma", () => ({
  prisma: {
    supportTicketAttachmentUploadSession: {
      create: mockSessionCreate,
      findUnique: mockSessionFindUnique,
      update: mockSessionUpdate,
    },
    supportTicket: {
      findUnique: mockTicketFindUnique,
    },
  },
}))

const baseTicket: SupportTicket = {
  id: "ticket_1",
  ticketNumber: "TCK-9001",
  organizationId: "org_1",
  requesterWorkosUserId: "user_requester",
  assignedAgentWorkosUserId: "user_agent",
  department: "technical",
  priority: "medium",
  service: "deploy",
  status: "open",
  subject: "Cannot deploy",
  description: null,
  secureForm: null,
  attachmentMetadata: [],
  createdAt: new Date("2026-05-01T00:00:00.000Z"),
  updatedAt: new Date("2026-05-01T00:00:00.000Z"),
  resolvedAt: null,
  closedAt: null,
}

const createDeps = () => {
  const sessions = new Map<
    string,
    {
      id: string
      organizationId: string
      uploaderWorkosUserId: string
      target: "create" | "reply"
      ticketId: string | null
      storageKey: string
      storageBucket: string
      consumedAt: Date | null
      expiresAt: Date
      registeredAt: Date | null
    }
  >()

  return {
    sessions,
    repository: {
      async getTicketById(ticketId: string) {
        if (ticketId !== baseTicket.id) {
          return null
        }

        return baseTicket
      },
      async createUploadSession(input: {
        id: string
        organizationId: string
        uploaderWorkosUserId: string
        target: "create" | "reply"
        ticketId: string | null
        storageKey: string
        storageBucket: string
        expiresAt: Date
      }) {
        sessions.set(input.id, {
          id: input.id,
          organizationId: input.organizationId,
          uploaderWorkosUserId: input.uploaderWorkosUserId,
          target: input.target,
          ticketId: input.ticketId,
          storageKey: input.storageKey,
          storageBucket: input.storageBucket,
          consumedAt: null,
          expiresAt: input.expiresAt,
          registeredAt: null,
        })
        return input
      },
      async getUploadSessionById(id: string) {
        return sessions.get(id) ?? null
      },
      async markUploadSessionRegistered(input: { id: string }) {
        const session = sessions.get(input.id)
        if (!session) {
          throw new Error("missing session")
        }

        const next = {
          ...session,
          registeredAt: new Date(),
        }
        sessions.set(input.id, next)

        return next
      },
      async deleteUploadSession(id: string) {
        sessions.delete(id)
      },
    },
    storage: {
      async createPresignedUpload(input: {
        extension: string
        target: "create" | "reply"
        ticketId: string | null
      }) {
        const ticketScope = input.ticketId ?? "pending"
        return {
          bucket: "support-ticket-bucket",
          key: `support-ticket-attachments/org_1/${input.target}/${ticketScope}/user_requester/1.${input.extension}`,
          uploadUrl: "https://example.com/upload",
          expiresAt: "2030-05-21T00:00:00.000Z",
        }
      },
      getExpectedStorageKeyPrefix(context: {
        organizationId: string
        target: "create" | "reply"
        ticketId: string | null
        uploaderWorkosUserId: string
      }) {
        const ticketScope = context.ticketId ?? "pending"
        return `support-ticket-attachments/${context.organizationId}/${context.target}/${ticketScope}/${context.uploaderWorkosUserId}`
      },
      async verifyUploadedObject() {
        return
      },
    },
  }
}

describe("support ticket attachment service", () => {
  it("rejects presign for unauthorized reply actor", async () => {
    const deps = createDeps()
    const service = createSupportTicketAttachmentService(deps)

    await expect(
      service.createPresignedAttachmentUpload({
        actor: {
          organizationId: "org_1",
          workosUserId: "user_not_owner",
        },
        target: "reply",
        ticketId: "ticket_1",
        fileName: "issue.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      })
    ).rejects.toBeInstanceOf(SupportTicketAttachmentAccessDeniedError)
  })

  it("rejects unsupported extension on presign", async () => {
    const deps = createDeps()
    const service = createSupportTicketAttachmentService(deps)

    await expect(
      service.createPresignedAttachmentUpload({
        actor: {
          organizationId: "org_1",
          workosUserId: "user_requester",
        },
        target: "create",
        fileName: "issue.exe",
        mimeType: "application/octet-stream",
        sizeBytes: 1024,
      })
    ).rejects.toBeInstanceOf(SupportTicketAttachmentValidationError)
  })

  it("registers validated upload session metadata", async () => {
    const deps = createDeps()
    const service = createSupportTicketAttachmentService(deps)

    const upload = await service.createPresignedAttachmentUpload({
      actor: {
        organizationId: "org_1",
        workosUserId: "user_requester",
      },
      target: "create",
      fileName: "issue.pdf",
      mimeType: "application/pdf",
      sizeBytes: 512,
    })

    const attachment = await service.registerAttachment({
      actor: {
        organizationId: "org_1",
        workosUserId: "user_requester",
      },
      target: "create",
      id: upload.attachmentId,
      fileName: "issue.pdf",
      mimeType: "application/pdf",
      sizeBytes: 512,
      storageBucket: upload.storageBucket,
      storageKey: upload.storageKey,
    })

    expect(attachment.id).toBe(upload.attachmentId)
    expect(attachment.storageKey).toContain("support-ticket-attachments")
  })

  it("maps upload not found as expired", async () => {
    const deps = createDeps()
    const service = createSupportTicketAttachmentService({
      ...deps,
      storage: {
        ...deps.storage,
        async verifyUploadedObject() {
          throw new SupportTicketAttachmentUploadNotFoundError()
        },
      },
    })

    const upload = await service.createPresignedAttachmentUpload({
      actor: {
        organizationId: "org_1",
        workosUserId: "user_requester",
      },
      target: "create",
      fileName: "issue.pdf",
      mimeType: "application/pdf",
      sizeBytes: 512,
    })

    await expect(
      service.registerAttachment({
        actor: {
          organizationId: "org_1",
          workosUserId: "user_requester",
        },
        target: "create",
        id: upload.attachmentId,
        fileName: "issue.pdf",
        mimeType: "application/pdf",
        sizeBytes: 512,
        storageBucket: upload.storageBucket,
        storageKey: upload.storageKey,
      })
    ).rejects.toBeInstanceOf(SupportTicketAttachmentUploadExpiredError)
  })

  it("rejects mismatched storage key registration", async () => {
    const deps = createDeps()
    const service = createSupportTicketAttachmentService(deps)

    const upload = await service.createPresignedAttachmentUpload({
      actor: {
        organizationId: "org_1",
        workosUserId: "user_requester",
      },
      target: "create",
      fileName: "issue.pdf",
      mimeType: "application/pdf",
      sizeBytes: 512,
    })

    await expect(
      service.registerAttachment({
        actor: {
          organizationId: "org_1",
          workosUserId: "user_requester",
        },
        target: "create",
        id: upload.attachmentId,
        fileName: "issue.pdf",
        mimeType: "application/pdf",
        sizeBytes: 512,
        storageBucket: upload.storageBucket,
        storageKey: "bad-prefix/file.pdf",
      })
    ).rejects.toBeInstanceOf(SupportTicketAttachmentUploadMismatchError)
  })

  it("presigns for reply target with ticketId (owner can manage)", async () => {
    const deps = createDeps()
    // give the actor org access
    const ownerActor = {
      organizationId: "org_1",
      workosUserId: "user_requester",
    }
    const service = createSupportTicketAttachmentService(deps)

    const result = await service.createPresignedAttachmentUpload({
      actor: ownerActor,
      target: "reply",
      ticketId: "ticket_1",
      fileName: "reply.pdf",
      mimeType: "application/pdf",
      sizeBytes: 512,
    })

    expect(result.attachmentId).toBeDefined()
    expect(result.uploadUrl).toBe("https://example.com/upload")
    expect(result.storageKey).toContain("reply/ticket_1")
  })

  it("rejects reply presign when ticket not found", async () => {
    const deps = createDeps()
    deps.repository.getTicketById = async () => null
    const service = createSupportTicketAttachmentService(deps)

    await expect(
      service.createPresignedAttachmentUpload({
        actor: { organizationId: "org_1", workosUserId: "user_requester" },
        target: "reply",
        ticketId: "nonexistent",
        fileName: "file.pdf",
        mimeType: "application/pdf",
        sizeBytes: 512,
      })
    ).rejects.toBeInstanceOf(SupportTicketAttachmentNotFoundError)
  })

  it("rejects reply presign without ticketId", async () => {
    const deps = createDeps()
    const service = createSupportTicketAttachmentService(deps)

    await expect(
      service.createPresignedAttachmentUpload({
        actor: { organizationId: "org_1", workosUserId: "user_requester" },
        target: "reply",
        fileName: "file.pdf",
        mimeType: "application/pdf",
        sizeBytes: 512,
      })
    ).rejects.toBeInstanceOf(SupportTicketAttachmentUploadMismatchError)
  })

  it("rejects create presign without organizationId", async () => {
    const deps = createDeps()
    const service = createSupportTicketAttachmentService(deps)

    await expect(
      service.createPresignedAttachmentUpload({
        actor: { organizationId: null, workosUserId: "user_requester" },
        target: "create",
        fileName: "file.pdf",
        mimeType: "application/pdf",
        sizeBytes: 512,
      })
    ).rejects.toBeInstanceOf(SupportTicketAttachmentAccessDeniedError)
  })

  it("rejects register with session owner mismatch", async () => {
    const deps = createDeps()
    const service = createSupportTicketAttachmentService(deps)

    const upload = await service.createPresignedAttachmentUpload({
      actor: { organizationId: "org_1", workosUserId: "user_requester" },
      target: "create",
      fileName: "issue.pdf",
      mimeType: "application/pdf",
      sizeBytes: 512,
    })

    // Register with a different user (mismatch)
    await expect(
      service.registerAttachment({
        actor: { organizationId: "org_2", workosUserId: "user_hacker" },
        target: "create",
        id: upload.attachmentId,
        fileName: "issue.pdf",
        mimeType: "application/pdf",
        sizeBytes: 512,
        storageBucket: upload.storageBucket,
        storageKey: upload.storageKey,
      })
    ).rejects.toBeInstanceOf(SupportTicketAttachmentUploadMismatchError)
  })

  it("rejects register with expired session", async () => {
    const deps = createDeps()
    const storageKey =
      "support-ticket-attachments/org_1/create/pending/user_requester/file.pdf"
    // Override getUploadSessionById to always return expired session with matching prefix
    deps.repository.getUploadSessionById = async () => ({
      id: "att_expired",
      organizationId: "org_1",
      uploaderWorkosUserId: "user_requester",
      target: "create" as const,
      ticketId: null,
      storageKey,
      storageBucket: "bucket",
      consumedAt: null,
      expiresAt: new Date("2020-01-01"), // expired!
      registeredAt: null,
    })

    const service = createSupportTicketAttachmentService(deps)

    await expect(
      service.registerAttachment({
        actor: { organizationId: "org_1", workosUserId: "user_requester" },
        target: "create",
        id: "att_expired",
        fileName: "issue.pdf",
        mimeType: "application/pdf",
        sizeBytes: 512,
        storageBucket: "bucket",
        storageKey,
      })
    ).rejects.toBeInstanceOf(SupportTicketAttachmentUploadExpiredError)
  })

  it("rejects register when verifyUploadedObject throws validation error", async () => {
    const deps = createDeps()
    const service = createSupportTicketAttachmentService({
      ...deps,
      storage: {
        ...deps.storage,
        async verifyUploadedObject() {
          throw new SupportTicketAttachmentUploadValidationError(
            "Size mismatch"
          )
        },
      },
    })

    const upload = await service.createPresignedAttachmentUpload({
      actor: { organizationId: "org_1", workosUserId: "user_requester" },
      target: "create",
      fileName: "issue.pdf",
      mimeType: "application/pdf",
      sizeBytes: 512,
    })

    await expect(
      service.registerAttachment({
        actor: { organizationId: "org_1", workosUserId: "user_requester" },
        target: "create",
        id: upload.attachmentId,
        fileName: "issue.pdf",
        mimeType: "application/pdf",
        sizeBytes: 512,
        storageBucket: upload.storageBucket,
        storageKey: upload.storageKey,
      })
    ).rejects.toBeInstanceOf(SupportTicketAttachmentUploadValidationError)
  })

  it("rejects register with unexpected storage error", async () => {
    const deps = createDeps()
    const service = createSupportTicketAttachmentService({
      ...deps,
      storage: {
        ...deps.storage,
        async verifyUploadedObject() {
          throw new Error("Network failure")
        },
      },
    })

    const upload = await service.createPresignedAttachmentUpload({
      actor: { organizationId: "org_1", workosUserId: "user_requester" },
      target: "create",
      fileName: "issue.pdf",
      mimeType: "application/pdf",
      sizeBytes: 512,
    })

    await expect(
      service.registerAttachment({
        actor: { organizationId: "org_1", workosUserId: "user_requester" },
        target: "create",
        id: upload.attachmentId,
        fileName: "issue.pdf",
        mimeType: "application/pdf",
        sizeBytes: 512,
        storageBucket: upload.storageBucket,
        storageKey: upload.storageKey,
      })
    ).rejects.toBeInstanceOf(SupportTicketAttachmentUploadMismatchError)
  })

  it("rejects register when verifyUploadedObject throws validation error from validation module", async () => {
    const deps = createDeps()
    const service = createSupportTicketAttachmentService({
      ...deps,
      storage: {
        ...deps.storage,
        async verifyUploadedObject() {
          throw new SupportTicketAttachmentValidationError(
            "MIME_EXTENSION_MISMATCH",
            "MIME type does not match extension"
          )
        },
      },
    })

    const upload = await service.createPresignedAttachmentUpload({
      actor: { organizationId: "org_1", workosUserId: "user_requester" },
      target: "create",
      fileName: "issue.pdf",
      mimeType: "application/pdf",
      sizeBytes: 512,
    })

    await expect(
      service.registerAttachment({
        actor: { organizationId: "org_1", workosUserId: "user_requester" },
        target: "create",
        id: upload.attachmentId,
        fileName: "issue.pdf",
        mimeType: "application/pdf",
        sizeBytes: 512,
        storageBucket: upload.storageBucket,
        storageKey: upload.storageKey,
      })
    ).rejects.toBeInstanceOf(SupportTicketAttachmentValidationError)
  })

  it("rejects register when upload session is not found", async () => {
    const deps = createDeps()
    const service = createSupportTicketAttachmentService(deps)

    const upload = await service.createPresignedAttachmentUpload({
      actor: { organizationId: "org_1", workosUserId: "user_requester" },
      target: "create",
      fileName: "issue.pdf",
      mimeType: "application/pdf",
      sizeBytes: 512,
    })

    await expect(
      service.registerAttachment({
        actor: { organizationId: "org_1", workosUserId: "user_requester" },
        target: "create",
        id: "nonexistent-session",
        fileName: "issue.pdf",
        mimeType: "application/pdf",
        sizeBytes: 512,
        storageBucket: upload.storageBucket,
        storageKey: upload.storageKey,
      })
    ).rejects.toBeInstanceOf(SupportTicketAttachmentUploadExpiredError)
  })

  it("rejects register when upload session is already consumed", async () => {
    const deps = createDeps()
    const origGetById = deps.repository.getUploadSessionById
    deps.repository.getUploadSessionById = async (id: string) => {
      const session = await origGetById(id)
      if (!session) return null
      return { ...session, consumedAt: new Date() }
    }

    const service = createSupportTicketAttachmentService(deps)

    const upload = await service.createPresignedAttachmentUpload({
      actor: { organizationId: "org_1", workosUserId: "user_requester" },
      target: "create",
      fileName: "issue.pdf",
      mimeType: "application/pdf",
      sizeBytes: 512,
    })

    await expect(
      service.registerAttachment({
        actor: { organizationId: "org_1", workosUserId: "user_requester" },
        target: "create",
        id: upload.attachmentId,
        fileName: "issue.pdf",
        mimeType: "application/pdf",
        sizeBytes: 512,
        storageBucket: upload.storageBucket,
        storageKey: upload.storageKey,
      })
    ).rejects.toBeInstanceOf(SupportTicketAttachmentUploadExpiredError)
  })

  it("rejects register when session storage bucket does not match", async () => {
    const deps = createDeps()
    const origGetById = deps.repository.getUploadSessionById
    deps.repository.getUploadSessionById = async (id: string) => {
      const session = await origGetById(id)
      if (!session) return null
      return { ...session, storageBucket: "wrong-bucket" }
    }

    const service = createSupportTicketAttachmentService(deps)

    const upload = await service.createPresignedAttachmentUpload({
      actor: { organizationId: "org_1", workosUserId: "user_requester" },
      target: "create",
      fileName: "issue.pdf",
      mimeType: "application/pdf",
      sizeBytes: 512,
    })

    await expect(
      service.registerAttachment({
        actor: { organizationId: "org_1", workosUserId: "user_requester" },
        target: "create",
        id: upload.attachmentId,
        fileName: "issue.pdf",
        mimeType: "application/pdf",
        sizeBytes: 512,
        storageBucket: upload.storageBucket,
        storageKey: upload.storageKey,
      })
    ).rejects.toBeInstanceOf(SupportTicketAttachmentUploadMismatchError)
  })

  describe("lazy repository", () => {
    beforeEach(() => {
      mockLazySessions.clear()
      mockSessionCreate.mockClear()
      mockSessionFindUnique.mockClear()
      mockSessionUpdate.mockClear()
      mockTicketFindUnique.mockClear()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockSessionCreate.mockImplementation(async (args: any) => {
        const record = {
          id: args.data.id,
          organizationId: args.data.organizationId,
          uploaderWorkosUserId: args.data.uploaderWorkosUserId,
          target: args.data.target,
          ticketId: args.data.ticketId,
          fileName: args.data.fileName,
          mimeType: args.data.mimeType,
          sizeBytes: args.data.sizeBytes,
          checksumSha256: args.data.checksumSha256 ?? null,
          storageKey: args.data.storageKey,
          storageBucket: args.data.storageBucket,
          expiresAt: args.data.expiresAt,
          registeredAt: null,
          consumedAt: null,
          consumedTicketId: null,
          consumedReplyId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        mockLazySessions.set(record.id, { ...record })
        return record
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockSessionFindUnique.mockImplementation(async (args: any) => {
        const session = mockLazySessions.get(args.where.id)
        return session ? { ...session } : null
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockSessionUpdate.mockImplementation(async (args: any) => {
        const existing = mockLazySessions.get(args.where.id)
        if (!existing) throw new Error("Session not found")
        const updated = { ...existing, ...args.data, updatedAt: new Date() }
        mockLazySessions.set(args.where.id, updated)
        return updated
      })

      mockTicketFindUnique.mockResolvedValue(null)
    })

    it("uses lazy repository for create presign", async () => {
      const { storage } = createDeps()
      const service = createSupportTicketAttachmentService({ storage })

      const result = await service.createPresignedAttachmentUpload({
        actor: { organizationId: "org_1", workosUserId: "user_requester" },
        target: "create",
        fileName: "lazy-test.pdf",
        mimeType: "application/pdf",
        sizeBytes: 512,
      })

      expect(result.attachmentId).toBeDefined()
      expect(result.uploadUrl).toBe("https://example.com/upload")
      expect(mockSessionCreate).toHaveBeenCalledTimes(1)
    })

    it("uses lazy repository for reply presign", async () => {
      const mockPrismaTicket = {
        id: "ticket_1",
        ticketNumber: "TCK-9001",
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
      mockTicketFindUnique.mockResolvedValue(mockPrismaTicket)

      const { storage } = createDeps()
      const service = createSupportTicketAttachmentService({ storage })

      const result = await service.createPresignedAttachmentUpload({
        actor: { organizationId: null, workosUserId: "user_r" },
        target: "reply",
        ticketId: "ticket_1",
        fileName: "reply-lazy.pdf",
        mimeType: "application/pdf",
        sizeBytes: 512,
      })

      expect(result.attachmentId).toBeDefined()
      expect(result.storageKey).toContain("reply/ticket_1")
      // createUploadSession called once
      expect(mockSessionCreate).toHaveBeenCalledTimes(1)
    })

    it("uses lazy repository for register", async () => {
      const { storage } = createDeps()
      const service = createSupportTicketAttachmentService({ storage })

      const upload = await service.createPresignedAttachmentUpload({
        actor: { organizationId: "org_1", workosUserId: "user_requester" },
        target: "create",
        fileName: "register-lazy.pdf",
        mimeType: "application/pdf",
        sizeBytes: 512,
      })

      expect(upload.attachmentId).toBeDefined()
      expect(mockSessionCreate).toHaveBeenCalledTimes(1)

      const attachment = await service.registerAttachment({
        actor: { organizationId: "org_1", workosUserId: "user_requester" },
        target: "create",
        id: upload.attachmentId,
        fileName: "register-lazy.pdf",
        mimeType: "application/pdf",
        sizeBytes: 512,
        storageBucket: upload.storageBucket,
        storageKey: upload.storageKey,
      })

      expect(attachment.id).toBe(upload.attachmentId)
      // createUploadSession + markUploadSessionRegistered
      expect(mockSessionUpdate).toHaveBeenCalledTimes(1)
    })
  })
})
