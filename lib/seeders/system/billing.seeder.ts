/**
 * Billing Seeder (System)
 *
 * Seeds regions, packages, plans, pricings, and billing accounts for
 * the billing/payments system. Migrated from scripts/seed-billing.ts.
 */

import { BaseSeeder, registerSeeder } from "@/lib/seeders"
import { ServiceType, SubscriptionType, BillingMode } from "@prisma/client"

// ─── Seed Data ────────────────────────────────────────────────────────────────

const packages = [
  {
    code: "APP_HOSTING",
    name: "App Hosting",
    description: "Deploy and host applications",
  },
  { code: "VPN", name: "VPN", description: "Virtual private network" },
  {
    code: "WHATSAPP",
    name: "WhatsApp",
    description: "WhatsApp Business messaging",
  },
]

const regions = [
  { code: "INDONESIA", name: "Indonesia", country: "ID", flag: "🇮🇩" },
  { code: "SINGAPORE", name: "Singapore", country: "SG", flag: "🇸🇬" },
  { code: "GLOBAL", name: "Global", country: "XX", flag: "🌐" },
]

const plans = [
  // APP_HOSTING
  {
    packageCode: "APP_HOSTING",
    code: "STARTER",
    name: "Starter",
    resources: {
      cpuMin: 100,
      cpuMax: 500,
      memMin: 128,
      memMax: 1024,
      defaultCpu: 100,
      defaultMem: 128,
    },
  },
  {
    packageCode: "APP_HOSTING",
    code: "BASIC",
    name: "Basic",
    resources: {
      cpuMin: 100,
      cpuMax: 1000,
      memMin: 128,
      memMax: 2048,
      defaultCpu: 500,
      defaultMem: 512,
    },
  },
  {
    packageCode: "APP_HOSTING",
    code: "STANDARD",
    name: "Standard",
    resources: {
      cpuMin: 100,
      cpuMax: 2000,
      memMin: 128,
      memMax: 8192,
      defaultCpu: 1000,
      defaultMem: 2048,
    },
  },
  {
    packageCode: "APP_HOSTING",
    code: "PROFESSIONAL",
    name: "Professional",
    resources: {
      cpuMin: 100,
      cpuMax: 4000,
      memMin: 128,
      memMax: 16384,
      defaultCpu: 2000,
      defaultMem: 4096,
    },
  },
  {
    packageCode: "APP_HOSTING",
    code: "CUSTOM",
    name: "Custom",
    resources: {
      cpuMin: 100,
      cpuMax: 2000,
      memMin: 128,
      memMax: 8192,
      defaultCpu: 100,
      defaultMem: 128,
    },
  },
  // VPN
  {
    packageCode: "VPN",
    code: "STANDARD",
    name: "Standard VPN",
    resources: { dataLimitGb: null },
  },
  {
    packageCode: "VPN",
    code: "PROFESSIONAL",
    name: "Pro VPN",
    resources: { dataLimitGb: null },
  },
  // WHATSAPP
  {
    packageCode: "WHATSAPP",
    code: "LITE",
    name: "Lite",
    resources: {
      quotaIn: 500,
      quotaOut: 500,
      dailyPerDevice: 50,
      devices: 2,
    },
  },
  {
    packageCode: "WHATSAPP",
    code: "STANDARD",
    name: "Standard",
    resources: {
      quotaIn: 1000,
      quotaOut: 1000,
      dailyPerDevice: 100,
      devices: 5,
    },
  },
  {
    packageCode: "WHATSAPP",
    code: "PROFESSIONAL",
    name: "Professional",
    resources: {
      quotaIn: 5000,
      quotaOut: 5000,
      dailyPerDevice: 500,
      devices: 20,
    },
  },
  {
    packageCode: "WHATSAPP",
    code: "ENTERPRISE",
    name: "Enterprise",
    resources: {
      quotaIn: null,
      quotaOut: null,
      dailyPerDevice: null,
      devices: null,
    },
  },
]

