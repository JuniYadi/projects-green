#!/usr/bin/env bun
/**
 * Seed the App Hosting framework support policy.
 *
 * Populates DetectorRule with the MVP launch set so that
 * `evaluateSupportDecision` can mark Laravel and Next.js as launchable.
 * Both rules are upserted on a stable derived id so the script is safe
 * to re-run.
 *
 * Usage:
 *   bun run scripts/seed-app-hosting-policy.ts
 */
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient, type Prisma } from "@prisma/client"

const DATABASE_URL = process.env.DATABASE_URL?.trim()

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL environment variable")
  process.exit(1)
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
})

type LaunchPolicy = {
  name: string
  patternJson: Prisma.InputJsonValue
  implicationsJson: Prisma.InputJsonValue
  priority: number
}

const POLICIES: LaunchPolicy[] = [
  {
    name: "Support Laravel Launch",
    patternJson: { frameworkId: "laravel" },
    implicationsJson: {
      impact: "LAUNCH",
      minConfidence: 0.8,
      framework: "laravel",
    },
    priority: 100,
  },
  {
    name: "Support Next.js Launch",
    patternJson: { frameworkId: "nextjs" },
    implicationsJson: {
      impact: "LAUNCH",
      minConfidence: 0.8,
      framework: "nextjs",
    },
    priority: 100,
  },
]

const deriveId = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

const main = async () => {
  console.log("Seeding App Hosting framework policies...")

  for (const policy of POLICIES) {
    const id = deriveId(policy.name)
    const rule = await prisma.detectorRule.upsert({
      where: { id },
      update: {
        name: policy.name,
        patternJson: policy.patternJson,
        implicationsJson: policy.implicationsJson,
        priority: policy.priority,
        isActive: true,
      },
      create: {
        id,
        name: policy.name,
        patternJson: policy.patternJson,
        implicationsJson: policy.implicationsJson,
        priority: policy.priority,
        isActive: true,
      },
    })
    console.log(`  - upserted rule ${rule.id} (${rule.name})`)
  }

  console.log("Seeded Laravel and Next.js launch policies.")
}

try {
  await main()
} catch (error) {
  console.error("Failed to seed App Hosting policies:", error)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
