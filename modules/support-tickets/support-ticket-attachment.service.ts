import { randomUUID } from "node:crypto"

import { canReadSupportTicket } from "@/modules/support-tickets/support-ticket.policy"
import {
  createSupportTicketAttachmentStorage,
  type SupportTicketAttachmentStorage,
  SupportTicketAttachmentUploadNotFoundError,
  SupportTicketAttachmentUploadValidationError,
} from "@/modules/support-tickets/support-ticket-attachment.storage"
import {
  isAllowedSupportTicketAttachmentStorageKey,
  SupportTicketAttachmentValidationError,
  validateSupportTicketAttachmentUploadInput,
} from "@/modules/support-tickets/support-ticket-attachment.validation"
import type {
  SupportTicket,
  SupportTicketActorContext,
  SupportTicketAttachmentMetadata,
  SupportTicketAttachmentUploadTarget,
  SupportTicketOwnership,
} from "@/modules/support-tickets/support-ticket.types"

export class SupportTicketAttachmentNotFoundError extends Error {
  constructor(ticketId: string) {
    super(`Support ticket ${ticketId} was not found.`)
    this.name = "SupportTicketAttachmentNotFoundError"
  }
}

export class SupportTicketAttachmentAccessDeniedError extends Error {
  constructor(action: string) {
    super(`You do not have permission to ${action} this support ticket.`)
    this.name = "SupportTicketAttachmentAccessDeniedError"
  }
}

export class SupportTicketAttachmentUploadExpiredError extends Error {
  constructor() {
    super("Attachment upload was not found or the upload URL has expired.")
    this.name = "SupportTicketAttachmentUploadExpiredError"
  }
}

export class SupportTicketAttachmentUploadMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SupportTicketAttachmentUploadMismatchError"
  }
}

export type SupportTicketAttachmentActorContext = {
  canManageTickets?: boolean
  isSuperAdmin?: boolean
  organizationId: string | null
  workosUserId: string
}

type SupportTicketAttachmentRepository = {
  createUploadSession: (input: {
    checksumSha256?: string | null
    expiresAt: Date
    fileName: string
    id: string
    mimeType: string
    organizationId: string
    sizeBytes: number
    storageBucket: string
    storageKey: string
    target: SupportTicketAttachmentUploadTarget
    ticketId: string | null
    uploaderWorkosUserId: string
  }) => Promise<unknown>
  getTicketById: (ticketId: string) => Promise<SupportTicket | null>
  getUploadSessionById: (id: string) => Promise<{
    id: string
    organizationId: string
    uploaderWorkosUserId: string
    target: SupportTicketAttachmentUploadTarget
    ticketId: string | null
    storageKey: string
    storageBucket: string
    consumedAt: Date | null
    expiresAt: Date
    registeredAt: Date | null
  } | null>
  markUploadSessionRegistered: (input: {
    checksumSha256?: string | null
    fileName: string
    id: string
    mimeType: string
    organizationId: string
    sizeBytes: number
    storageBucket: string
    storageKey: string
    target: SupportTicketAttachmentUploadTarget
    ticketId: string | null
    uploaderWorkosUserId: string
  }) => Promise<unknown>
}

type CreatePresignedAttachmentUploadInput = {
  actor: SupportTicketAttachmentActorContext
  checksumSha256?: string | null
  fileName: string
  mimeType: string
  sizeBytes: number
  target: SupportTicketAttachmentUploadTarget
  ticketId?: string
}

type RegisterSupportTicketAttachmentInput = {
  actor: SupportTicketAttachmentActorContext
  checksumSha256?: string | null
  fileName: string
  id: string
  mimeType: string
  sizeBytes: number
  storageBucket: string
  storageKey: string
  target: SupportTicketAttachmentUploadTarget
  ticketId?: string
}