const pricings = [
  // APP_HOSTING — BUNDLE/PACKAGE (per region)
  {
    planCode: "APP_HOSTING_STARTER",
    regionCode: "INDONESIA",
    type: "BUNDLE",
    billingMode: "PACKAGE",
    basePriceIdr: 15000,
    monthlyCapIdr: 15000,
    unitRateCpu: null,
    unitRateMem: null,
    unitRateMessage: null,
  },
  {
    planCode: "APP_HOSTING_BASIC",
    regionCode: "INDONESIA",
    type: "BUNDLE",
    billingMode: "PACKAGE",
    basePriceIdr: 30000,
    monthlyCapIdr: 30000,
    unitRateCpu: null,
    unitRateMem: null,
    unitRateMessage: null,
  },
  {
    planCode: "APP_HOSTING_STANDARD",
    regionCode: "INDONESIA",
    type: "BUNDLE",
    billingMode: "PACKAGE",
    basePriceIdr: 59000,
    monthlyCapIdr: 59000,
    unitRateCpu: null,
    unitRateMem: null,
    unitRateMessage: null,
  },
  {
    planCode: "APP_HOSTING_PROFESSIONAL",
    regionCode: "INDONESIA",
    type: "BUNDLE",
    billingMode: "PACKAGE",
    basePriceIdr: 120000,
    monthlyCapIdr: 120000,
    unitRateCpu: null,
    unitRateMem: null,
    unitRateMessage: null,
  },
  {
    planCode: "APP_HOSTING_STARTER",
    regionCode: "SINGAPORE",
    type: "BUNDLE",
    billingMode: "PACKAGE",
    basePriceIdr: 20000,
    monthlyCapIdr: 20000,
    unitRateCpu: null,
    unitRateMem: null,
    unitRateMessage: null,
  },
  {
    planCode: "APP_HOSTING_BASIC",
    regionCode: "SINGAPORE",
    type: "BUNDLE",
    billingMode: "PACKAGE",
    basePriceIdr: 40000,
    monthlyCapIdr: 40000,
    unitRateCpu: null,
    unitRateMem: null,
    unitRateMessage: null,
  },
  {
    planCode: "APP_HOSTING_STANDARD",
    regionCode: "SINGAPORE",
    type: "BUNDLE",
    billingMode: "PACKAGE",
    basePriceIdr: 79000,
    monthlyCapIdr: 79000,
    unitRateCpu: null,
    unitRateMem: null,
    unitRateMessage: null,
  },
  {
    planCode: "APP_HOSTING_PROFESSIONAL",
    regionCode: "SINGAPORE",
    type: "BUNDLE",
    billingMode: "PACKAGE",
    basePriceIdr: 160000,
    monthlyCapIdr: 160000,
    unitRateCpu: null,
    unitRateMem: null,
    unitRateMessage: null,
  },
  // APP_HOSTING — PAYG (per region)
  {
    planCode: "APP_HOSTING_STANDARD",
    regionCode: "INDONESIA",
    type: "PAYG",
    billingMode: "PAYG",
    basePriceIdr: 0,
    monthlyCapIdr: null,
    unitRateCpu: 35,
    unitRateMem: 17.1875,
    unitRateMessage: null,
  },
  {
    planCode: "APP_HOSTING_STANDARD",
    regionCode: "SINGAPORE",
    type: "PAYG",
    billingMode: "PAYG",
    basePriceIdr: 0,
    monthlyCapIdr: null,
    unitRateCpu: 45,
    unitRateMem: 22.5,
    unitRateMessage: null,
  },
  // VPN — per region (regionId required)
  {
    planCode: "VPN_STANDARD",
    regionCode: "INDONESIA",
    type: "BUNDLE",
    billingMode: "PACKAGE",
    basePriceIdr: 0,
    monthlyCapIdr: 0,
    unitRateCpu: null,
    unitRateMem: null,
    unitRateMessage: null,
  },
  {
    planCode: "VPN_STANDARD",
    regionCode: "SINGAPORE",
    type: "BUNDLE",
    billingMode: "PACKAGE",
    basePriceIdr: 0,
    monthlyCapIdr: 0,
    unitRateCpu: null,
    unitRateMem: null,
    unitRateMessage: null,
  },
  {
    planCode: "VPN_PROFESSIONAL",
    regionCode: "INDONESIA",
    type: "BUNDLE",
    billingMode: "PACKAGE",
    basePriceIdr: 0,
    monthlyCapIdr: 0,
    unitRateCpu: null,
    unitRateMem: null,
    unitRateMessage: null,
  },
  {
    planCode: "VPN_PROFESSIONAL",
    regionCode: "SINGAPORE",
    type: "BUNDLE",
    billingMode: "PACKAGE",
    basePriceIdr: 0,
    monthlyCapIdr: 0,
    unitRateCpu: null,
    unitRateMem: null,
    unitRateMessage: null,
  },
  // WHATSAPP — global pricing (uses "GLOBAL" region)
  {
    planCode: "WHATSAPP_LITE",
    regionCode: "GLOBAL",
    type: "BUNDLE",
    billingMode: "PACKAGE",
    basePriceIdr: 0,
    monthlyCapIdr: 0,
    unitRateCpu: null,
    unitRateMem: null,
    unitRateMessage: null,
  },
  {
    planCode: "WHATSAPP_STANDARD",
    regionCode: "GLOBAL",
    type: "BUNDLE",
    billingMode: "PACKAGE",
    basePriceIdr: 0,
    monthlyCapIdr: 0,
    unitRateCpu: null,
    unitRateMem: null,
    unitRateMessage: null,
  },
  {
    planCode: "WHATSAPP_PROFESSIONAL",
    regionCode: "GLOBAL",
    type: "BUNDLE",
    billingMode: "PACKAGE",
    basePriceIdr: 0,
    monthlyCapIdr: 0,
    unitRateCpu: null,
    unitRateMem: null,
    unitRateMessage: null,
  },
  {
    planCode: "WHATSAPP_ENTERPRISE",
    regionCode: "GLOBAL",
    type: "BUNDLE",
    billingMode: "PACKAGE",
    basePriceIdr: 0,
    monthlyCapIdr: 0,
    unitRateCpu: null,
    unitRateMem: null,
    unitRateMessage: null,
  },
]

