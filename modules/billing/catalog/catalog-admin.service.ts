import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"

import { prisma as defaultPrisma } from "@/lib/prisma"
import { CurrencyService } from "../currency.service"
import type { RecurringBillingPeriod } from "../pricing/pricing.types"
import type {
  CatalogProductDetailResponse,
  CatalogPlanDTO,
} from "./catalog.dto"
import { toCatalogPlanDTO } from "./catalog.dto"

const RECURRING_PERIODS = [
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "ANNUAL",
] as const

// ─── Input types ────────────────────────────────────────────────────────────

export type UpsertPackageInput = {
  code: string
  name: string
  description?: string
  isActive?: boolean
}

export type UpsertPlanInput = {
  packageCode: string
  code: string
  name: string
  resources?: Record<string, unknown>
  billingStrategy?: "PRO_RATA" | "FIXED_CYCLE"
  stockControl?: "UNLIMITED" | "TRACKED"
  stockCount?: number | null
  allowBackorder?: boolean
  isActive?: boolean
}
export type UpsertPlanPricingInput = {
  planId: string
  regionId: string
  billingPeriod: RecurringBillingPeriod
  chargeUnit: "SUBSCRIPTION" | "DEVICE"
  periodPrice: number
  currency: string
  effectiveFrom: Date
  effectiveTo?: Date | null
  isActive?: boolean
}

export type UpsertAddonInput = {
  code: string
  name: string
  description?: string
  billingMode?: "RECURRING" | "ONE_TIME" | "USAGE"
  isActive?: boolean
}

export type UpsertAddonPricingInput = {
  addonId: string
  billingPeriod: RecurringBillingPeriod
  currency: string
  amount: number
  effectiveFrom: Date
  effectiveTo?: Date | null
  isActive?: boolean
}

export type UpsertPlanAddonAttachmentInput = {
  planId: string
  addonId: string
  label?: string
  description?: string
  isRequired?: boolean
  displayOrder?: number
  enabledTerms?: Record<string, unknown>
  isActive?: boolean
}

export type PublishProductInput = {
  code: string
  name: string
  description?: string
  isActive?: boolean
  plans: Array<{
    code: string
    name: string
    resources?: Record<string, unknown>
    billingStrategy?: "PRO_RATA" | "FIXED_CYCLE"
    stockControl?: "UNLIMITED" | "TRACKED"
    stockCount?: number | null
    allowBackorder?: boolean
    isActive?: boolean
    offers: Array<{
      regionId?: string
      billingPeriod: RecurringBillingPeriod
      chargeUnit: "SUBSCRIPTION" | "DEVICE"
      periodPrice: number
      currency: string
      effectiveFrom: Date
      effectiveTo?: Date | null
      isActive?: boolean
    }>
  }>
  addons?: Array<{
    code: string
    name: string
    description?: string
    billingMode?: "RECURRING" | "ONE_TIME" | "USAGE"
    isActive?: boolean
    prices: Array<{
      billingPeriod: RecurringBillingPeriod
      currency: string
      amount: number
      effectiveFrom: Date
      effectiveTo?: Date | null
      isActive?: boolean
    }>
    planAttachments?: Array<{
      planCode: string
      label?: string
      description?: string
      isRequired?: boolean
      displayOrder?: number
      enabledTerms?: Record<string, unknown>
      isActive?: boolean
    }>
  }>
}

// ─── Error classes ──────────────────────────────────────────────────────────

export class CatalogPackageNotFoundError extends Error {
  constructor(code: string) {
    super(`Package not found: ${code}`)
    this.name = "CatalogPackageNotFoundError"
  }
}

export class CatalogPlanNotFoundError extends Error {
  constructor(code: string) {
    super(`Plan not found: ${code}`)
    this.name = "CatalogPlanNotFoundError"
  }
}

export class CatalogAddonNotFoundError extends Error {
  constructor(code: string) {
    super(`Addon not found: ${code}`)
    this.name = "CatalogAddonNotFoundError"
  }
}

export class CatalogRegionNotFoundError extends Error {
  constructor() {
    super("No region available for pricing. Create a region first.")
    this.name = "CatalogRegionNotFoundError"
  }
}

// ─── Service ────────────────────────────────────────────────────────────────

export type CatalogAdminDb = Pick<
  PrismaClient,
  | "servicePackage"
  | "servicePlan"
  | "servicePricing"
  | "serviceAddon"
  | "serviceAddonPricing"
  | "servicePlanAddon"
  | "serviceRegion"
  | "$transaction"
