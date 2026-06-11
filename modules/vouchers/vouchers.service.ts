import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"

import { generateUniqueVoucherCode } from "./voucher-code"
import {
  VoucherNotFoundError,
  VoucherExpiredError,
  VoucherDepletedError,
  VoucherDisabledError,
  VoucherTargetUserMismatchError,
  VoucherTargetOrgMismatchError,
} from "./vouchers.errors"

type CreateVoucherData = {
  prefix?: string
  maxClaims: number
  expiresAt: string
  amount: number
  currency?: string
  targetWorkosUserId?: string
  targetOrganizationId?: string
  metadataJson?: Record<string, unknown>
  createdByWorkosUserId: string
}

type UpdateVoucherData = {
  maxClaims?: number
  expiresAt?: string
  amount?: number
  currency?: string
  targetWorkosUserId?: string | null
  targetOrganizationId?: string | null
  metadataJson?: Record<string, unknown> | null
}

type ListVouchersParams = {
  status?: string
  prefix?: string
  limit?: number
  offset?: number
}

type RedeemParams = {
  code: string
  workosUserId: string
  organizationId: string
}

const MAX_BALANCE = new Prisma.Decimal("999999999.99")

export class VoucherService {
  constructor(private prisma: PrismaClient) {}

  // ─── Portal: list vouchers ──────────────────────────────────────────────────

