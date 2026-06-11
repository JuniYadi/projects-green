import { z } from "zod"

// ─── Validation helpers ──────────────────────────────────────────────────────

const futureDate = z.string().datetime().refine(
  (val) => new Date(val) > new Date(),
  { message: "expiresAt must be a future date" },
)

const positiveAmount = z.number().positive("amount must be positive")

const uppercasePrefix = z
  .string()
  .regex(/^[A-Z]+$/, "Prefix must contain only uppercase letters A-Z")
  .optional()

// ─── Create voucher ──────────────────────────────────────────────────────────

export const createVoucherSchema = z.object({
  prefix: uppercasePrefix,
  maxClaims: z.number().int().min(1, "maxClaims must be at least 1"),
  expiresAt: futureDate,
  amount: positiveAmount,
  currency: z.string().default("IDR"),
  targetWorkosUserId: z.string().optional(),
  targetOrganizationId: z.string().optional(),
  metadataJson: z.record(z.string(), z.unknown()).optional(),
})

export type CreateVoucherInput = z.infer<typeof createVoucherSchema>

// ─── Update voucher ──────────────────────────────────────────────────────────

export const updateVoucherSchema = z.object({
  maxClaims: z.number().int().min(1).optional(),
  expiresAt: futureDate.optional(),
  amount: positiveAmount.optional(),
  currency: z.string().optional(),
  targetWorkosUserId: z.string().nullable().optional(),
  targetOrganizationId: z.string().nullable().optional(),
  metadataJson: z.record(z.string(), z.unknown()).nullable().optional(),
})

export type UpdateVoucherInput = z.infer<typeof updateVoucherSchema>

// ─── Redeem voucher ──────────────────────────────────────────────────────────

export const redeemVoucherSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Voucher code is required")
    .transform((val) => val.toUpperCase()),
})

export type RedeemVoucherInput = z.infer<typeof redeemVoucherSchema>

// ─── List query params ───────────────────────────────────────────────────────

export const listVouchersQuerySchema = z.object({
  status: z.string().optional(),
  prefix: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export type ListVouchersQuery = z.infer<typeof listVouchersQuerySchema>

// ─── Params ──────────────────────────────────────────────────────────────────

export const voucherIdParamSchema = z.object({
  id: z.string().min(1),
})

export type VoucherIdParam = z.infer<typeof voucherIdParamSchema>