export type SupportTicketAttachmentService = {
  createPresignedAttachmentUpload: (
    input: CreatePresignedAttachmentUploadInput
  ) => Promise<{
    attachmentId: string
    expiresAt: string
    storageBucket: string
    storageKey: string
    uploadUrl: string
  }>
  registerAttachment: (
    input: RegisterSupportTicketAttachmentInput
  ) => Promise<SupportTicketAttachmentMetadata>
}

type CreateSupportTicketAttachmentServiceOptions = {
  repository?: SupportTicketAttachmentRepository
  storage?: SupportTicketAttachmentStorage
}

const createLazyAttachmentRepository =
  (): SupportTicketAttachmentRepository => {
    const loadRepository = async () => {
      const repositoryModule =
        await import("@/modules/support-tickets/support-ticket.repository")

      return repositoryModule.supportTicketRepository
    }

    return {
      async getTicketById(ticketId) {
        const repository = await loadRepository()
        return repository.getTicketById(ticketId)
      },
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
    }
  }

const toTicketActorContext = (
  actor: SupportTicketAttachmentActorContext,
  ticket: SupportTicketOwnership
): SupportTicketActorContext => {
  return {
    workosUserId: actor.workosUserId,
    organizationId: actor.organizationId ?? ticket.organizationId,
    canManageTickets: actor.canManageTickets,
    isSuperAdmin: actor.isSuperAdmin,
  }
}

const ensureReplyTicketAccess = async (
  repository: SupportTicketAttachmentRepository,
  actor: SupportTicketAttachmentActorContext,
  ticketId: string,
  action: string
) => {
  const ticket = await repository.getTicketById(ticketId)

  if (!ticket) {
    throw new SupportTicketAttachmentNotFoundError(ticketId)
  }

  const policyActor = toTicketActorContext(actor, ticket)

  if (!canReadSupportTicket(policyActor, ticket)) {
    throw new SupportTicketAttachmentAccessDeniedError(action)
  }

  return ticket
}

const resolveUploadContext = async (
  repository: SupportTicketAttachmentRepository,
  input: {
    actor: SupportTicketAttachmentActorContext
    target: SupportTicketAttachmentUploadTarget
    ticketId?: string
    action: string
  }
) => {
  if (input.target === "reply") {
    if (!input.ticketId) {
      throw new SupportTicketAttachmentUploadMismatchError(
        "ticketId is required for reply attachment uploads."
      )
    }

    const ticket = await ensureReplyTicketAccess(
      repository,
      input.actor,
      input.ticketId,
      input.action
    )

    return {
      organizationId: ticket.organizationId,
      ticketId: ticket.id,
    }
  }

  if (!input.actor.organizationId) {
    throw new SupportTicketAttachmentAccessDeniedError(input.action)
  }

  return {
    organizationId: input.actor.organizationId,
    ticketId: null,
  }
}

