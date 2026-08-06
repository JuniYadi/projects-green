import type { Prisma } from "@prisma/client"

// ─── Voucher DTO ──────────────────────────────────────────────────────────────

export type VoucherDTO = {
  id: string
  code: string
  prefix: string | null
  status: string
  kind: string
  maxClaims: number
  claimedCount: number
  expiresAt: string
  amount: string
  currency: string
  // Promotion fields (always present; null when not set)
  discountType: string | null
  discountValue: string | null
  discountCurrency: string | null
  currencyPolicy: string
  firstCheckoutOnly: boolean
  allowUpgrade: boolean
  stackable: boolean
  minimumOrderAmount: string | null
  maximumDiscountAmount: string | null
  allowedPackageCodes: string[] | null
  allowedPlanCodes: string[] | null
  allowedBillingPeriods: string[] | null
  targetWorkosUserId: string | null
  targetOrganizationId: string | null
  metadataJson: Prisma.JsonValue | null
  createdByWorkosUserId: string
  createdAt: string
  updatedAt: string
  targetUserName?: string | null
  targetOrgName?: string | null
}

export type VoucherDetailDTO = VoucherDTO & {
  claims: VoucherClaimDTO[]
}

export type VoucherClaimDTO = {
  id: string
  voucherId: string
  workosUserId: string
  organizationId: string
  orderId: string | null
  billingAdjustmentId: string | null
  discountAmount: string | null
  discountCurrency: string | null
  exchangeRate: string | null
  rateAt: string | null
  quoteExpiresAt: string | null
  claimedAt: string
  userName?: string | null
  orgName?: string | null
}

export type RedeemResultDTO = {
  claimId: string
  voucherCode: string
  amount: string
  currency: string
  adjustmentId: string | null
}

type VoucherRecord = Prisma.VoucherGetPayload<{
  include: { claims: true }
}>

type VoucherRecordBase = Prisma.VoucherGetPayload<object>

type VoucherClaimRecord = Prisma.VoucherClaimGetPayload<object>

const decimalString = (value: Prisma.Decimal | null | undefined) =>
  value === null || value === undefined ? null : value.toString()

const jsonArrayToStringArray = (
  value: Prisma.JsonValue | null | undefined
): string[] | null => {
  if (value === null || value === undefined) return null
  if (!Array.isArray(value)) return null
  return value.filter((item): item is string => typeof item === "string")
}

export function toVoucherDTO(voucher: VoucherRecordBase): VoucherDTO {
  return {
    id: voucher.id,
    code: voucher.code,
    prefix: voucher.prefix,
    status: voucher.status,
    kind: voucher.kind,
    maxClaims: voucher.maxClaims,
    claimedCount: voucher.claimedCount,
    expiresAt: voucher.expiresAt.toISOString(),
    amount: voucher.amount.toFixed(2),
    currency: voucher.currency,
    discountType: voucher.discountType,
    discountValue: decimalString(voucher.discountValue),
    discountCurrency: voucher.discountCurrency,
    currencyPolicy: voucher.currencyPolicy,
    firstCheckoutOnly: voucher.firstCheckoutOnly,
    allowUpgrade: voucher.allowUpgrade,
    stackable: voucher.stackable,
    minimumOrderAmount: decimalString(voucher.minimumOrderAmount),
    maximumDiscountAmount: decimalString(voucher.maximumDiscountAmount),
    allowedPackageCodes: jsonArrayToStringArray(voucher.allowedPackageCodes),
    allowedPlanCodes: jsonArrayToStringArray(voucher.allowedPlanCodes),
    allowedBillingPeriods: jsonArrayToStringArray(
      voucher.allowedBillingPeriods
    ),
    targetWorkosUserId: voucher.targetWorkosUserId,
    targetOrganizationId: voucher.targetOrganizationId,
    metadataJson: voucher.metadataJson,
    createdByWorkosUserId: voucher.createdByWorkosUserId,
    createdAt: voucher.createdAt.toISOString(),
    updatedAt: voucher.updatedAt.toISOString(),
  }
}

export function toVoucherDetailDTO(
  voucher: VoucherRecord,
  enrichments?: {
    targetUserName?: string | null
    targetOrgName?: string | null
    claimNames?: Map<
      string,
      { userName?: string | null; orgName?: string | null }
    >
  }
): VoucherDetailDTO {
  return {
    ...toVoucherDTO(voucher),
    targetUserName: enrichments?.targetUserName ?? null,
    targetOrgName: enrichments?.targetOrgName ?? null,
    claims: voucher.claims.map((claim) =>
      toVoucherClaimDTO(claim, enrichments?.claimNames?.get(claim.id))
    ),
  }
}

export function toVoucherClaimDTO(
  claim: VoucherClaimRecord,
  names?: { userName?: string | null; orgName?: string | null }
): VoucherClaimDTO {
  return {
    id: claim.id,
    voucherId: claim.voucherId,
    workosUserId: claim.workosUserId,
    organizationId: claim.organizationId,
    orderId: claim.orderId,
    billingAdjustmentId: claim.billingAdjustmentId,
    discountAmount: decimalString(claim.discountAmount),
    discountCurrency: claim.discountCurrency,
    exchangeRate: decimalString(claim.exchangeRate),
    rateAt: claim.rateAt ? claim.rateAt.toISOString() : null,
    quoteExpiresAt: claim.quoteExpiresAt
      ? claim.quoteExpiresAt.toISOString()
      : null,
    claimedAt: claim.claimedAt.toISOString(),
    userName: names?.userName ?? null,
    orgName: names?.orgName ?? null,
  }
}
