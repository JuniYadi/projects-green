import { PrismaClient, ServiceType, SubscriptionType, BillingMode } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const DATABASE_URL = process.env.DATABASE_URL?.trim()

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL environment variable")
  process.exit(1)
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: DATABASE_URL,
  }),
})

// ─── Seed Data ────────────────────────────────────────────────────────────────

const packages = [
  { code: "APP_HOSTING", name: "App Hosting", description: "Deploy and host applications" },
  { code: "VPN", name: "VPN", description: "Virtual private network" },
  { code: "WHATSAPP", name: "WhatsApp", description: "WhatsApp Business messaging" },
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
    resources: { cpuMin: 100, cpuMax: 500, memMin: 128, memMax: 1024, defaultCpu: 100, defaultMem: 128 },
  },
  {
    packageCode: "APP_HOSTING",
    code: "BASIC",
    name: "Basic",
    resources: { cpuMin: 100, cpuMax: 1000, memMin: 128, memMax: 2048, defaultCpu: 500, defaultMem: 512 },
  },
  {
    packageCode: "APP_HOSTING",
    code: "STANDARD",
    name: "Standard",
    resources: { cpuMin: 100, cpuMax: 2000, memMin: 128, memMax: 8192, defaultCpu: 1000, defaultMem: 2048 },
  },
  {
    packageCode: "APP_HOSTING",
    code: "PROFESSIONAL",
    name: "Professional",
    resources: { cpuMin: 100, cpuMax: 4000, memMin: 128, memMax: 16384, defaultCpu: 2000, defaultMem: 4096 },
  },
  {
    packageCode: "APP_HOSTING",
    code: "CUSTOM",
    name: "Custom",
    resources: { cpuMin: 100, cpuMax: 2000, memMin: 128, memMax: 8192, defaultCpu: 100, defaultMem: 128 },
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
    resources: { quotaIn: 500, quotaOut: 500, dailyPerDevice: 50, devices: 2 },
  },
  {
    packageCode: "WHATSAPP",
    code: "STANDARD",
    name: "Standard",
    resources: { quotaIn: 1000, quotaOut: 1000, dailyPerDevice: 100, devices: 5 },
  },
  {
    packageCode: "WHATSAPP",
    code: "PROFESSIONAL",
    name: "Professional",
    resources: { quotaIn: 5000, quotaOut: 5000, dailyPerDevice: 500, devices: 20 },
  },
  {
    packageCode: "WHATSAPP",
    code: "ENTERPRISE",
    name: "Enterprise",
    resources: { quotaIn: null, quotaOut: null, dailyPerDevice: null, devices: null },
  },
]