export class BillingSeeder extends BaseSeeder {
  static override readonly seederName = "Billing"
  static override readonly classification = "system" as const
  static override readonly runOrder = 20
  static override readonly description =
    "Regions, packages, plans, pricings, and billing accounts"

  async seed(): Promise<void> {
    await this.seedRegions()
    await this.seedPackages()
    await this.seedPlans()
    await this.seedPricings()
    await this.seedBillingAccounts()
  }

  private async seedRegions(): Promise<void> {
    this.log("Seeding regions...")

    for (const region of regions) {
      const existing = await this.prisma.serviceRegion.findUnique({
        where: { code: region.code },
      })

      if (existing) {
        await this.prisma.serviceRegion.update({
          where: { code: region.code },
          data: {
            name: region.name,
            country: region.country,
            flag: region.flag,
          },
        })
        this.trackUpdated()
      } else {
        await this.prisma.serviceRegion.create({ data: region })
        this.trackCreated()
      }
    }
  }

  private async seedPackages(): Promise<void> {
    this.log("Seeding packages...")

    for (const pkg of packages) {
      const existing = await this.prisma.servicePackage.findUnique({
        where: { code: pkg.code as ServiceType },
      })

      if (existing) {
        await this.prisma.servicePackage.update({
          where: { code: pkg.code as ServiceType },
          data: { name: pkg.name, description: pkg.description },
        })
        this.trackUpdated()
      } else {
        await this.prisma.servicePackage.create({
          data: { ...pkg, code: pkg.code as ServiceType },
        })
        this.trackCreated()
      }
    }
  }

  private async seedPlans(): Promise<void> {
    this.log("Seeding plans...")

    for (const plan of plans) {
      const pkg = await this.prisma.servicePackage.findUnique({
        where: { code: plan.packageCode as ServiceType },
      })

      if (!pkg) {
        this.warn(
          `ServicePackage ${plan.packageCode} not found, skipping plan ${plan.code}`
        )
        this.trackError(
          `ServicePackage ${plan.packageCode} not found for plan ${plan.code}`
        )
        continue
      }

      const existing = await this.prisma.servicePlan.findFirst({
        where: { packageId: pkg.id, code: plan.code },
      })

      const data = {
        packageId: pkg.id,
        code: plan.code,
        name: plan.name,
        resources: plan.resources,
      }

      if (existing) {
        await this.prisma.servicePlan.update({
          where: { id: existing.id },
          data,
        })
        this.trackUpdated()
      } else {
        await this.prisma.servicePlan.create({ data })
        this.trackCreated()
      }
    }
  }

