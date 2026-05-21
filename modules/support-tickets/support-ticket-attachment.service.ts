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
  appendTicketAttachment: (input: {
    attachment: SupportTicketAttachmentMetadata
    ticketId: string
  }) => Promise<SupportTicketAttachmentMetadata[]>
  getTicketById: (ticketId: string) => Promise<SupportTicket | null>
}

type CreatePresignedAttachmentUploadInput = {
  actor: SupportTicketAttachmentActorContext
  checksumSha256?: string | null
  fileName: string
  mimeType: string
  sizeBytes: number
  ticketId: string
}

type RegisterSupportTicketAttachmentInput = {
  actor: SupportTicketAttachmentActorContext
  checksumSha256?: string | null
  fileName: string
  id: string
  mimeType: string
  sizeBytes: number
  storageKey: string
  ticketId: string
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
      async appendTicketAttachment(input) {
        const repository = await loadRepository()

        if (!repository.appendTicketAttachment) {
          throw new Error(
            "Support ticket attachment persistence is unavailable."
          )
        }

        return repository.appendTicketAttachment(input)
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

const ensureTicketAccess = async (
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
      const ticket = await ensureTicketAccess(
        repository,
        input.actor,
        input.ticketId,
        "upload attachments to"
      )
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
        organizationId: ticket.organizationId,
        sizeBytes: validated.sizeBytes,
        ticketId: ticket.id,
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
      const ticket = await ensureTicketAccess(
        repository,
        input.actor,
        input.ticketId,
        "register attachments on"
      )
      const validated = validateSupportTicketAttachmentUploadInput({
        checksumSha256: input.checksumSha256,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      })
      const attachmentStorage = resolveStorage()
      const expectedPrefix = attachmentStorage.getExpectedStorageKeyPrefix({
        organizationId: ticket.organizationId,
        ticketId: ticket.id,
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

      try {
        await attachmentStorage.verifyUploadedObject({
          attachmentId: input.id,
          checksumSha256: validated.checksumSha256,
          mimeType: validated.mimeType,
          organizationId: ticket.organizationId,
          sizeBytes: validated.sizeBytes,
          storageKey: input.storageKey,
          ticketId: ticket.id,
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

      const attachment: SupportTicketAttachmentMetadata = {
        id: input.id,
        fileName: validated.fileName,
        mimeType: validated.mimeType,
        sizeBytes: validated.sizeBytes,
        storageKey: input.storageKey,
        checksumSha256: validated.checksumSha256 ?? null,
        uploadedAt: new Date().toISOString(),
      }

      await repository.appendTicketAttachment({
        ticketId: ticket.id,
        attachment,
      })

      return attachment
    },
  }
}

export const supportTicketAttachmentService =
  createSupportTicketAttachmentService()
