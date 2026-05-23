import { describe, expect, it } from "bun:test"

import {
  S3_ATTACHMENT_MAX_SIZE_BYTES,
  SupportTicketAttachmentValidationError,
  validateSupportTicketAttachmentUploadInput,
} from "@/modules/support-tickets/support-ticket-attachment.validation"

describe("support ticket attachment validation", () => {
  it("allows supported extension, mime, and size", () => {
    const parsed = validateSupportTicketAttachmentUploadInput({
      fileName: "incident-log.txt",
      mimeType: "text/plain",
      sizeBytes: 1024,
    })

    expect(parsed.extension).toBe("txt")
    expect(parsed.mimeType).toBe("text/plain")
  })

  it("rejects unsupported extensions", () => {
    expect(() =>
      validateSupportTicketAttachmentUploadInput({
        fileName: "archive.exe",
        mimeType: "application/octet-stream",
        sizeBytes: 1024,
      })
    ).toThrow(SupportTicketAttachmentValidationError)

    expect(() =>
      validateSupportTicketAttachmentUploadInput({
        fileName: "archive.exe",
        mimeType: "application/octet-stream",
        sizeBytes: 1024,
      })
    ).toThrow("Attachment extension is not allowed.")
  })

  it("rejects files that exceed max size", () => {
    expect(() =>
      validateSupportTicketAttachmentUploadInput({
        fileName: "evidence.pdf",
        mimeType: "application/pdf",
        sizeBytes: S3_ATTACHMENT_MAX_SIZE_BYTES + 1,
      })
    ).toThrow(SupportTicketAttachmentValidationError)

    expect(() =>
      validateSupportTicketAttachmentUploadInput({
        fileName: "evidence.pdf",
        mimeType: "application/pdf",
        sizeBytes: S3_ATTACHMENT_MAX_SIZE_BYTES + 1,
      })
    ).toThrow("Attachment exceeds")
  })

  it("rejects extension and mime mismatch", () => {
    expect(() =>
      validateSupportTicketAttachmentUploadInput({
        fileName: "evidence.pdf",
        mimeType: "image/png",
        sizeBytes: 1024,
      })
    ).toThrow(SupportTicketAttachmentValidationError)

    expect(() =>
      validateSupportTicketAttachmentUploadInput({
        fileName: "evidence.pdf",
        mimeType: "image/png",
        sizeBytes: 1024,
      })
    ).toThrow("does not match")
  })
})
