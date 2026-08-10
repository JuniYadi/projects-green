import { Prisma, ServiceType } from "@prisma/client"

import { prisma } from "@/lib/prisma"

import type {
  CatalogListResponse,
  CatalogProductDetailResponse,
} from "./catalog.dto"
import { toCatalogPlanDTO } from "./catalog.dto"

const RECURRING_PERIODS: string[] = [
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "ANNUAL",
]

export class CatalogService {
  private pricingWhere(currency: string) {
    const now = new Date()
    return {
      isActive: true,
      currency,
      billingPeriod: { in: RECURRING_PERIODS },
      periodPrice: { not: null },
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      AND: [
        {
          OR: [{ type: "BUNDLE" }, { billingMode: "PACKAGE" }],
        },
      ],
    } as Prisma.ServicePricingWhereInput
  }

  async getCatalog(currency: string): Promise<CatalogListResponse> {
    const packages = await prisma.servicePackage.findMany({
      where: { isActive: true, state: "PUBLISHED" },
      include: {
        plans: {
          where: { isActive: true },
          include: {
            pricings: {
              where: this.pricingWhere(currency),
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

    const products = packages
      .map((pkg) => {
        const plans = pkg.plans
          .filter((plan) => plan.pricings.length > 0)
          .map((plan) => toCatalogPlanDTO(plan))
          .filter((plan) => plan.offers.length > 0)

        if (plans.length === 0) return null

        return {
          code: pkg.code as ServiceType,
          name: pkg.name,
          description: pkg.description,
          plans,
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)

    return { products, currency }
  }

  async getProduct(
    currency: string,
    code: string
  ): Promise<CatalogProductDetailResponse | null> {
    const pkg = await prisma.servicePackage.findFirst({
      where: {
        code: code as ServiceType,
        isActive: true,
        state: "PUBLISHED",
      },
      include: {
        plans: {
          where: { isActive: true },
          include: {
            pricings: {
              where: this.pricingWhere(currency),
              include: {
                servicePlan: {
                  include: {
                    package: true,
                  },
                },
                region: true,
              },
            },
          },
        },
      },
    })

    if (!pkg) return null

    const plans = pkg.plans
      .filter((plan) => plan.pricings.length > 0)
      .map((plan) => toCatalogPlanDTO(plan))
      .filter((plan) => plan.offers.length > 0)

    if (plans.length === 0) return null

    return {
      product: {
        code: pkg.code as ServiceType,
        name: pkg.name,
        description: pkg.description,
        plans,
      },
      currency,
    }
  }
}
