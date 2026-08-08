import { Prisma, type PrismaClient, type ServiceType } from "@prisma/client"

import { prisma as defaultPrisma } from "@/lib/prisma"

import {
  adminCatalogInclude,
  toAdminCatalogProductDTO,
  type AdminCatalogProductDTO,
  type AdminCatalogProductInput,
} from "./admin-catalog.dto"

const PUBLISH_PERIODS = [
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "ANNUAL",
] as const
const PUBLISH_CURRENCIES = ["IDR", "USD"] as const

type CatalogDb = Pick<
  PrismaClient,
  | "servicePackage"
  | "servicePlan"
  | "servicePricing"
  | "serviceRegion"
  | "$transaction"
>

export class ProductNotFoundError extends Error {
  name = "ProductNotFoundError"
}

export class ProductPublishValidationError extends Error {
  name = "ProductPublishValidationError"
  constructor(
    message: string,
    readonly cells: string[] = []
  ) {
    super(message)
  }
}

export class AdminCatalogService {
  constructor(private readonly db: CatalogDb = defaultPrisma) {}

  async listProducts(): Promise<AdminCatalogProductDTO[]> {
    const products = await this.db.servicePackage.findMany({
      include: adminCatalogInclude,
      orderBy: { code: "asc" },
    })
    return products.map((product) => toAdminCatalogProductDTO(product as never))
  }

  async getProduct(code: string): Promise<AdminCatalogProductDTO | null> {
    const product = await this.db.servicePackage.findUnique({
      where: { code: code as ServiceType },
      include: adminCatalogInclude,
    })
    return product ? toAdminCatalogProductDTO(product as never) : null
  }

