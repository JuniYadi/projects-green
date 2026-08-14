import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"

import { generateUniqueVoucherCode } from "./voucher-code"
import {
  VoucherNotFoundError,
  VoucherExpiredError,
  VoucherDepletedError,
  VoucherDisabledError,
  VoucherAlreadyClaimedError,
  VoucherTargetUserMismatchError,
  VoucherTargetOrgMismatchError,
  BillingCurrencyMismatchError,
  VoucherNotPublishableError,
  VoucherAlreadyPublishedError,
  VoucherAlreadyDisabledError,
  VoucherNotAPromotionError,
  VoucherDiscountConfigurationError,
  VoucherKindFieldMismatchError,
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
  kind?: string
  status?: string
  prefix?: string
  limit?: number
  offset?: number
  organizationId?: string
}

type CreatePromotionData = {
  prefix?: string
  maxClaims: number
  expiresAt: string
  amount?: number
  currency?: string
  discountType: "PERCENTAGE" | "FIXED"
  discountValue: number
  discountCurrency?: string | null
  currencyPolicy:
    | "MATCH_CURRENCY_ONLY"
    | "CONVERT_AT_CHECKOUT"
    | "CONVERT_AT_REDEMPTION"
  firstCheckoutOnly?: boolean
  allowUpgrade?: boolean
  stackable?: boolean
  minimumOrderAmount?: number | null
  maximumDiscountAmount?: number | null
  allowedPackageCodes?: string[]
  allowedPlanCodes?: string[]
  allowedBillingPeriods?: string[]
  targetWorkosUserId?: string
  targetOrganizationId?: string
  metadataJson?: Record<string, unknown>
  createdByWorkosUserId: string
}

type UpdatePromotionData = {
  maxClaims?: number
  expiresAt?: string
  discountType?: "PERCENTAGE" | "FIXED"
  discountValue?: number
  discountCurrency?: string | null
  currencyPolicy?:
    | "MATCH_CURRENCY_ONLY"
    | "CONVERT_AT_CHECKOUT"
    | "CONVERT_AT_REDEMPTION"
  firstCheckoutOnly?: boolean
  allowUpgrade?: boolean
  stackable?: boolean
  minimumOrderAmount?: number | null
  maximumDiscountAmount?: number | null
  allowedPackageCodes?: string[] | null
  allowedPlanCodes?: string[] | null
  allowedBillingPeriods?: string[] | null
  amount?: number
  currency?: string
  targetWorkosUserId?: string | null
  targetOrganizationId?: string | null
  metadataJson?: Record<string, unknown> | null
}

