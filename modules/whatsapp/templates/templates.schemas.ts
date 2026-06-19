/**
 * WhatsApp Templates — Schemas & Types
 * Shared Zod schemas and TypeScript types for template create/update forms.
 * WhatsApp template structural rules aligned with Meta's Cloud API:
 * - Categories: AUTHENTICATION, UTILITY, MARKETING
 * - Header types: TEXT, IMAGE, VIDEO, DOCUMENT
 * - Body with {{1}} placeholder support (max 25)
 * - Button types: OTP copy_code, quick_reply, URL
 * - Language variants for localized templates
 */

import { z } from "zod"

// ─── Enums ────────────────────────────────────────────────────────────────────

export const categoryEnum = z.enum(["AUTHENTICATION", "UTILITY", "MARKETING"])
export type Category = z.infer<typeof categoryEnum>

export const headerTypeEnum = z.enum(["TEXT", "IMAGE", "VIDEO", "DOCUMENT"])
export type HeaderType = z.infer<typeof headerTypeEnum>

export const buttonTypeEnum = z.enum(["QUICK_REPLY", "URL", "OTP"])
export type ButtonType = z.infer<typeof buttonTypeEnum>

// ─── Button schemas ──────────────────────────────────────────────────────────

const quickReplyButtonSchema = z.object({
  type: z.literal("QUICK_REPLY"),
  text: z.string().trim().min(1).max(20),
})

const urlButtonSchema = z.object({
  type: z.literal("URL"),
  text: z.string().trim().min(1).max(25), // Meta allows 25 chars for URL CTA buttons
  url: z.string().url(),
})

const otpButtonSchema = z.object({
  type: z.literal("OTP"),
  otpType: z.literal("COPY_CODE"),
  authConfig: z
    .object({
      expirationMinutes: z.number().int().min(1).max(60).optional(),
      codeLength: z.number().int().min(4).max(10).optional(),
    })
    .optional(),
})

export const buttonSchema = z.discriminatedUnion("type", [
  quickReplyButtonSchema,
  urlButtonSchema,
  otpButtonSchema,
])
export type Button = z.infer<typeof buttonSchema>

// ─── Input schemas ───────────────────────────────────────────────────────────

export const templateLanguageSchema = z.object({
  lang: z.string().trim().min(2, "Language code is required"),
  headerType: headerTypeEnum.optional(),
  headerUrl: z.string().url().optional(),
  headerText: z.string().trim().max(60).optional(),
  body: z.string().trim().min(1, "Body is required").max(1024),
  parameters: z
    .array(
      z.object({
        type: z.enum(["BODY", "HEADER", "FOOTER", "MEDIA"]),
        text: z.string().trim().min(1),
      })
    )
    .optional(),
  footer: z.string().trim().max(60).optional(),
  buttons: z.array(buttonSchema).optional(),
})
export type TemplateLanguageInput = z.infer<typeof templateLanguageSchema>

export const templateBodySchema = z.object({
  slug: z.string().trim().min(1, "Slug is required").max(100),
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(500).optional(),
  whatsappDeviceId: z.string().trim().min(1).optional(),
  languages: z
    .array(templateLanguageSchema)
    .min(1, "At least one language variant is required"),
})
export type TemplateBodyInput = z.infer<typeof templateBodySchema>

export const templateUpdateSchema = z.object({
  slug: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  whatsappDeviceId: z.string().trim().min(1).optional(),
})
export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>

// ─── Response types ───────────────────────────────────────────────────────────

export type TemplateListItem = {
  id: string
  organizationId: string
  slug: string
  name: string
  description: string | null
  syncStatus: string
  metaStatus: string | null
  lastSyncedAt: string | null
  whatsappDeviceId: string | null
  createdAt: string
  updatedAt: string
  languages: TemplateLanguageListItem[]
}

export type TemplateLanguageListItem = {
  id: string
  templateId: string
  lang: string
  headerType: string | null
  headerUrl: string | null
  headerText: string | null
  body: string | null
  parameters: unknown | null
  footer: string | null
  buttons: unknown | null
  authConfig: unknown | null
  isApproved: boolean
  metaStatus: string | null
  rejectReason: string | null
}

export type TemplateDetail = TemplateListItem

// ─── Domain errors ────────────────────────────────────────────────────────────

export class TemplateNotFoundError extends Error {
  readonly code = "TEMPLATE_NOT_FOUND" as const
  constructor(id: string) {
    super(`Template '${id}' not found.`)
    this.name = "TemplateNotFoundError"
  }
}

export class TemplateNotOwnedError extends Error {
  readonly code = "TEMPLATE_NOT_OWNED" as const
  constructor() {
    super("You do not have access to this template.")
    this.name = "TemplateNotOwnedError"
  }
}

// ─── Service interface ───────────────────────────────────────────────────────

export type TemplateService = {
  listByOrganization: (
    organizationId: string | null
  ) => Promise<TemplateListItem[]>
  findById: (
    id: string,
    organizationId: string | null
  ) => Promise<TemplateDetail>
  create: (
    input: TemplateBodyInput & { organizationId: string | null }
  ) => Promise<TemplateDetail>
  update: (
    id: string,
    input: TemplateUpdateInput,
    organizationId: string | null
  ) => Promise<TemplateDetail>
  delete: (id: string) => Promise<void>
}
