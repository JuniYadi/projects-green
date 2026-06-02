/**
 * WhatsApp Devices — Schemas & Types
 * Shared Zod schemas and TypeScript types. No Prisma dependency — safe to
 * import in route-layer tests without triggering a Prisma client resolution.
 */

import { z } from "zod"

// ─── Enums ────────────────────────────────────────────────────────────────────

export const deviceStatusEnum = z.enum(["ACTIVE", "NON_ACTIVE"])
export type DeviceStatus = z.infer<typeof deviceStatusEnum>

export const deviceEnvironmentEnum = z.enum(["SANDBOX", "LIVE"])
export type DeviceEnvironment = z.infer<typeof deviceEnvironmentEnum>

// ─── Input schemas ────────────────────────────────────────────────────────────

export const createDeviceSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  phoneNumber: z.string().trim().min(1, "Phone number is required"),
  environment: deviceEnvironmentEnum.optional().default("LIVE"),
  displayName: z.string().trim().max(120).optional(),
  whatsappBusinessAccountId: z.string().trim().max(64).optional(),
  whatsappPhoneId: z.string().trim().max(64).optional(),
  whatsappApplicationId: z.string().trim().max(64).optional(),
  callbackUrl: z.string().url().optional().or(z.literal("")),
})
export type CreateDeviceInput = z.infer<typeof createDeviceSchema>

export const adminCreateDeviceSchema = createDeviceSchema.extend({
  organizationId: z
    .string()
    .trim()
    .min(1, "Organization ID is required"),
})
export type AdminCreateDeviceInput = z.infer<typeof adminCreateDeviceSchema>

export const updateDeviceSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  phoneNumber: z.string().trim().min(1).max(20).optional(),
  environment: deviceEnvironmentEnum.optional(),
  status: deviceStatusEnum.optional(),
  token: z.string().trim().min(1).optional(),
  quotaBase: z.number().nonnegative().optional(),
  dailyLimitMessage: z.number().int().nonnegative().optional(),
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
  dailyLimitMessage: number
  whatsappBusinessAccountId: string | null
  whatsappPhoneId: string | null
  createdAt: string
  updatedAt: string
}

export type DeviceDetail = DeviceListItem & {
  businessId: string | null
  callbackUrl: string | null
  expiredAt: string | null
  whatsappProfile: Record<string, unknown> | null
  features: Record<string, unknown> | null
}

export const topUpInputSchema = z.object({
  amount: z.number().int().min(1, "Amount must be at least 1").max(1_000_000_000),
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

export type DeviceService = {
  listByOrganization: (organizationId: string | null) => Promise<DeviceListItem[]>
  findById: (id: string, organizationId: string | null) => Promise<DeviceDetail>
  create: (input: CreateDeviceInput & { organizationId: string | null }) => Promise<DeviceDetail>
  update: (id: string, input: UpdateDeviceInput, organizationId: string | null) => Promise<DeviceDetail>
  delete: (id: string) => Promise<void>
  verify: (id: string, organizationId: string | null) => Promise<DeviceDetail>
  reconnect: (id: string, organizationId: string | null) => Promise<DeviceDetail>
}