  async listVouchers(params: ListVouchersParams = {}) {
    const where: Prisma.VoucherWhereInput = {}

    if (params.status) {
      where.status = params.status as Prisma.EnumVoucherStatusFilter["equals"]
    }
    if (params.prefix) {
      where.prefix = params.prefix
    }

    const [vouchers, total] = await Promise.all([
      this.prisma.voucher.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: params.limit ?? 20,
        skip: params.offset ?? 0,
      }),
      this.prisma.voucher.count({ where }),
    ])

    return { vouchers, total }
  }

  // ─── Portal: get voucher by id ──────────────────────────────────────────────

  async getVoucherById(id: string) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id },
      include: {
        claims: {
          orderBy: { claimedAt: "desc" },
        },
      },
    })

    if (!voucher) {
      throw new VoucherNotFoundError(id)
    }

    return voucher
  }

  // ─── Portal: create voucher ─────────────────────────────────────────────────

  async createVoucher(data: CreateVoucherData) {
    const code = await generateUniqueVoucherCode(
      async (candidate) => {
        try {
          await this.prisma.voucher.create({
            data: {
              code: candidate,
              prefix: data.prefix ?? null,
              maxClaims: data.maxClaims,
              expiresAt: new Date(data.expiresAt),
              amount: new Prisma.Decimal(data.amount),
              currency: data.currency ?? "IDR",
              targetWorkosUserId: data.targetWorkosUserId ?? null,
              targetOrganizationId: data.targetOrganizationId ?? null,
              metadataJson: data.metadataJson !== undefined
                ? (data.metadataJson as Prisma.InputJsonValue)
                : Prisma.JsonNull,
              createdByWorkosUserId: data.createdByWorkosUserId,
            },
          })
          return true
        } catch (err) {
          // P2002 = unique constraint violation (code collision)
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002"
          ) {
            return false
          }
          throw err
        }
      },
      data.prefix,
    )

    const created = await this.prisma.voucher.findUniqueOrThrow({
      where: { code },
    })

    return created
  }

  // ─── Portal: update voucher ─────────────────────────────────────────────────

  async updateVoucher(id: string, data: UpdateVoucherData) {
    const existing = await this.prisma.voucher.findUnique({ where: { id } })
    if (!existing) {
      throw new VoucherNotFoundError(id)
    }

    if (data.maxClaims !== undefined && data.maxClaims < existing.claimedCount) {
      throw new Error(
        `Cannot reduce maxClaims below current claimedCount (${existing.claimedCount})`,
      )
    }

    const updateData: Prisma.VoucherUpdateInput = {}

    if (data.maxClaims !== undefined) updateData.maxClaims = data.maxClaims
    if (data.expiresAt !== undefined) updateData.expiresAt = new Date(data.expiresAt)
    if (data.amount !== undefined) updateData.amount = new Prisma.Decimal(data.amount)
    if (data.currency !== undefined) updateData.currency = data.currency
    if (data.targetWorkosUserId !== undefined) {
      updateData.targetWorkosUserId = data.targetWorkosUserId
    }
    if (data.targetOrganizationId !== undefined) {
      updateData.targetOrganizationId = data.targetOrganizationId
    }
    if (data.metadataJson !== undefined) {
      if (data.metadataJson === null) {
        updateData.metadataJson = Prisma.JsonNull
      } else {
        updateData.metadataJson = data.metadataJson as Prisma.InputJsonValue
      }
    }

    return this.prisma.voucher.update({
      where: { id },
      data: updateData,
    })
  }

  // ─── Portal: disable voucher ────────────────────────────────────────────────

  async disableVoucher(id: string) {
    const existing = await this.prisma.voucher.findUnique({ where: { id } })
    if (!existing) {
      throw new VoucherNotFoundError(id)
    }

    if (existing.status === "DISABLED") {
      return existing
    }

    return this.prisma.voucher.update({
      where: { id },
      data: { status: "DISABLED" },
    })
  }

  // ─── Portal: get voucher claims ─────────────────────────────────────────────

  async getVoucherClaims(voucherId: string) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id: voucherId },
    })
    if (!voucher) {
      throw new VoucherNotFoundError(voucherId)
    }

    return this.prisma.voucherClaim.findMany({
      where: { voucherId },
      orderBy: { claimedAt: "desc" },
    })
  }

  // ─── Console: redeem voucher ────────────────────────────────────────────────

  async redeemVoucher(params: RedeemParams) {
    const { code, workosUserId, organizationId } = params

    return this.prisma.$transaction(async (tx) => {
      // 1. Look up voucher by code
      const voucher = await tx.voucher.findUnique({ where: { code } })

      if (!voucher) {
        throw new VoucherNotFoundError(code)
      }

      // 2. Validate voucher state
      if (voucher.status === "DISABLED") {
        throw new VoucherDisabledError(code)
      }

      if (voucher.expiresAt <= new Date()) {
        throw new VoucherExpiredError(code)
      }

      if (voucher.status === "DEPLETED" || voucher.claimedCount >= voucher.maxClaims) {
        throw new VoucherDepletedError(code)
      }

      // 3. Validate targeting
      if (voucher.targetWorkosUserId && voucher.targetWorkosUserId !== workosUserId) {
        throw new VoucherTargetUserMismatchError(code)
      }

      if (
        voucher.targetOrganizationId &&
        voucher.targetOrganizationId !== organizationId
      ) {
        throw new VoucherTargetOrgMismatchError(code)
      }

      // 4. Guarded update: atomically increment claimedCount only if under maxClaims
      const guardedUpdate = await tx.voucher.updateMany({
        where: {
          id: voucher.id,
          claimedCount: { lt: voucher.maxClaims },
          status: "ACTIVE",
          expiresAt: { gt: new Date() },
        },
        data: {
          claimedCount: { increment: 1 },
        },
      })

      if (guardedUpdate.count === 0) {
        throw new VoucherDepletedError(code)
      }

      // 5. Create claim record
      const claim = await tx.voucherClaim.create({
        data: {
          voucherId: voucher.id,
          workosUserId,
          organizationId,
        },
      })

      // 6. If claimedCount has reached maxClaims, set status to DEPLETED
      const updatedVoucher = await tx.voucher.findUniqueOrThrow({
        where: { id: voucher.id },
      })

      if (updatedVoucher.claimedCount >= updatedVoucher.maxClaims) {
        await tx.voucher.update({
          where: { id: voucher.id },
          data: { status: "DEPLETED" },
        })
      }

      // 7. Apply billing credit — find or create billing account, then create adjustment
      let billingAccount = await tx.billingAccount.findUnique({
        where: { organizationId },
      })

      if (!billingAccount) {
        billingAccount = await tx.billingAccount.create({
          data: {
            organizationId,
            balance: new Prisma.Decimal(0),
            currency: voucher.currency,
            timezone: "UTC",
            status: "ACTIVE",
          },
        })
      }

      if (billingAccount.currency !== voucher.currency) {
        throw new Error("BILLING_CURRENCY_MISMATCH")
      }

      const balanceBefore = billingAccount.balance
      const balanceAfter = balanceBefore.plus(voucher.amount)

      if (balanceAfter.gt(MAX_BALANCE)) {
        throw new Error("BALANCE_LIMIT_EXCEEDED")
      }

      await tx.billingAccount.update({
        where: { id: billingAccount.id },
        data: { balance: balanceAfter },
      })

      const adjustment = await tx.billingAdjustment.create({
        data: {
          billingAccountId: billingAccount.id,
          adjustmentType: "CREDIT",
          amount: voucher.amount,
          currency: voucher.currency,
          reason: `Voucher redemption: ${voucher.code}`,
          appliedAt: new Date(),
          metadataJson: {
            source: "ADJUSTMENT",
            voucherId: voucher.id,
            voucherCode: voucher.code,
            voucherClaimId: claim.id,
            balanceBefore: balanceBefore.toString(),
            balanceAfter: balanceAfter.toString(),
          },
        },
      })

      // Link the adjustment to the claim
      await tx.voucherClaim.update({
        where: { id: claim.id },
        data: { billingAdjustmentId: adjustment.id },
      })

      return {
        claimId: claim.id,
        voucherCode: voucher.code,
        amount: voucher.amount.toString(),
        currency: voucher.currency,
        adjustmentId: adjustment.id,
      }
    })
  }

  // ─── Console: get user claim history ────────────────────────────────────────

  async getUserClaims(workosUserId: string, organizationId: string) {
    return this.prisma.voucherClaim.findMany({
      where: { workosUserId, organizationId },
      orderBy: { claimedAt: "desc" },
      include: {
        voucher: {
          select: {
            code: true,
            amount: true,
            currency: true,
          },
        },
      },
    })
  }
}