const pricings = [
  // APP_HOSTING — BUNDLE/PACKAGE (per region)
  { planCode: "APP_HOSTING_STARTER", regionCode: "INDONESIA", type: "BUNDLE", billingMode: "PACKAGE", basePriceIdr: 15000, monthlyCapIdr: 15000, unitRateCpu: null, unitRateMem: null, unitRateMessage: null },
  { planCode: "APP_HOSTING_BASIC", regionCode: "INDONESIA", type: "BUNDLE", billingMode: "PACKAGE", basePriceIdr: 30000, monthlyCapIdr: 30000, unitRateCpu: null, unitRateMem: null, unitRateMessage: null },
  { planCode: "APP_HOSTING_STANDARD", regionCode: "INDONESIA", type: "BUNDLE", billingMode: "PACKAGE", basePriceIdr: 59000, monthlyCapIdr: 59000, unitRateCpu: null, unitRateMem: null, unitRateMessage: null },
  { planCode: "APP_HOSTING_PROFESSIONAL", regionCode: "INDONESIA", type: "BUNDLE", billingMode: "PACKAGE", basePriceIdr: 120000, monthlyCapIdr: 120000, unitRateCpu: null, unitRateMem: null, unitRateMessage: null },
  { planCode: "APP_HOSTING_STARTER", regionCode: "SINGAPORE", type: "BUNDLE", billingMode: "PACKAGE", basePriceIdr: 20000, monthlyCapIdr: 20000, unitRateCpu: null, unitRateMem: null, unitRateMessage: null },
  { planCode: "APP_HOSTING_BASIC", regionCode: "SINGAPORE", type: "BUNDLE", billingMode: "PACKAGE", basePriceIdr: 40000, monthlyCapIdr: 40000, unitRateCpu: null, unitRateMem: null, unitRateMessage: null },
  { planCode: "APP_HOSTING_STANDARD", regionCode: "SINGAPORE", type: "BUNDLE", billingMode: "PACKAGE", basePriceIdr: 79000, monthlyCapIdr: 79000, unitRateCpu: null, unitRateMem: null, unitRateMessage: null },
  { planCode: "APP_HOSTING_PROFESSIONAL", regionCode: "SINGAPORE", type: "BUNDLE", billingMode: "PACKAGE", basePriceIdr: 160000, monthlyCapIdr: 160000, unitRateCpu: null, unitRateMem: null, unitRateMessage: null },
  // APP_HOSTING — PAYG (per region)
  { planCode: "APP_HOSTING_STANDARD", regionCode: "INDONESIA", type: "PAYG", billingMode: "PAYG", basePriceIdr: 0, monthlyCapIdr: null, unitRateCpu: 35, unitRateMem: 17.1875, unitRateMessage: null },
  { planCode: "APP_HOSTING_STANDARD", regionCode: "SINGAPORE", type: "PAYG", billingMode: "PAYG", basePriceIdr: 0, monthlyCapIdr: null, unitRateCpu: 45, unitRateMem: 22.5, unitRateMessage: null },
  // VPN — per region (regionId required)
  { planCode: "VPN_STANDARD", regionCode: "INDONESIA", type: "BUNDLE", billingMode: "PACKAGE", basePriceIdr: 0, monthlyCapIdr: 0, unitRateCpu: null, unitRateMem: null, unitRateMessage: null },
  { planCode: "VPN_STANDARD", regionCode: "SINGAPORE", type: "BUNDLE", billingMode: "PACKAGE", basePriceIdr: 0, monthlyCapIdr: 0, unitRateCpu: null, unitRateMem: null, unitRateMessage: null },
  { planCode: "VPN_PROFESSIONAL", regionCode: "INDONESIA", type: "BUNDLE", billingMode: "PACKAGE", basePriceIdr: 0, monthlyCapIdr: 0, unitRateCpu: null, unitRateMem: null, unitRateMessage: null },
  { planCode: "VPN_PROFESSIONAL", regionCode: "SINGAPORE", type: "BUNDLE", billingMode: "PACKAGE", basePriceIdr: 0, monthlyCapIdr: 0, unitRateCpu: null, unitRateMem: null, unitRateMessage: null },
  // WHATSAPP — global pricing (uses "GLOBAL" region)
  { planCode: "WHATSAPP_LITE", regionCode: "GLOBAL", type: "BUNDLE", billingMode: "PACKAGE", basePriceIdr: 0, monthlyCapIdr: 0, unitRateCpu: null, unitRateMem: null, unitRateMessage: null },
  { planCode: "WHATSAPP_STANDARD", regionCode: "GLOBAL", type: "BUNDLE", billingMode: "PACKAGE", basePriceIdr: 0, monthlyCapIdr: 0, unitRateCpu: null, unitRateMem: null, unitRateMessage: null },
  { planCode: "WHATSAPP_PROFESSIONAL", regionCode: "GLOBAL", type: "BUNDLE", billingMode: "PACKAGE", basePriceIdr: 0, monthlyCapIdr: 0, unitRateCpu: null, unitRateMem: null, unitRateMessage: null },
  { planCode: "WHATSAPP_ENTERPRISE", regionCode: "GLOBAL", type: "BUNDLE", billingMode: "PACKAGE", basePriceIdr: 0, monthlyCapIdr: 0, unitRateCpu: null, unitRateMem: null, unitRateMessage: null },
]

// ─── Seed Functions ───────────────────────────────────────────────────────────

async function seedRegions() {
  console.log("\n📍 Seeding regions...")
  let created = 0
  let updated = 0

  for (const region of regions) {
    const existing = await prisma.serviceRegion.findUnique({ where: { code: region.code } })
    if (existing) {
      await prisma.serviceRegion.update({
        where: { code: region.code },
        data: { name: region.name, country: region.country, flag: region.flag },
      })
      updated++
    } else {
      await prisma.serviceRegion.create({ data: region })
      created++
    }
  }

  console.log(`  ✅ Regions: ${created} created, ${updated} updated`)
}

async function seedPackages() {
  console.log("\n📦 Seeding packages...")
  let created = 0
  let updated = 0

  for (const pkg of packages) {
    const existing = await prisma.servicePackage.findUnique({ where: { code: pkg.code as ServiceType } })
    if (existing) {
      await prisma.servicePackage.update({
        where: { code: pkg.code as ServiceType },
        data: { name: pkg.name, description: pkg.description },
      })
      updated++
    } else {
      await prisma.servicePackage.create({ data: { ...pkg, code: pkg.code as ServiceType } })
      created++
    }
  }

  console.log(`  ✅ Packages: ${created} created, ${updated} updated`)
}