>

export type CatalogAdminDeps = {
  prisma?: CatalogAdminDb
  currencyService?: Pick<CurrencyService, "convert" | "getByCode">
}

export class CatalogAdminService {
  private db: CatalogAdminDb
  private currencies: Pick<CurrencyService, "convert" | "getByCode">

  constructor(deps: CatalogAdminDeps = {}) {
    this.db = deps.prisma ?? (defaultPrisma as unknown as CatalogAdminDb)
    this.currencies = deps.currencyService ?? new CurrencyService()
  }

  // ─── Package ────────────────────────────────────────────────────────

  async upsertPackage(input: UpsertPackageInput) {
    const existing = await this.db.servicePackage.findFirst({
      where: { code: input.code as never },
    })

    if (existing) {
      return this.db.servicePackage.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          description: input.description ?? existing.description,
          isActive: input.isActive ?? existing.isActive,
        },
      })
    }

    return this.db.servicePackage.create({
      data: {
        code: input.code as never,
        name: input.name,
        description: input.description ?? null,
        isActive: input.isActive ?? true,
      },
    })
  }

  async getProduct(code: string): Promise<CatalogProductDetailResponse | null> {
    const pkg = await this.db.servicePackage.findFirst({
      where: { code: code as never },
      include: {
        plans: {
          where: { isActive: true },
          include: {
            pricings: {
              where: {
                isActive: true,
                type: "BUNDLE",
                billingMode: "PACKAGE",
                billingPeriod: { in: RECURRING_PERIODS as never },
                periodPrice: { gt: 0 },
              },
              include: {
                servicePlan: {
                  include: { package: true },
                },
                region: true,
              },
            },
          },
        },
      },
    })

    if (!pkg) return null

    return {
      product: {
        code: pkg.code as never,
        name: pkg.name,
        description: pkg.description,
        isActive: pkg.isActive,
        plans: pkg.plans.map(toCatalogPlanDTO),
      },
      // Admin editing is currency-neutral; the editor includes every offer.
      currency: "IDR",
    }
  }

  async getCatalogPlan(
    packageCode: string,
    planCode: string
  ): Promise<CatalogPlanDTO | null> {
    const pkg = await this.db.servicePackage.findFirst({
      where: { code: packageCode as never },
    })
    if (!pkg) return null
    const plan = await this.db.servicePlan.findFirst({
      where: { packageId: pkg.id, code: planCode, isActive: true },
      include: {
        pricings: {
          where: {
            isActive: true,
            type: "BUNDLE",
            billingMode: "PACKAGE",
            billingPeriod: { in: RECURRING_PERIODS as never },
            periodPrice: { gt: 0 },
          },
          include: {
            servicePlan: {
              include: { package: true },
            },
            region: true,
          },
        },
      },
    })

    if (!plan) return null
    return toCatalogPlanDTO(plan)
  }

  async listCatalogPlans(packageCode: string): Promise<CatalogPlanDTO[]> {
    const pkg = await this.db.servicePackage.findFirst({
      where: { code: packageCode as never },
      include: {
        plans: {
          include: {
            pricings: {
              where: {
                isActive: true,
                type: "BUNDLE",
                billingMode: "PACKAGE",
                billingPeriod: { in: RECURRING_PERIODS as never },
                periodPrice: { gt: 0 },
              },
              include: {
                servicePlan: {
                  include: { package: true },
                },
                region: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    })

    if (!pkg) return []
    return pkg.plans.map(toCatalogPlanDTO)
  }

  // ─── Plan ──────────────────────────────────────────────────────────

  async upsertPlan(input: UpsertPlanInput) {
    const pkg = await this.db.servicePackage.findFirst({
      where: { code: input.packageCode as never },
    })
    if (!pkg) throw new CatalogPackageNotFoundError(input.packageCode)

    const existing = await this.db.servicePlan.findFirst({
      where: { packageId: pkg.id, code: input.code },
    })

    if (existing) {
      return this.db.servicePlan.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          resources: (input.resources ?? existing.resources) as never,
          billingStrategy: input.billingStrategy ?? existing.billingStrategy,
          stockControl: input.stockControl ?? existing.stockControl,
          stockCount:
            input.stockCount !== undefined
              ? input.stockCount
              : existing.stockCount,
          allowBackorder: input.allowBackorder ?? existing.allowBackorder,
          isActive: input.isActive ?? existing.isActive,
        },
      })
    }

    return this.db.servicePlan.create({
      data: {
        packageId: pkg.id,
        code: input.code,
        name: input.name,
        resources: (input.resources ?? {}) as never,
        billingStrategy: input.billingStrategy ?? "FIXED_CYCLE",
        stockControl: input.stockControl ?? "UNLIMITED",
        stockCount: input.stockCount ?? null,
        allowBackorder: input.allowBackorder ?? false,
        isActive: input.isActive ?? true,
      },
    })
  }

  // ─── Plan Pricing ─────────────────────────────────────────────────

  private async computeBasePriceIdr(
    periodPrice: number,
    currency: string
  ): Promise<Prisma.Decimal> {
    if (currency === "IDR") {
      return new Prisma.Decimal(periodPrice)
    }
    return this.currencies.convert(periodPrice, currency, "IDR")
  }

  async upsertPlanPricing(input: UpsertPlanPricingInput) {
    // Validate currency is active
    const curr = await this.currencies.getByCode(input.currency)
    if (!curr.isActive) {
      throw new Error(`Currency ${input.currency} is inactive.`)
    }

    const basePriceIdr = await this.computeBasePriceIdr(
      input.periodPrice,
      input.currency
    )

    // Check for existing pricing at same identity
    const existing = await this.db.servicePricing.findFirst({
      where: {
        planId: input.planId,
        regionId: input.regionId,
        billingPeriod: input.billingPeriod,
        currency: input.currency,
        type: "BUNDLE",
        billingMode: "PACKAGE",
        effectiveFrom: input.effectiveFrom,
      },
    })

    if (existing) {
      return this.db.servicePricing.update({
        where: { id: existing.id },
        data: {
          chargeUnit: input.chargeUnit,
          periodPrice: new Prisma.Decimal(input.periodPrice),
          basePriceIdr,
          effectiveTo: input.effectiveTo ?? null,
          isActive: input.isActive ?? true,
        },
      })
    }

    return this.db.servicePricing.create({
      data: {
        planId: input.planId,
        regionId: input.regionId,
        type: "BUNDLE",
        billingMode: "PACKAGE",
        billingPeriod: input.billingPeriod,
        chargeUnit: input.chargeUnit,
        periodPrice: new Prisma.Decimal(input.periodPrice),
        basePriceIdr,
        currency: input.currency,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        isActive: input.isActive ?? true,
      },
    })
  }

  // ─── Addon ────────────────────────────────────────────────────────

  async upsertAddon(input: UpsertAddonInput) {
    const existing = await this.db.serviceAddon.findFirst({
      where: { code: input.code },
    })

    if (existing) {
      return this.db.serviceAddon.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          description: input.description ?? existing.description,
          billingMode: (input.billingMode as never) ?? existing.billingMode,
          isActive: input.isActive ?? existing.isActive,
        },
      })
    }

    return this.db.serviceAddon.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        billingMode: (input.billingMode ?? "RECURRING") as never,
        isActive: input.isActive ?? true,
      },
    })
  }

  // ─── Addon Pricing ────────────────────────────────────────────────

  async upsertAddonPricing(input: UpsertAddonPricingInput) {
    const curr = await this.currencies.getByCode(input.currency)
    if (!curr.isActive) {
      throw new Error(`Currency ${input.currency} is inactive.`)
    }

    const existing = await this.db.serviceAddonPricing.findFirst({
      where: {
        addonId: input.addonId,
        billingPeriod: input.billingPeriod,
        currency: input.currency,
        effectiveFrom: input.effectiveFrom,
      },
    })

    if (existing) {
      return this.db.serviceAddonPricing.update({
        where: { id: existing.id },
        data: {
          amount: new Prisma.Decimal(input.amount),
          effectiveTo: input.effectiveTo ?? null,
          isActive: input.isActive ?? true,
        },
      })
    }

    return this.db.serviceAddonPricing.create({
      data: {
        addonId: input.addonId,
        billingPeriod: input.billingPeriod,
        currency: input.currency,
        amount: new Prisma.Decimal(input.amount),
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        isActive: input.isActive ?? true,
      },
    })
  }

  // ─── Plan-Addon Attachment ────────────────────────────────────────

  async upsertPlanAddonAttachment(input: UpsertPlanAddonAttachmentInput) {
    const existing = await this.db.servicePlanAddon.findFirst({
      where: { planId: input.planId, addonId: input.addonId },
    })

    if (existing) {
      return this.db.servicePlanAddon.update({
        where: { id: existing.id },
        data: {
          label: input.label ?? existing.label,
          description: input.description ?? existing.description,
          isRequired: input.isRequired ?? existing.isRequired,
          displayOrder: input.displayOrder ?? existing.displayOrder,
          enabledTerms: (input.enabledTerms as never) ?? existing.enabledTerms,
          isActive: input.isActive ?? existing.isActive,
        },
      })
    }

    return this.db.servicePlanAddon.create({
      data: {
        planId: input.planId,
        addonId: input.addonId,
        label: input.label ?? null,
        description: input.description ?? null,
        isRequired: input.isRequired ?? false,
        displayOrder: input.displayOrder ?? 0,
        enabledTerms: (input.enabledTerms ?? null) as never,
        isActive: input.isActive ?? true,
      },
    })
  }

  // ─── Publish (atomic) ─────────────────────────────────────────────

  async publishProduct(input: PublishProductInput) {
    return (this.db as unknown as PrismaClient).$transaction(async (tx) => {
      const txService = new CatalogAdminService({
        prisma: tx as unknown as CatalogAdminDb,
        currencyService: this.currencies,
      })

      // 1. Upsert the package
      const pkg = await txService.upsertPackage({
        code: input.code,
        name: input.name,
        description: input.description,
        isActive: input.isActive,
      })

      // 2. Deactivate any existing plans and pricings not included in input.plans
      const submittedPlanCodes = input.plans.map((p) => p.code)
      await tx.servicePlan.updateMany({
        where: {
          packageId: pkg.id,
          code: { notIn: submittedPlanCodes },
        },
        data: { isActive: false },
      })
      await tx.servicePricing.updateMany({
        where: {
          servicePlan: {
            packageId: pkg.id,
            code: { notIn: submittedPlanCodes },
          },
        },
        data: { isActive: false },
      })

      // 3. Upsert each plan and its pricing
      for (const planInput of input.plans) {
        const plan = await txService.upsertPlan({
          packageCode: input.code,
          code: planInput.code,
          name: planInput.name,
          resources: planInput.resources,
          billingStrategy: planInput.billingStrategy,
          stockControl: planInput.stockControl,
          stockCount: planInput.stockCount,
          allowBackorder: planInput.allowBackorder,
          isActive: planInput.isActive,
        })
        // Get a default region if not specified
        const defaultRegion = await tx.serviceRegion.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        })

        for (const offer of planInput.offers) {
          const regionId = offer.regionId ?? defaultRegion?.id
          if (!regionId) {
            throw new CatalogRegionNotFoundError()
          }

          await txService.upsertPlanPricing({
            planId: plan.id,
            regionId,
            billingPeriod: offer.billingPeriod,
            chargeUnit: offer.chargeUnit,
            periodPrice: offer.periodPrice,
            currency: offer.currency,
            effectiveFrom: offer.effectiveFrom,
            effectiveTo: offer.effectiveTo,
            isActive: offer.isActive,
          })
        }
      }

      // 3. Upsert addons, their pricing, and plan attachments
      if (input.addons) {
        for (const addonInput of input.addons) {
          const addon = await txService.upsertAddon({
            code: addonInput.code,
            name: addonInput.name,
            description: addonInput.description,
            billingMode: addonInput.billingMode,
            isActive: addonInput.isActive,
          })

          for (const price of addonInput.prices) {
            await txService.upsertAddonPricing({
              addonId: addon.id,
              billingPeriod: price.billingPeriod,
              currency: price.currency,
              amount: price.amount,
              effectiveFrom: price.effectiveFrom,
              effectiveTo: price.effectiveTo,
              isActive: price.isActive,
            })
          }

          if (addonInput.planAttachments) {
            for (const attachment of addonInput.planAttachments) {
              // Resolve plan by code within the package
              const plan = await tx.servicePlan.findFirst({
                where: {
                  packageId: pkg.id,
                  code: attachment.planCode,
                },
              })
              if (!plan) {
                throw new CatalogPlanNotFoundError(attachment.planCode)
              }

              await txService.upsertPlanAddonAttachment({
                planId: plan.id,
                addonId: addon.id,
                label: attachment.label,
                description: attachment.description,
                isRequired: attachment.isRequired,
                displayOrder: attachment.displayOrder,
                enabledTerms: attachment.enabledTerms,
                isActive: attachment.isActive,
              })
            }
          }
        }
      }

      return pkg
    })
  }
}