  private async seedPricings(): Promise<void> {
    this.log("Seeding pricings...")

    for (const pricing of pricings) {
      const [planCode, regionCode] = [pricing.planCode, pricing.regionCode]

      // Find plan by compound key: packageCode_planCode
      // Package codes may contain underscores (e.g. APP_HOSTING), so we match prefixes
      const pkgCode = this.getPackageCode(planCode)
      const plCode = planCode.slice(pkgCode.length + 1) // +1 for the underscore
      const pkg = await this.prisma.servicePackage.findUnique({
        where: { code: pkgCode as ServiceType },
      })

      if (!pkg) {
        this.warn(`ServicePackage ${pkgCode} not found, skipping pricing`)
        this.trackSkipped()
        continue
      }

      const foundPlan = await this.prisma.servicePlan.findFirst({
        where: { packageId: pkg.id, code: plCode },
      })

      if (!foundPlan) {
        this.warn(
          `Plan ${plCode} in servicePackage ${pkgCode} not found, skipping pricing`
        )
        this.trackSkipped()
        continue
      }

      const region = await this.prisma.serviceRegion.findUnique({
        where: { code: regionCode },
      })

      if (!region) {
        this.warn(`ServiceRegion ${regionCode} not found, skipping pricing`)
        this.trackSkipped()
        continue
      }

      const existing = await this.prisma.servicePricing.findFirst({
        where: {
          planId: foundPlan.id,
          regionId: region.id,
          type: pricing.type as SubscriptionType,
          billingMode: pricing.billingMode as BillingMode,
        },
      })

      const data = {
        planId: foundPlan.id,
        regionId: region.id,
        type: pricing.type as SubscriptionType,
        billingMode: pricing.billingMode as BillingMode,
        basePriceIdr: pricing.basePriceIdr,
        monthlyCapIdr: pricing.monthlyCapIdr ?? undefined,
        unitRateCpu: pricing.unitRateCpu ?? undefined,
        unitRateMem: pricing.unitRateMem ?? undefined,
        unitRateMessage: pricing.unitRateMessage ?? undefined,
      }

      if (existing) {
        await this.prisma.servicePricing.update({
          where: { id: existing.id },
          data,
        })
        this.trackUpdated()
      } else {
        await this.prisma.servicePricing.create({ data })
        this.trackCreated()
      }
    }
  }

  private async seedBillingAccounts(): Promise<void> {
    this.log("Seeding billing accounts for existing organizations...")

    const existingAccounts = await this.prisma.billingAccount.findMany({
      select: { organizationId: true },
      distinct: ["organizationId"],
    })

    const existingOrgIds = new Set(
      existingAccounts.map((a) => a.organizationId)
    )

    for (const orgId of existingOrgIds) {
      const account = await this.prisma.billingAccount.findFirst({
        where: { organizationId: orgId },
      })

      if (account) {
        this.trackSkipped()
      } else {
        await this.prisma.billingAccount.create({
          data: { organizationId: orgId },
        })
        this.trackCreated()
      }
    }
  }

  /**
   * Extract the package code from a compound plan code.
   * Package codes may contain underscores (e.g. APP_HOSTING), so we match
   * known prefixes rather than naively splitting on the first underscore.
   */
  private getPackageCode(planCode: string): string {
    const packageCodes: ServiceType[] = ["APP_HOSTING", "VPN", "WHATSAPP"]
    for (const pkg of packageCodes) {
      if (planCode.startsWith(pkg + "_")) {
        return pkg
      }
    }
    // Fallback: split on first underscore (for backward compatibility)
    return planCode.split("_")[0]
  }
}

registerSeeder(BillingSeeder)
