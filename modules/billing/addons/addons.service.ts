import { Prisma, type PrismaClient } from "@prisma/client"

import { prisma } from "@/lib/prisma"

import {
  ADDON_RECURRING_PERIODS,
  PlanAttachmentIncludeShape,
  toAddonDTO,
  toAddonPlanAttachmentDTO,
  type AddonDTO,
  type AddonPlanAttachmentDTO,
  type AddonPlanAttachmentRecord,
  type CreateAddonInput,
  type UpdateAddonInput,
  type AttachAddonToPlanInput,
  type UpdatePlanAddonInput,
  type AddonListResponse,
  type AddonDetailResponse,
  type AddonPlanAttachmentListResponse,
  type AddonPlanAttachmentDetailResponse,
} from "./addons.dto"

type AddonsDb = Pick<
  PrismaClient,
  | "serviceAddon"
  | "serviceAddonPricing"
  | "servicePlanAddon"
  | "serviceSubscriptionAddon"
  | "servicePlan"
>

type AddonsServiceDeps = {
  prisma?: AddonsDb
}

const now = () => new Date()

function buildPricingWhere(currency: string) {
  const current = now()
  return {
    isActive: true,
    currency,
    billingPeriod: { in: ADDON_RECURRING_PERIODS as readonly string[] },
    effectiveFrom: { lte: current },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: current } }],
  } as Prisma.ServiceAddonPricingWhereInput
}

const planAttachmentInclude = {
  plan: {
    select: {
      id: true,
      code: true,
      package: { select: { code: true } },
    },
  },
  addon: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
} as const satisfies PlanAttachmentIncludeShape["include"]

export class AddonsService {
  private db: AddonsDb

  constructor(deps: AddonsServiceDeps = {}) {
    this.db = deps.prisma ?? prisma
  }

  // ─── Listing ───────────────────────────────────────────────────────────