  async saveDraft(
    input: AdminCatalogProductInput
  ): Promise<AdminCatalogProductDTO> {
    for (const plan of input.plans) {
      for (const price of plan.prices) {
        if (
          !Number.isFinite(Number(price.amount)) ||
          Number(price.amount) <= 0
        ) {
          throw new Error("Price amounts must be positive.")
        }
        if (
          price.effectiveTo &&
          price.effectiveFrom &&
          new Date(price.effectiveTo) <= new Date(price.effectiveFrom)
        ) {
          throw new Error("effectiveTo must be later than effectiveFrom.")
        }
      }
    }

    const product = await this.db.$transaction(async (tx) => {
      const region = await tx.serviceRegion.findUnique({
        where: { code: "GLOBAL" },
      })
      if (!region) throw new Error("GLOBAL region is not configured.")

      const existing = await tx.servicePackage.findUnique({
        where: { code: input.code },
      })
      const packageData = {
        name: input.name,
        description: input.description ?? null,
        state: "DRAFT" as const,
        isActive: true,
      }
      const pkg = existing
        ? await tx.servicePackage.update({
            where: { code: input.code },
            data: packageData,
          })
        : await tx.servicePackage.create({
            data: { code: input.code, ...packageData },
          })
      const existingPlans = await tx.servicePlan.findMany({
        where: { packageId: pkg.id },
        include: {
          pricings: {
            include: {
              subscriptions: { select: { id: true } },
              orderLines: { select: { id: true } },
            },
          },
        },
      })
      for (const existingPlan of existingPlans) {
        const submittedPlan = input.plans.find(
          (planInput) => planInput.code === existingPlan.code
        )
        if (!submittedPlan) {
          await tx.servicePlan.update({
            where: { id: existingPlan.id },
            data: { isActive: false },
          })
          for (const existingPrice of existingPlan.pricings) {
            if (existingPrice.isActive) {
              if (
                existingPrice.subscriptions?.length ||
                existingPrice.orderLines?.length
              ) {
                throw new Error(
                  "Cannot deactivate a pricing row referenced by a subscription or order."
                )
              }
              await tx.servicePricing.update({
                where: { id: existingPrice.id },
                data: { isActive: false },
              })
            }
          }
          continue
        }
        for (const existingPrice of existingPlan.pricings) {
          const submittedCell = submittedPlan.prices.some(
            (price) =>
              price.currency === existingPrice.currency &&
              price.billingPeriod === existingPrice.billingPeriod &&
              price.isActive
          )
          if (!submittedCell && existingPrice.isActive) {
            if (
              existingPrice.subscriptions?.length ||
              existingPrice.orderLines?.length
            ) {
              throw new Error(
                "Cannot deactivate a pricing row referenced by a subscription or order."
              )
            }
            await tx.servicePricing.update({
              where: { id: existingPrice.id },
              data: { isActive: false },
            })
          }
        }
      }

      for (const planInput of input.plans) {
        const existingPlan = await tx.servicePlan.findUnique({
          where: {
            packageId_code: { packageId: pkg.id, code: planInput.code },
          },
        })
        const planData = {
          name: planInput.name,
          resources: planInput.resources,
          isActive: planInput.isActive ?? true,
        }
        const plan = existingPlan
          ? await tx.servicePlan.update({
              where: { id: existingPlan.id },
              data: planData,
            })
          : await tx.servicePlan.create({
              data: { packageId: pkg.id, code: planInput.code, ...planData },
            })

        for (const price of planInput.prices) {
          const effectiveFrom = price.effectiveFrom
            ? new Date(price.effectiveFrom)
            : new Date()
          const data = {
            planId: plan.id,
            regionId: region.id,
            type: "BUNDLE" as const,
            billingMode: "PACKAGE" as const,
            billingPeriod: price.billingPeriod,
            currency: price.currency,
            periodPrice: new Prisma.Decimal(price.amount),
            basePriceIdr: new Prisma.Decimal(price.amount),
            effectiveFrom,
            effectiveTo: price.effectiveTo ? new Date(price.effectiveTo) : null,
            chargeUnit: "SUBSCRIPTION" as const,
            isActive: price.isActive,
          }
          const existingPrice = await tx.servicePricing.findUnique({
            where: {
              planId_regionId_type_billingMode_billingPeriod_currency_effectiveFrom:
                {
                  planId: plan.id,
                  regionId: region.id,
                  type: "BUNDLE",
                  billingMode: "PACKAGE",
                  billingPeriod: price.billingPeriod,
                  currency: price.currency,
                  effectiveFrom,
                },
            },
          })
          if (existingPrice) {
            throw new Error(
              "Cannot rewrite an existing effective price row; provide a new effectiveFrom."
            )
          }
          await tx.servicePricing.create({ data })
        }
      }

      return tx.servicePackage.findUnique({
        where: { code: input.code },
        include: adminCatalogInclude,
      })
    })

    if (!product) throw new ProductNotFoundError("Product not found.")
    return toAdminCatalogProductDTO(product as never)
  }

  async publish(code: string): Promise<AdminCatalogProductDTO> {
    const product = await this.db.servicePackage.findUnique({
      where: { code: code as ServiceType },
      include: adminCatalogInclude,
    })
    if (!product) throw new ProductNotFoundError("Product not found.")

    const cells: string[] = []
    for (const plan of product.plans) {
      if (!plan.isActive) continue
      for (const currency of PUBLISH_CURRENCIES) {
        for (const period of PUBLISH_PERIODS) {
          const match = plan.pricings.find(
            (price) =>
              price.isActive &&
              price.currency === currency &&
              price.billingPeriod === period &&
              price.periodPrice !== null &&
              Number(price.periodPrice) > 0
          )
          if (!match) cells.push(`${plan.code}:${currency}:${period}`)
        }
      }
    }
    if (cells.length > 0) {
      throw new ProductPublishValidationError(
        `Product has incomplete enabled price cells: ${cells.join(", ")}`,
        cells
      )
    }

    const published = await this.db.servicePackage.update({
      where: { code: code as ServiceType },
      data: { state: "PUBLISHED", isActive: true },
      include: adminCatalogInclude,
    })
    return toAdminCatalogProductDTO(published as never)
  }
}
