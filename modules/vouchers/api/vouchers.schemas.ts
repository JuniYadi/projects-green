import { z } from "zod"

// ─── Constants ──────────────────────────────────────────────────────────────────

export const voucherKinds = ["BALANCE_CREDIT", "PRODUCT_PROMOTION"] as const
export type VoucherKind = (typeof voucherKinds)[number]

export const discountTypes = ["PERCENTAGE", "FIXED"] as const
export type VoucherDiscountType = (typeof discountTypes)[number]

export const currencyPolicies = [
  "MATCH_CURRENCY_ONLY",
  "CONVERT_AT_CHECKOUT",
  "CONVERT_AT_REDEMPTION",
] as const
export type VoucherCurrencyPolicy = (typeof currencyPolicies)[number]

export const billingPeriods = [
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "ANNUAL",
  "YEARLY",
  "CUSTOM",
] as const
export type VoucherBillingPeriod = (typeof billingPeriods)[number]

// ─── Validation helpers ──────────────────────────────────────────────────────

const futureDate = z
  .string()
  .datetime()
  .refine((val) => new Date(val) > new Date(), {
    message: "expiresAt must be a future date",
  })

const positiveAmount = z.number().positive("amount must be positive")

const uppercasePrefix = z
  .string()
  .regex(/^[A-Z]+$/, "Prefix must contain only uppercase letters A-Z")
  .optional()

const nonNegativeDecimal = z.preprocess((val) => {
  if (typeof val === "string") {
    const parsed = parseFloat(val)
    return isNaN(parsed) ? val : parsed
  }
  return val
}, z.number().nonnegative("must be zero or positive"))

const optionalNonNegativeDecimal = nonNegativeDecimal.optional()

// ─── Create voucher (legacy balance-credit) ────────────────────────────────────

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

// ─── Update voucher (legacy balance-credit) ────────────────────────────────────

export const updateVoucherSchema = z.object({
  maxClaims: z.number().int().min(1).optional(),
  expiresAt: futureDate.optional(),
  amount: positiveAmount.optional(),
  currency: z.string().optional(),
  targetWorkosUserId: z.string().nullable().optional(),
  targetOrganizationId: z.string().nullable().optional(),
  metadataJson: z.record(z.string(), z.unknown()).nullable().optional(),
})

// ─── Redeem voucher ──────────────────────────────────────────────────────────

export const redeemVoucherSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Voucher code is required")
    .transform((val) => val.toUpperCase()),
})

export type RedeemVoucherInput = z.infer<typeof redeemVoucherSchema>

// ─── Create promotion voucher ──────────────────────────────────────────────────

export const createPromotionSchema = z
  .object({
    prefix: uppercasePrefix,
    maxClaims: z.number().int().min(1, "maxClaims must be at least 1"),
    expiresAt: futureDate,
    // kind is ALWAYS "PRODUCT_PROMOTION" on this schema — callers use
    // createPromotionSchema explicitly so we hard-code the intent.
    kind: z.literal("PRODUCT_PROMOTION"),
    discountType: z.enum(discountTypes, {
      error: "discountType must be PERCENTAGE or FIXED",
    }),
    discountValue: nonNegativeDecimal,
    discountCurrency: z.string().trim().min(1).max(8).optional(),
    currencyPolicy: z.enum(currencyPolicies, {
      error: "Invalid currencyPolicy",
    }),
    firstCheckoutOnly: z.boolean().default(false),
    allowUpgrade: z.boolean().default(false),
    stackable: z.boolean().default(false),
    minimumOrderAmount: optionalNonNegativeDecimal,
    maximumDiscountAmount: optionalNonNegativeDecimal,
    allowedPackageCodes: z
      .array(z.enum(["APP_HOSTING", "VPN", "WHATSAPP"]))
      .optional(),
    allowedPlanCodes: z.array(z.string().trim().min(1)).optional(),
    allowedBillingPeriods: z.array(z.enum(billingPeriods)).optional(),
    amount: positiveAmount.optional(),
    currency: z.string().default("IDR"),
    targetWorkosUserId: z.string().optional(),
    targetOrganizationId: z.string().optional(),
    metadataJson: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    // Percentage discounts are capped at 100
    if (value.discountType === "PERCENTAGE" && value.discountValue > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["discountValue"],
        message: "PERCENTAGE discountValue cannot exceed 100.",
      })
    }

    // FIXED discount requires a currency when currencyPolicy is MATCH_CURRENCY_ONLY
    if (
      value.discountType === "FIXED" &&
      !value.discountCurrency &&
      value.currencyPolicy === "MATCH_CURRENCY_ONLY"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["discountCurrency"],
        message:
          "discountCurrency is required for FIXED discount with MATCH_CURRENCY_ONLY.",
      })
    }

    // CONVERT_AT_CHECKOUT / CONVERT_AT_REDEMPTION with FIXED requires a discountCurrency
    if (
      value.discountType === "FIXED" &&
      (value.currencyPolicy === "CONVERT_AT_CHECKOUT" ||
        value.currencyPolicy === "CONVERT_AT_REDEMPTION") &&
      !value.discountCurrency
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["discountCurrency"],
        message:
          "discountCurrency is required for FIXED discount with conversion policies.",
      })
    }

    // maximumDiscountAmount only makes sense for PERCENTAGE
    if (
      value.discountType === "FIXED" &&
      value.maximumDiscountAmount !== undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["maximumDiscountAmount"],
        message: "maximumDiscountAmount applies only to PERCENTAGE discounts.",
      })
    }

    // minimumOrderAmount requires a currency
    if (value.minimumOrderAmount !== undefined && !value.discountCurrency) {
      ctx.addIssue({
        code: "custom",
        path: ["minimumOrderAmount"],
        message: "minimumOrderAmount requires discountCurrency to be set.",
      })
    }
  })

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>

