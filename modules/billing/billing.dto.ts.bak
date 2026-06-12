import { z } from "zod"
import { Prisma } from "@prisma/client"

// ─── Billing Contact ──────────────────────────────────────────────────────────

export type BillingContactDTO = Pick<
  Prisma.BillingContactGetPayload<object>,
  | "id"
  | "billingAccountId"
  | "email"
  | "name"
  | "role"
  | "notifyOnInvoice"
  | "notifyOnLowBalance"
  | "notifyOnSupport"
  | "isActive"
  | "createdAt"
  | "updatedAt"
>

export const toBillingContactDTO = (
  contact: Prisma.BillingContactGetPayload<object>,
): BillingContactDTO => ({
  id: contact.id,
  billingAccountId: contact.billingAccountId,
  email: contact.email,
  name: contact.name,
  role: contact.role,
  notifyOnInvoice: contact.notifyOnInvoice,
  notifyOnLowBalance: contact.notifyOnLowBalance,
  notifyOnSupport: contact.notifyOnSupport,
  isActive: contact.isActive,
  createdAt: contact.createdAt,
  updatedAt: contact.updatedAt,
})

export const createBillingContactSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().max(255).optional(),
  role: z.enum(["FINANCE", "ACCOUNTING", "GENERAL"]).default("GENERAL"),
  notifyOnInvoice: z.boolean().default(true),
  notifyOnLowBalance: z.boolean().default(true),
  notifyOnSupport: z.boolean().default(true),
})

export type CreateBillingContactInput = z.infer<typeof createBillingContactSchema>

export const updateBillingContactSchema = z.object({
  name: z.string().max(255).optional().nullable(),
  notifyOnInvoice: z.boolean().optional(),
  notifyOnLowBalance: z.boolean().optional(),
  notifyOnSupport: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export type UpdateBillingContactInput = z.infer<typeof updateBillingContactSchema>

// ─── Billing Account Preferences ──────────────────────────────────────────────

export type BillingAccountDTO = {
  id: string
  organizationId: string
  tenantId: string | null
  preferredCurrency: Prisma.BillingAccountGetPayload<object>["preferredCurrency"]
  timezone: string
  status: Prisma.BillingAccountGetPayload<object>["status"]
  balance: number
  createdAt: Date
  updatedAt: Date
  contacts: BillingContactDTO[]
  alertPreferences: AlertPreferences
}

export const toBillingAccountDTO = (
  account: Prisma.BillingAccountGetPayload<{ include: { contacts: true } }>,
): BillingAccountDTO => ({
  id: account.id,
  organizationId: account.organizationId,
  tenantId: account.tenantId,
  preferredCurrency: account.preferredCurrency,
  timezone: account.timezone,
  status: account.status,
  balance: account.balance.toNumber(),
  createdAt: account.createdAt,
  updatedAt: account.updatedAt,
  contacts: account.contacts.map(toBillingContactDTO),
  alertPreferences: parseAlertPreferences(account.metadataJson),
})

function parseAlertPreferences(metadataJson: unknown): AlertPreferences {
  if (!metadataJson || typeof metadataJson !== "object") {
    return { ...defaultAlertPreferences }
  }
  const meta = metadataJson as Record<string, unknown>
  const prefs = meta.alertPreferences as Record<string, unknown> | undefined
  if (!prefs) return { ...defaultAlertPreferences }
  return {
    balanceThresholdEnabled:
      typeof prefs.balanceThresholdEnabled === "boolean"
        ? prefs.balanceThresholdEnabled
        : defaultAlertPreferences.balanceThresholdEnabled,
    balanceThresholdAmount:
      typeof prefs.balanceThresholdAmount === "number"
        ? prefs.balanceThresholdAmount
        : defaultAlertPreferences.balanceThresholdAmount,
    usageThresholdEnabled:
      typeof prefs.usageThresholdEnabled === "boolean"
        ? prefs.usageThresholdEnabled
        : defaultAlertPreferences.usageThresholdEnabled,
    usageThresholdAmount:
      typeof prefs.usageThresholdAmount === "number"
        ? prefs.usageThresholdAmount
        : defaultAlertPreferences.usageThresholdAmount,
  }
}

// ─── Alert Preferences ─────────────────────────────────────────────────────────

export type AlertPreferences = {
  balanceThresholdEnabled: boolean
  balanceThresholdAmount: number
  usageThresholdEnabled: boolean
  usageThresholdAmount: number
}

export const defaultAlertPreferences: AlertPreferences = {
  balanceThresholdEnabled: false,
  balanceThresholdAmount: 50000,
  usageThresholdEnabled: false,
  usageThresholdAmount: 100000,
}

export const updateAlertPreferencesSchema = z.object({
  balanceThresholdEnabled: z.boolean().optional(),
  balanceThresholdAmount: z.number().int().min(0).optional(),
  usageThresholdEnabled: z.boolean().optional(),
  usageThresholdAmount: z.number().int().min(0).optional(),
})

export type UpdateAlertPreferencesInput = z.infer<typeof updateAlertPreferencesSchema>

// ─── Organization Currency ────────────────────────────────────────────────────

export const updateCurrencySchema = z.object({
  preferredCurrency: z.enum(["USD", "IDR"]),
})

export type UpdateCurrencyInput = z.infer<typeof updateCurrencySchema>