async function seedPlans() {
  console.log("\n📋 Seeding plans...")
  let created = 0
  let updated = 0

  for (const plan of plans) {
    const pkg = await prisma.servicePackage.findUnique({ where: { code: plan.packageCode as any } })
    if (!pkg) {
      console.error(`  ⚠️ Package ${plan.packageCode} not found, skipping plan ${plan.code}`)
      continue
    }

    const existing = await prisma.servicePlan.findFirst({
      where: { packageId: pkg.id, code: plan.code },
    })

     
    const data: any = {
      packageId: pkg.id,
      code: plan.code,
      name: plan.name,
       
      resources: plan.resources as any,
    }

    if (existing) {
      await prisma.servicePlan.update({
        where: { id: existing.id },
        data,
      })
      updated++
    } else {
      await prisma.servicePlan.create({ data })
      created++
    }
  }

  console.log(`  ✅ Plans: ${created} created, ${updated} updated`)
}

async function seedPricings() {
  console.log("\n💰 Seeding pricings...")
  let created = 0
  let skipped = 0

  for (const pricing of pricings) {
    const [planCode, regionCode] = [pricing.planCode, pricing.regionCode]

    // Find plan by compound key: packageCode_planCode (e.g., "APP_HOSTING_STARTER")
    const pkgCode = planCode.split("_")[0]
    const plCode = planCode.replace(`${pkgCode}_`, "")
    const pkg = await prisma.servicePackage.findUnique({ where: { code: pkgCode as ServiceType } })
    if (!pkg) {
      console.error(`  ⚠️ Package ${pkgCode} not found, skipping pricing`)
      skipped++
      continue
    }

    const foundPlan = await prisma.servicePlan.findFirst({ where: { packageId: pkg.id, code: plCode } })
    if (!foundPlan) {
      console.error(`  ⚠️ Plan ${plCode} in package ${pkgCode} not found, skipping pricing`)
      skipped++
      continue
    }

    const region = await prisma.serviceRegion.findUnique({ where: { code: regionCode } })
    if (!region) {
      console.error(`  ⚠️ Region ${regionCode} not found, skipping pricing`)
      skipped++
      continue
    }

    const existing = await prisma.servicePricing.findFirst({
      where: {
        planId: foundPlan.id,
        regionId: region.id,
        type: pricing.type as SubscriptionType,
        billingMode: pricing.billingMode as BillingMode,
      },
    })

     
const data: any = {
      planId: foundPlan.id,
      regionId: region.id,
      type: pricing.type,
      billingMode: pricing.billingMode,
      basePriceIdr: pricing.basePriceIdr,
      monthlyCapIdr: pricing.monthlyCapIdr ?? undefined,
      unitRateCpu: pricing.unitRateCpu ?? undefined,
      unitRateMem: pricing.unitRateMem ?? undefined,
      unitRateMessage: pricing.unitRateMessage ?? undefined,
    }

    if (existing) {
      await prisma.servicePricing.update({
        where: { id: existing.id },
        data,
      })
    } else {
      await prisma.servicePricing.create({ data })
      created++
    }
  }

  console.log(`  ✅ Pricings: ${created} created, ${skipped} skipped`)
}

async function seedBillingAccounts() {
  console.log("\n🏢 Seeding billing accounts for existing organizations...")

  // Get all unique organizationIds from BillingAccount
  const existingAccounts = await prisma.billingAccount.findMany({
    select: { organizationId: true },
    distinct: ["organizationId"],
  })

  const existingOrgIds = new Set(existingAccounts.map((a) => a.organizationId))

  let created = 0
  let updated = 0

  // Create billing accounts for any org that doesn't have one yet
  // (organizations come from WorkOS, seeded externally)
  for (const orgId of existingOrgIds) {
    const account = await prisma.billingAccount.findFirst({
      where: { organizationId: orgId },
    })
    if (account) {
      updated++
    } else {
      await prisma.billingAccount.create({
        data: {
          organizationId: orgId,
        },
      })
      created++
    }
  }

  console.log(`  ✅ Billing accounts: ${created} created, ${updated} found`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Starting billing seed...")

  try {
    await seedRegions()
    await seedPackages()
    await seedPlans()
    await seedPricings()
    await seedBillingAccounts()

    console.log("\n✅ Billing seed completed successfully!")
  } catch (error) {
    console.error("\n❌ Billing seed failed:", error)
    throw error
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error("Seed error:", error)
    prisma.$disconnect()
    process.exit(1)
  })