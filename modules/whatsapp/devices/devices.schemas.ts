/**
 * WhatsApp Devices — Schemas & Types
 * Shared Zod schemas and TypeScript types. No Prisma dependency — safe to
 * import in route-layer tests without triggering a Prisma client resolution.
 */

import { z } from "zod"

// ─── Constants ──────────────────────────────────────────────────────────────────

export const DEFAULT_QUOTA_BASE = 1000

// ─── Enums ────────────────────────────────────────────────────────────────────

export const deviceStatusEnum = z.enum(["ACTIVE", "NON_ACTIVE", "DISCONNECTED", "UNKNOWN"])
export type DeviceStatus = z.infer<typeof deviceStatusEnum>

export const deviceEnvironmentEnum = z.enum(["SANDBOX", "LIVE"])
export type DeviceEnvironment = z.infer<typeof deviceEnvironmentEnum>

// ─── Input schemas ────────────────────────────────────────────────────────────

// E.164 international phone format: +[country code][number], 1-15 digits total
const e164PhoneRegex = /^\+[1-9]\d{1,14}$/

export const createDeviceSchema = z.object({
  // NOTE: `name` is accepted by the schema for API compatibility but is NOT
  // persisted to the DB — no `name` column exists on `WhatsappDevice`.
  name: z.string().trim().min(1, "Name is required").max(100),
  phoneNumber: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .regex(
      e164PhoneRegex,
      "Phone number must be in E.164 format (e.g. +6281234567890)"
    ),
  environment: deviceEnvironmentEnum.optional().default("LIVE"),
  displayName: z.string().trim().max(120).optional(),
  whatsappBusinessAccountId: z.string().trim().max(64).optional(),
  whatsappPhoneId: z.string().trim().max(64).optional(),
  whatsappApplicationId: z.string().trim().max(64).optional(),
  callbackUrl: z.string().url().optional().or(z.literal("")),
})
export type CreateDeviceInput = z.infer<typeof createDeviceSchema>

export const adminCreateDeviceSchema = createDeviceSchema.extend({
  organizationId: z.string().trim().min(1, "Organization ID is required"),
  expiredAt: z.string().datetime().optional(),
  features: z.record(z.string(), z.unknown()).optional(),
  quotaBase: z.number().nonnegative().optional(),
  quotaBaseIn: z.number().int().nonnegative().optional(),
  quotaBaseOut: z.number().int().nonnegative().optional(),
  rates: z.string().trim().max(200).optional(),
  s3: z.string().trim().max(500).optional(),
  whatsappVersion: z.string().trim().max(20).optional(),
  token: z.string().trim().min(1).optional(),
  dailyLimitMessage: z.number().int().nonnegative().optional(),
  balance: z.number().nonnegative().optional(),
  whatsappProfile: z.record(z.string(), z.unknown()).optional(),
})
export type AdminCreateDeviceInput = z.infer<typeof adminCreateDeviceSchema>

export const updateDeviceSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(
      e164PhoneRegex,
      "Phone number must be in E.164 format (e.g. +6281234567890)"
    )
    .optional(),
  environment: deviceEnvironmentEnum.optional(),
  status: deviceStatusEnum.optional(),
  token: z.string().trim().min(1).optional(),
  whatsappBusinessAccountId: z.string().trim().max(64).optional(),
  whatsappPhoneId: z.string().trim().max(64).optional(),
  whatsappApplicationId: z.string().trim().max(64).optional(),
  whatsappVersion: z.string().trim().max(20).optional(),
  displayName: z.string().trim().max(120).optional(),
  quotaBase: z.number().nonnegative().optional(),
  quotaBaseIn: z.number().int().nonnegative().optional(),
  quotaBaseOut: z.number().int().nonnegative().optional(),
  dailyLimitMessage: z.number().int().nonnegative().optional(),
  balance: z.number().nonnegative().optional(),
  expiredAt: z.string().datetime().optional(),
  rates: z.string().trim().max(200).optional(),
  s3: z.string().trim().max(500).optional(),
  features: z.record(z.string(), z.unknown()).optional(),
  whatsappProfile: z.record(z.string(), z.unknown()).optional(),
  callbackUrl: z.string().url().optional().or(z.literal("")),
})
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>

// ─── Response types ────────────────────────────────────────────────────────────

export type DeviceListItem = {
  id: string
  organizationId: string
  phoneNumber: string
  name: string
  status: DeviceStatus
  environment: DeviceEnvironment
  balance: number
  quotaBase: number
  quotaBaseOut: number
  dailyLimitMessage: number
  whatsappBusinessAccountId: string | null
  whatsappPhoneId: string | null
  createdAt: string
  updatedAt: string
  lastHeartbeatAt?: string | null
  lastDisconnectedAt?: string | null
}

export type DeviceDetail = DeviceListItem & {
  businessId: string | null
  callbackUrl: string | null
  expiredAt: string | null
  whatsappProfile: Record<string, unknown> | null
  features: Record<string, unknown> | null
}

export const topUpInputSchema = z.object({
  amount: z
    .number()
    .int()
    .min(1, "Amount must be at least 1")
    .max(1_000_000_000),
  reason: z.string().trim().min(1, "Reason is required").max(500),
})
export type TopUpInput = z.infer<typeof topUpInputSchema>

// ─── Domain errors ────────────────────────────────────────────────────────────

export class DeviceNotFoundError extends Error {
  readonly code = "DEVICE_NOT_FOUND" as const
  constructor(id: string) {
    super(`Device '${id}' not found.`)
    this.name = "DeviceNotFoundError"
  }
}

export class DeviceNotOwnedError extends Error {
  readonly code = "DEVICE_NOT_OWNED" as const
  constructor() {
    super("You do not have access to this device.")
    this.name = "DeviceNotOwnedError"
  }
}

// ─── Service interface ───────────────────────────────────────────────────────

export type DeviceCreateInput = CreateDeviceInput & {
  organizationId: string | null
  expiredAt?: string
  features?: Record<string, unknown>
  whatsappProfile?: Record<string, unknown>
  quotaBase?: number
  quotaBaseIn?: number
  quotaBaseOut?: number
  rates?: string
  s3?: string
  whatsappVersion?: string
  token?: string
  dailyLimitMessage?: number
  balance?: number
}

export type DeviceService = {
  listByOrganization: (
    organizationId: string | null
  ) => Promise<DeviceListItem[]>
  findById: (id: string, organizationId: string | null) => Promise<DeviceDetail>
  create: (input: DeviceCreateInput) => Promise<DeviceDetail>
  update: (
    id: string,
    input: UpdateDeviceInput,
    organizationId: string | null
  ) => Promise<DeviceDetail>
  delete: (id: string) => Promise<void>
  verify: (id: string, organizationId: string | null) => Promise<DeviceDetail>
  reconnect: (
    id: string,
    organizationId: string | null
  ) => Promise<DeviceDetail>
  updateLastHeartbeat: (deviceId: string) => Promise<void>
  markDisconnected: (deviceId: string) => Promise<void>
  markActive: (deviceId: string) => Promise<void>
}
