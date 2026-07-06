import { z } from "zod"

// ─── Topup ────────────────────────────────────────────────────────────────────

export const topupSchema = z.object({
  amount: z.number().int().min(1).max(1_000_000),
  paymentMethod: z.enum(["manual_bank_transfer"]),
  referenceId: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Z0-9-_]+$/i)
    .optional(),
})

export type TopupInput = z.infer<typeof topupSchema>

// ─── Admin Adjust ──────────────────────────────────────────────────────────────

export const adminAdjustSchema = z.object({
  organizationId: z.string().uuid(),
  type: z.enum(["CREDIT", "DEBIT"]),
  amount: z.number().int().min(1),
  reason: z.string().min(1).max(500),
})

export type AdminAdjustInput = z.infer<typeof adminAdjustSchema>

// ─── Admin Subscription Update ────────────────────────────────────────────────

export const adminSubscriptionUpdateSchema = z.object({
  planId: z.string().uuid().optional(),
  pricingId: z.string().uuid().optional(),
  allocatedConfig: z
    .object({
      cpu: z.number().int().min(100).optional(),
      mem: z.number().int().min(128).optional(),
      devices: z.number().int().min(1).optional(),
    })
    .optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "CANCELLED"]).optional(),
})

export type AdminSubscriptionUpdateInput = z.infer<
  typeof adminSubscriptionUpdateSchema
>

// ─── Admin Subscription Create ──────────────────────────────────────────────

export const adminSubscriptionCreateSchema = z.object({
  organizationId: z.string().min(1),
  packageId: z.string().min(1),
  planId: z.string().min(1),
  pricingId: z.string().min(1),
  type: z.enum(["PAYG", "BUNDLE", "CUSTOM"]),
  billingMode: z.enum(["PACKAGE", "PAYG", "CUSTOM"]),
  currentPeriodStart: z.coerce.date(),
  currentPeriodEnd: z.coerce.date(),
  allocatedConfig: z
    .object({
      cpu: z.number().int().min(100).optional(),
      mem: z.number().int().min(128).optional(),
      devices: z.number().int().min(1).optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type AdminSubscriptionCreateInput = z.infer<
  typeof adminSubscriptionCreateSchema
>