// ─── Update promotion voucher ─────────────────────────────────────────────────

export const updatePromotionSchema = z
  .object({
    maxClaims: z.number().int().min(1).optional(),
    expiresAt: futureDate.optional(),
    kind: z.enum(voucherKinds).optional(),
    discountType: z.enum(discountTypes).optional(),
    discountValue: nonNegativeDecimal.optional(),
    discountCurrency: z.string().trim().min(1).max(8).nullable().optional(),
    currencyPolicy: z.enum(currencyPolicies).optional(),
    firstCheckoutOnly: z.boolean().optional(),
    allowUpgrade: z.boolean().optional(),
    stackable: z.boolean().optional(),
    minimumOrderAmount: optionalNonNegativeDecimal.nullable().optional(),
    maximumDiscountAmount: optionalNonNegativeDecimal.nullable().optional(),
    allowedPackageCodes: z
      .array(z.enum(["APP_HOSTING", "VPN", "WHATSAPP"]))
      .nullable()
      .optional(),
    allowedPlanCodes: z.array(z.string().trim().min(1)).nullable().optional(),
    allowedBillingPeriods: z
      .array(z.enum(billingPeriods))
      .nullable()
      .optional(),
    amount: positiveAmount.optional(),
    currency: z.string().trim().min(1).max(8).optional(),
    targetWorkosUserId: z.string().nullable().optional(),
    targetOrganizationId: z.string().nullable().optional(),
    metadataJson: z.record(z.string(), z.unknown()).nullable().optional(),
    status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  })
  .superRefine((value, ctx) => {
    // Cannot change kind after creation
    if (value.kind !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["kind"],
        message: "kind cannot be changed after creation.",
      })
    }

    // Percentage discounts are capped at 100
    if (
      value.discountType === "PERCENTAGE" &&
      value.discountValue !== undefined &&
      value.discountValue > 100
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["discountValue"],
        message: "PERCENTAGE discountValue cannot exceed 100.",
      })
    }

    // maximumDiscountAmount only makes sense for PERCENTAGE
    if (
      value.discountValue !== undefined &&
      value.discountType === "FIXED" &&
      value.maximumDiscountAmount !== undefined &&
      value.maximumDiscountAmount !== null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["maximumDiscountAmount"],
        message: "maximumDiscountAmount applies only to PERCENTAGE discounts.",
      })
    }

    // Cannot re-enable a DEPLETED or EXPIRED voucher by setting status
    if (value.status === "ACTIVE") {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message:
          "Cannot set status to ACTIVE via update. Use the publish/disable endpoints.",
      })
    }
  })

export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>

// ─── Publish voucher ───────────────────────────────────────────────────────────

export const publishVoucherSchema = z.object({
  status: z.literal("ACTIVE"),
})

export type PublishVoucherInput = z.infer<typeof publishVoucherSchema>

// ─── List query params (promotions) ────────────────────────────────────────────

export const listPromotionsQuerySchema = z
  .object({
    kind: z.enum(voucherKinds).optional(),
    status: z.string().optional(),
    prefix: z.string().optional(),
    discountType: z.enum(discountTypes).optional(),
    currencyPolicy: z.enum(currencyPolicies).optional(),
    allowedPackageCode: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    organizationId: z.string().optional(),
  })
  .strict()

export type ListPromotionsQuery = z.infer<typeof listPromotionsQuerySchema>

// ─── List query params (legacy) ───────────────────────────────────────────────

export const listVouchersQuerySchema = z.object({
  status: z.string().optional(),
  prefix: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  organizationId: z.string().optional(),
})

export type ListVouchersQuery = z.infer<typeof listVouchersQuerySchema>

// ─── Params ──────────────────────────────────────────────────────────────────

export const voucherIdParamSchema = z.object({
  id: z.string().min(1),
})

export type VoucherIdParam = z.infer<typeof voucherIdParamSchema>
