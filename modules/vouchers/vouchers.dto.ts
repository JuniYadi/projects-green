import type { Prisma } from "@prisma/client"

// ─── Voucher DTO ──────────────────────────────────────────────────────────────

export type VoucherDTO = {
  id: string
  code: string
  prefix: string | null
  status: string
  maxClaims: number
  claimedCount: number
  expiresAt: string
  amount: string
  currency: string
  targetWorkosUserId: string | null
  targetOrganizationId: string | null
  createdByWorkosUserId: string
  createdAt: string
  updatedAt: string
}

export type VoucherDetailDTO = VoucherDTO & {
  claims: VoucherClaimDTO[]
}

export type VoucherClaimDTO = {
  id: string
  voucherId: string
  workosUserId: string
  organizationId: string
  billingAdjustmentId: string | null
  claimedAt: string
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

export function toVoucherDTO(voucher: VoucherRecordBase): VoucherDTO {
  return {
    id: voucher.id,
    code: voucher.code,
    prefix: voucher.prefix,
    status: voucher.status,
    maxClaims: voucher.maxClaims,
    claimedCount: voucher.claimedCount,
    expiresAt: voucher.expiresAt.toISOString(),
    amount: voucher.amount.toFixed(2),
    currency: voucher.currency,
    targetWorkosUserId: voucher.targetWorkosUserId,
    targetOrganizationId: voucher.targetOrganizationId,
    createdByWorkosUserId: voucher.createdByWorkosUserId,
    createdAt: voucher.createdAt.toISOString(),
    updatedAt: voucher.updatedAt.toISOString(),
  }
}

export function toVoucherDetailDTO(voucher: VoucherRecord): VoucherDetailDTO {
  return {
    ...toVoucherDTO(voucher),
    claims: voucher.claims.map(toVoucherClaimDTO),
  }
}

export function toVoucherClaimDTO(claim: VoucherClaimRecord): VoucherClaimDTO {
  return {
    id: claim.id,
    voucherId: claim.voucherId,
    workosUserId: claim.workosUserId,
    organizationId: claim.organizationId,
    billingAdjustmentId: claim.billingAdjustmentId,
    claimedAt: claim.claimedAt.toISOString(),
  }
}