  async listAddons(params: {
    currency: string
    page?: number
    limit?: number
    search?: string
    billingMode?: string
    isActive?: boolean
  }): Promise<AddonListResponse> {
    const {
      currency,
      page = 1,
      limit = 20,
      search,
      billingMode,
      isActive,
    } = params

    const where: Prisma.ServiceAddonWhereInput = {
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(billingMode ? { billingMode: billingMode as never } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    }

    const skip = (page - 1) * limit

    const [rows, total] = await Promise.all([
      this.db.serviceAddon.findMany({
        where,
        include: {
          prices: {
            where: buildPricingWhere(currency),
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.db.serviceAddon.count({ where }),
    ])

    return {
      addons: rows.map((row) =>
        toAddonDTO(row as unknown as Parameters<typeof toAddonDTO>[0])
      ),
      currency,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async getAddon(params: {
    currency: string
    code: string
  }): Promise<AddonDetailResponse | null> {
    const { currency, code } = params

    const row = await this.db.serviceAddon.findUnique({
      where: { code },
      include: {
        prices: {
          where: buildPricingWhere(currency),
        },
      },
    })

    if (!row) return null

    return { addon: toAddonDTO(row as never) }
  }

  // ─── Create / Update / Deactivate ───────────────────────────────────────

  async createAddon(input: CreateAddonInput): Promise<AddonDTO> {
    const { prices: inputPrices, ...addonFields } = input

    const existing = await this.db.serviceAddon.findUnique({
      where: { code: input.code },
    })
    if (existing) {
      throw new AddonConflictError(
        `Addon with code "${input.code}" already exists.`
      )
    }

    const firstCurrency = input.prices[0]?.currency ?? "IDR"

    const result = await this.db.serviceAddon.create({
      data: {
        ...addonFields,
        billingMode: addonFields.billingMode as never,
        prices: {
          create: inputPrices.map((p) => ({
            billingPeriod: p.billingPeriod as never,
            currency: p.currency,
            amount: new Prisma.Decimal(p.amount),
            effectiveFrom: p.effectiveFrom ?? now(),
            effectiveTo: p.effectiveTo ?? null,
            isActive: p.isActive ?? true,
          })),
        },
      },
      include: {
        prices: {
          where: buildPricingWhere(firstCurrency),
        },
      },
    })

    return toAddonDTO(result as never)
  }

  async updateAddon(id: string, input: UpdateAddonInput): Promise<AddonDTO> {
    const existing = await this.db.serviceAddon.findUnique({
      where: { id },
      include: { prices: true },
    })
    if (!existing) {
      throw new AddonNotFoundError(`Addon with id "${id}" not found.`)
    }

    const { prices: inputPrices, ...addonFields } = input

    const data: Prisma.ServiceAddonUpdateInput = {
      ...addonFields,
      ...(addonFields.billingMode
        ? { billingMode: addonFields.billingMode as never }
        : {}),
      ...(inputPrices
        ? {
            prices: {
              deleteMany: {},
              create: inputPrices.map((p) => ({
                billingPeriod: p.billingPeriod as never,
                currency: p.currency,
                amount: new Prisma.Decimal(p.amount),
                effectiveFrom: p.effectiveFrom ?? now(),
                effectiveTo: p.effectiveTo ?? null,
                isActive: p.isActive ?? true,
              })),
            },
          }
        : {}),
    }

    const result = await this.db.serviceAddon.update({
      where: { id },
      data,
      include: {
        prices: {
          where: buildPricingWhere("IDR"),
        },
      },
    })

    return toAddonDTO(result as never)
  }

  async deactivateAddon(id: string): Promise<void> {
    const existing = await this.db.serviceAddon.findUnique({
      where: { id },
    })
    if (!existing) {
      throw new AddonNotFoundError(`Addon with id "${id}" not found.`)
    }

    // Prevent deactivation if the addon is attached as required to any plan
    const requiredAttachments = await this.db.servicePlanAddon.count({
      where: {
        addonId: id,
        isRequired: true,
        isActive: true,
      },
    })
    if (requiredAttachments > 0) {
      throw new AddonConflictError(
        `Cannot deactivate addon "${existing.code}" because it is required on ${requiredAttachments} plan(s).`
      )
    }

    await this.db.serviceAddon.update({
      where: { id },
      data: { isActive: false },
    })
  }

  // ─── Plan Attachment ──────────────────────────────────────────────────

  async listPlanAttachments(params: {
    planId: string
    page?: number
    limit?: number
    isActive?: boolean
  }): Promise<AddonPlanAttachmentListResponse> {
    const { planId, page = 1, limit = 20, isActive } = params

    const where: Prisma.ServicePlanAddonWhereInput = {
      planId,
      ...(isActive !== undefined ? { isActive } : {}),
    }

    const skip = (page - 1) * limit

    const [rows, total] = await Promise.all([
      this.db.servicePlanAddon.findMany({
        where,
        include: planAttachmentInclude,
        orderBy: { displayOrder: "asc" },
        skip,
        take: limit,
      }),
      this.db.servicePlanAddon.count({ where }),
    ])

    return {
      attachments: rows.map((row) =>
        toAddonPlanAttachmentDTO(row as AddonPlanAttachmentRecord)
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async getPlanAttachment(
    id: string
  ): Promise<AddonPlanAttachmentDetailResponse | null> {
    const row = await this.db.servicePlanAddon.findUnique({
      where: { id },
      include: planAttachmentInclude,
    })

    if (!row) return null

    return {
      attachment: toAddonPlanAttachmentDTO(row as AddonPlanAttachmentRecord),
    }
  }

  async attachAddonToPlan(
    input: AttachAddonToPlanInput
  ): Promise<AddonPlanAttachmentDTO> {
    const { planId, addonId, ...attachmentFields } = input

    // Validate references exist
    const [plan, addon] = await Promise.all([
      this.db.servicePlan.findUnique({ where: { id: planId } }),
      this.db.serviceAddon.findUnique({ where: { id: addonId } }),
    ])

    if (!plan) {
      throw new PlanNotFoundError(`Plan with id "${planId}" not found.`)
    }
    if (!addon) {
      throw new AddonNotFoundError(`Addon with id "${addonId}" not found.`)
    }
    if (!addon.isActive) {
      throw new AddonConflictError(
        `Cannot attach inactive addon "${addon.code}".`
      )
    }

    // Check for existing attachment
    const existing = await this.db.servicePlanAddon.findFirst({
      where: { planId, addonId },
    })
    if (existing) {
      throw new AddonConflictError(
        `Addon "${addon.code}" is already attached to plan "${plan.code}".`
      )
    }

    const row = await this.db.servicePlanAddon.create({
      data: {
        planId,
        addonId,
        ...attachmentFields,
      } as Prisma.ServicePlanAddonUncheckedCreateInput,
      include: planAttachmentInclude,
    })

    return toAddonPlanAttachmentDTO(row as AddonPlanAttachmentRecord)
  }

  async updatePlanAttachment(
    id: string,
    input: UpdatePlanAddonInput
  ): Promise<AddonPlanAttachmentDTO> {
    const existing = await this.db.servicePlanAddon.findUnique({
      where: { id },
    })
    if (!existing) {
      throw new PlanAttachmentNotFoundError(
        `Plan addon attachment with id "${id}" not found.`
      )
    }

    const row = await this.db.servicePlanAddon.update({
      where: { id },
      data: input as Prisma.ServicePlanAddonUpdateInput,
      include: planAttachmentInclude,
    })

    return toAddonPlanAttachmentDTO(row as AddonPlanAttachmentRecord)
  }

  async detachAddonFromPlan(id: string): Promise<void> {
    const existing = await this.db.servicePlanAddon.findUnique({
      where: { id },
    })
    if (!existing) {
      throw new PlanAttachmentNotFoundError(
        `Plan addon attachment with id "${id}" not found.`
      )
    }

    // Prevent detachment if the addon is required and there are active subscriptions
    if (existing.isRequired) {
      const activeSubscriptions = await this.db.serviceSubscriptionAddon.count({
        where: {
          addonId: existing.addonId,
          subscription: { planId: existing.planId },
          status: "ACTIVE",
        },
      })
      if (activeSubscriptions > 0) {
        throw new AddonConflictError(
          `Cannot detach required addon from plan because ${activeSubscriptions} active subscription(s) depend on it.`
        )
      }
    }

    await this.db.servicePlanAddon.delete({
      where: { id },
    })
  }
}

// ─── Domain errors ────────────────────────────────────────────────────────

export class AddonNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AddonNotFoundError"
  }
}

export class PlanNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PlanNotFoundError"
  }
}

export class PlanAttachmentNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PlanAttachmentNotFoundError"
  }
}

export class AddonConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AddonConflictError"
  }
}