type ListPromotionsParams = {
  kind?: string
  status?: string
  prefix?: string
  discountType?: string
  currencyPolicy?: string
  allowedPackageCode?: string
  limit?: number
  offset?: number
  organizationId?: string
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

    if (params.kind) {
      where.kind = params.kind as Prisma.EnumVoucherKindFilter["equals"]
    }
    if (params.status) {
      where.status = params.status as Prisma.EnumVoucherStatusFilter["equals"]
    }
    if (params.prefix) {
      where.prefix = params.prefix
    }
    if (params.organizationId) {
      where.OR = [
        { targetOrganizationId: params.organizationId },
        { claims: { some: { organizationId: params.organizationId } } },
      ]
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
    const code = await generateUniqueVoucherCode(async (candidate) => {
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
            metadataJson:
              data.metadataJson !== undefined
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
    }, data.prefix)

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

    // ─── Cross-kind field guard ─────────────────────────────────────────
    const invalidFields: string[] = []
    if (existing.kind === "PRODUCT_PROMOTION") {
      if (data.amount !== undefined) invalidFields.push("amount")
      if (data.currency !== undefined) invalidFields.push("currency")
    }
    if (invalidFields.length > 0) {
      throw new VoucherKindFieldMismatchError(existing.kind, invalidFields)
    }

    if (
      data.maxClaims !== undefined &&
      data.maxClaims < existing.claimedCount
    ) {
      throw new Error(
        `Cannot reduce maxClaims below current claimedCount (${existing.claimedCount})`
      )
    }

    const updateData: Prisma.VoucherUpdateInput = {}

    if (data.maxClaims !== undefined) updateData.maxClaims = data.maxClaims
    if (data.expiresAt !== undefined)
      updateData.expiresAt = new Date(data.expiresAt)
    if (data.amount !== undefined)
      updateData.amount = new Prisma.Decimal(data.amount)
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

      if (
        voucher.status === "DEPLETED" ||
        voucher.claimedCount >= voucher.maxClaims
      ) {
        throw new VoucherDepletedError(code)
      }

      // 3. Validate targeting
      if (
        voucher.targetWorkosUserId &&
        voucher.targetWorkosUserId !== workosUserId
      ) {
        throw new VoucherTargetUserMismatchError(code)
      }

      if (
        voucher.targetOrganizationId &&
        voucher.targetOrganizationId !== organizationId
      ) {
        throw new VoucherTargetOrgMismatchError(code)
      }

      // 4. Check if user already claimed this voucher
      const existingClaim = await tx.voucherClaim.findFirst({
        where: { voucherId: voucher.id, workosUserId },
      })
      if (existingClaim) {
        throw new VoucherAlreadyClaimedError(code, workosUserId)
      }

      // 5. Guarded update: atomically increment claimedCount only if under maxClaims
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

      // 6. Create claim record
      const claim = await tx.voucherClaim.create({
        data: {
          voucherId: voucher.id,
          workosUserId,
          organizationId,
        },
      })

      // 7. If claimedCount has reached maxClaims, set status to DEPLETED
      const updatedVoucher = await tx.voucher.findUniqueOrThrow({
        where: { id: voucher.id },
      })

      if (updatedVoucher.claimedCount >= updatedVoucher.maxClaims) {
        await tx.voucher.update({
          where: { id: voucher.id },
          data: { status: "DEPLETED" },
        })
      }

      // 8. Apply billing credit — find or create billing account, then create adjustment
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
        throw new BillingCurrencyMismatchError(
          voucher.currency,
          billingAccount.currency
        )
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

  // ─── Promotion domain ──────────────────────────────────────────────────────

  // ─── List promotions ─────────────────────────────────────────────────────────

  async listPromotions(params: ListPromotionsParams = {}) {
    const where: Prisma.VoucherWhereInput = {}

    if (params.kind) {
      where.kind = params.kind as Prisma.EnumVoucherKindFilter["equals"]
    }
    if (params.status) {
      where.status = params.status as Prisma.EnumVoucherStatusFilter["equals"]
    }
    if (params.prefix) {
      where.prefix = params.prefix
    }
    if (params.discountType) {
      where.discountType = params.discountType as never
    }
    if (params.currencyPolicy) {
      where.currencyPolicy =
        params.currencyPolicy as Prisma.EnumVoucherCurrencyPolicyFilter["equals"]
    }
    if (params.allowedPackageCode) {
      where.allowedPackageCodes = {
        array: { has: params.allowedPackageCode },
      } as never
    }
    if (params.organizationId) {
      where.OR = [
        { targetOrganizationId: params.organizationId },
        { claims: { some: { organizationId: params.organizationId } } },
      ]
    }

    const [vouchers, total] = await Promise.all([
      this.prisma.voucher.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: params.limit ?? 20,
        skip: params.offset ?? 0,
        include: { claims: true },
      }),
      this.prisma.voucher.count({ where }),
    ])

    return { vouchers, total }
  }

  // ─── Create promotion voucher ────────────────────────────────────────────────

  async createPromotion(data: CreatePromotionData) {
    const code = await generateUniqueVoucherCode(async (candidate) => {
      try {
        await this.prisma.voucher.create({
          data: {
            code: candidate,
            prefix: data.prefix ?? null,
            maxClaims: data.maxClaims,
            expiresAt: new Date(data.expiresAt),
            amount: data.amount
              ? new Prisma.Decimal(data.amount)
              : Prisma.Decimal(0),
            currency: data.currency ?? "IDR",
            kind: "PRODUCT_PROMOTION",
            status: "ACTIVE",
            discountType: data.discountType,
            discountValue: new Prisma.Decimal(data.discountValue),
            discountCurrency: data.discountCurrency ?? null,
            currencyPolicy: data.currencyPolicy,
            firstCheckoutOnly: data.firstCheckoutOnly ?? false,
            allowUpgrade: data.allowUpgrade ?? false,
            stackable: data.stackable ?? false,
            minimumOrderAmount: data.minimumOrderAmount
              ? new Prisma.Decimal(data.minimumOrderAmount)
              : null,
            maximumDiscountAmount: data.maximumDiscountAmount
              ? new Prisma.Decimal(data.maximumDiscountAmount)
              : null,
            allowedPackageCodes: data.allowedPackageCodes
              ? (data.allowedPackageCodes as Prisma.InputJsonValue)
              : undefined,
            allowedPlanCodes: data.allowedPlanCodes
              ? (data.allowedPlanCodes as Prisma.InputJsonValue)
              : undefined,
            allowedBillingPeriods: data.allowedBillingPeriods
              ? (data.allowedBillingPeriods as Prisma.InputJsonValue)
              : undefined,
            targetWorkosUserId: data.targetWorkosUserId ?? null,
            targetOrganizationId: data.targetOrganizationId ?? null,
            metadataJson:
              data.metadataJson !== undefined
                ? (data.metadataJson as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            createdByWorkosUserId: data.createdByWorkosUserId,
          },
        })
        return true
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          return false
        }
        throw err
      }
    }, data.prefix)

    const created = await this.prisma.voucher.findUniqueOrThrow({
      where: { code },
      include: { claims: true },
    })

    return created
  }

  // ─── Update promotion voucher ───────────────────────────────────────────────

  async updatePromotion(id: string, data: UpdatePromotionData) {
    const existing = await this.prisma.voucher.findUnique({ where: { id } })
    if (!existing) {
      throw new VoucherNotFoundError(id)
    }

    if (existing.kind !== "PRODUCT_PROMOTION") {
      throw new VoucherNotAPromotionError(existing.code)
    }

    if (
      data.maxClaims !== undefined &&
      data.maxClaims < existing.claimedCount
    ) {
      throw new Error(
        `Cannot reduce maxClaims below current claimedCount (${existing.claimedCount})`
      )
    }

    const updateData: Prisma.VoucherUpdateInput = {}

    if (data.maxClaims !== undefined) updateData.maxClaims = data.maxClaims
    if (data.expiresAt !== undefined)
      updateData.expiresAt = new Date(data.expiresAt)
    if (data.amount !== undefined)
      updateData.amount = new Prisma.Decimal(data.amount)
    if (data.currency !== undefined) updateData.currency = data.currency
    if (data.discountType !== undefined)
      updateData.discountType = data.discountType
    if (data.discountValue !== undefined)
      updateData.discountValue = new Prisma.Decimal(data.discountValue)
    if (data.discountCurrency !== undefined)
      updateData.discountCurrency = data.discountCurrency
    if (data.currencyPolicy !== undefined)
      updateData.currencyPolicy = data.currencyPolicy
    if (data.firstCheckoutOnly !== undefined)
      updateData.firstCheckoutOnly = data.firstCheckoutOnly
    if (data.allowUpgrade !== undefined)
      updateData.allowUpgrade = data.allowUpgrade
    if (data.stackable !== undefined) updateData.stackable = data.stackable
    if (data.minimumOrderAmount !== undefined)
      updateData.minimumOrderAmount = data.minimumOrderAmount
        ? new Prisma.Decimal(data.minimumOrderAmount)
        : null
    if (data.maximumDiscountAmount !== undefined)
      updateData.maximumDiscountAmount = data.maximumDiscountAmount
        ? new Prisma.Decimal(data.maximumDiscountAmount)
        : null
    if (data.allowedPackageCodes !== undefined)
      updateData.allowedPackageCodes = data.allowedPackageCodes
        ? (data.allowedPackageCodes as Prisma.InputJsonValue)
        : Prisma.JsonNull
    if (data.allowedPlanCodes !== undefined)
      updateData.allowedPlanCodes = data.allowedPlanCodes
        ? (data.allowedPlanCodes as Prisma.InputJsonValue)
        : Prisma.JsonNull
    if (data.allowedBillingPeriods !== undefined)
      updateData.allowedBillingPeriods = data.allowedBillingPeriods
        ? (data.allowedBillingPeriods as Prisma.InputJsonValue)
        : Prisma.JsonNull
    if (data.targetWorkosUserId !== undefined)
      updateData.targetWorkosUserId = data.targetWorkosUserId
    if (data.targetOrganizationId !== undefined)
      updateData.targetOrganizationId = data.targetOrganizationId
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

  // ─── Publish voucher ────────────────────────────────────────────────────────
  // A DISABLED voucher can be published (set to ACTIVE) when:
  //   1. It is not already ACTIVE
  //   2. It has not expired
  //   3. For PRODUCT_PROMOTION: discountType, discountValue, currencyPolicy are set
  //   4. For BALANCE_CREDIT: amount and currency are valid

  async publishVoucher(id: string) {
    const existing = await this.prisma.voucher.findUnique({ where: { id } })
    if (!existing) {
      throw new VoucherNotFoundError(id)
    }

    if (existing.status === "ACTIVE") {
      throw new VoucherAlreadyPublishedError(existing.code)
    }

    // EXPIRED and DEPLETED vouchers cannot be re-published
    if (existing.status === "EXPIRED" || existing.status === "DEPLETED") {
      throw new VoucherNotPublishableError(
        existing.code,
        `voucher is ${existing.status.toLowerCase()} and cannot be published`
      )
    }

    // Validate publish constraints
    if (existing.expiresAt <= new Date()) {
      throw new VoucherNotPublishableError(
        existing.code,
        "voucher has already expired"
      )
    }

    if (existing.kind === "PRODUCT_PROMOTION") {
      const errors: string[] = []
      if (!existing.discountType) errors.push("discountType is required")
      if (!existing.discountValue) errors.push("discountValue is required")
      if (!existing.currencyPolicy) errors.push("currencyPolicy is required")
      if (
        existing.discountType === "PERCENTAGE" &&
        existing.discountValue &&
        existing.discountValue.gt(100)
      ) {
        errors.push("PERCENTAGE discountValue cannot exceed 100")
      }
      if (existing.discountType === "FIXED" && !existing.discountCurrency)
        errors.push("discountCurrency is required for FIXED discount")
      if (existing.maximumDiscountAmount && existing.discountType === "FIXED")
        errors.push(
          "maximumDiscountAmount only applies to PERCENTAGE discounts"
        )

      if (errors.length > 0) {
        throw new VoucherDiscountConfigurationError(errors.join("; "))
      }
    } else {
      // BALANCE_CREDIT: legacy validation
      if (!existing.amount || existing.amount.lte(0))
        throw new VoucherNotPublishableError(
          existing.code,
          "amount must be positive for BALANCE_CREDIT vouchers"
        )
    }

    return this.prisma.voucher.update({
      where: { id },
      data: { status: "ACTIVE" },
    })
  }

  // ─── Disable voucher (promotion-aware) ──────────────────────────────────────

  async disablePromotionVoucher(id: string) {
    const existing = await this.prisma.voucher.findUnique({ where: { id } })
    if (!existing) {
      throw new VoucherNotFoundError(id)
    }

    if (existing.kind !== "PRODUCT_PROMOTION") {
      throw new VoucherNotAPromotionError(existing.code)
    }

    if (existing.status === "DISABLED") {
      throw new VoucherAlreadyDisabledError(existing.code)
    }

    return this.prisma.voucher.update({
      where: { id },
      data: { status: "DISABLED" },
    })
  }

  // ─── Get promotion claims ────────────────────────────────────────────────────

  async getPromotionClaims(voucherId: string) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id: voucherId },
    })
    if (!voucher) {
      throw new VoucherNotFoundError(voucherId)
    }

    return this.prisma.voucherClaim.findMany({
      where: { voucherId },
      orderBy: { claimedAt: "desc" },
      include: {
        order: {
          select: {
            id: true,
            organizationId: true,
            status: true,
            currency: true,
            subtotalAmount: true,
            discountAmount: true,
            totalAmount: true,
          },
        },
      },
    })
  }
}