export const createSupportTicketAttachmentService = (
  options: CreateSupportTicketAttachmentServiceOptions = {}
): SupportTicketAttachmentService => {
  const repository = options.repository ?? createLazyAttachmentRepository()
  let storage = options.storage

  const resolveStorage = () => {
    storage ??= createSupportTicketAttachmentStorage()
    return storage
  }

  return {
    async createPresignedAttachmentUpload(input) {
      const context = await resolveUploadContext(repository, {
        actor: input.actor,
        target: input.target,
        ticketId: input.ticketId,
        action: "upload attachments to",
      })

      const validated = validateSupportTicketAttachmentUploadInput({
        checksumSha256: input.checksumSha256,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      })
      const attachmentId = randomUUID()
      const attachmentStorage = resolveStorage()

      const upload = await attachmentStorage.createPresignedUpload({
        attachmentId,
        checksumSha256: validated.checksumSha256,
        extension: validated.extension,
        fileName: validated.fileName,
        mimeType: validated.mimeType,
        organizationId: context.organizationId,
        sizeBytes: validated.sizeBytes,
        target: input.target,
        ticketId: context.ticketId,
        uploaderWorkosUserId: input.actor.workosUserId,
      })

      await repository.createUploadSession({
        id: attachmentId,
        checksumSha256: validated.checksumSha256,
        expiresAt: new Date(upload.expiresAt),
        fileName: validated.fileName,
        mimeType: validated.mimeType,
        organizationId: context.organizationId,
        sizeBytes: validated.sizeBytes,
        storageBucket: upload.bucket,
        storageKey: upload.key,
        target: input.target,
        ticketId: context.ticketId,
        uploaderWorkosUserId: input.actor.workosUserId,
      })

      return {
        attachmentId,
        uploadUrl: upload.uploadUrl,
        storageKey: upload.key,
        storageBucket: upload.bucket,
        expiresAt: upload.expiresAt,
      }
    },
    async registerAttachment(input) {
      const context = await resolveUploadContext(repository, {
        actor: input.actor,
        target: input.target,
        ticketId: input.ticketId,
        action: "register attachments on",
      })

      const validated = validateSupportTicketAttachmentUploadInput({
        checksumSha256: input.checksumSha256,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      })
      const attachmentStorage = resolveStorage()
      const expectedPrefix = attachmentStorage.getExpectedStorageKeyPrefix({
        organizationId: context.organizationId,
        target: input.target,
        ticketId: context.ticketId,
        uploaderWorkosUserId: input.actor.workosUserId,
      })

      if (
        !isAllowedSupportTicketAttachmentStorageKey(
          input.storageKey,
          expectedPrefix
        )
      ) {
        throw new SupportTicketAttachmentUploadMismatchError(
          "Attachment storage key does not match ticket ownership scope."
        )
      }

      const session = await repository.getUploadSessionById(input.id)

      if (!session || session.consumedAt || session.expiresAt <= new Date()) {
        throw new SupportTicketAttachmentUploadExpiredError()
      }

      const isSessionOwnerMatch =
        session.organizationId === context.organizationId &&
        session.uploaderWorkosUserId === input.actor.workosUserId &&
        session.target === input.target &&
        session.ticketId === context.ticketId &&
        session.storageKey === input.storageKey &&
        session.storageBucket === input.storageBucket

      if (!isSessionOwnerMatch) {
        throw new SupportTicketAttachmentUploadMismatchError(
          "Attachment upload session does not match registration scope."
        )
      }

      try {
        await attachmentStorage.verifyUploadedObject({
          attachmentId: input.id,
          checksumSha256: validated.checksumSha256,
          mimeType: validated.mimeType,
          organizationId: context.organizationId,
          sizeBytes: validated.sizeBytes,
          storageKey: input.storageKey,
          target: input.target,
          ticketId: context.ticketId,
          uploaderWorkosUserId: input.actor.workosUserId,
        })
      } catch (error) {
        if (error instanceof SupportTicketAttachmentUploadNotFoundError) {
          throw new SupportTicketAttachmentUploadExpiredError()
        }

        if (
          error instanceof SupportTicketAttachmentUploadValidationError ||
          error instanceof SupportTicketAttachmentValidationError
        ) {
          throw error
        }

        throw new SupportTicketAttachmentUploadMismatchError(
          error instanceof Error
            ? error.message
            : "Uploaded attachment validation failed."
        )
      }

      await repository.markUploadSessionRegistered({
        id: input.id,
        checksumSha256: validated.checksumSha256,
        fileName: validated.fileName,
        mimeType: validated.mimeType,
        organizationId: context.organizationId,
        sizeBytes: validated.sizeBytes,
        storageBucket: input.storageBucket,
        storageKey: input.storageKey,
        target: input.target,
        ticketId: context.ticketId,
        uploaderWorkosUserId: input.actor.workosUserId,
      })

      return {
        id: input.id,
        fileName: validated.fileName,
        mimeType: validated.mimeType,
        sizeBytes: validated.sizeBytes,
        storageKey: input.storageKey,
        checksumSha256: validated.checksumSha256 ?? null,
        uploadedAt: new Date().toISOString(),
      }
    },
  }
}

export const supportTicketAttachmentService =
  createSupportTicketAttachmentService()
