/**
 * App Hosting Policy Seeder (System)
 *
 * Seeds DetectorRule entries for the MVP App Hosting launch policies
 * (Laravel, Next.js). Migrated from scripts/seed-app-hosting-policy.ts.
 */

import { BaseSeeder, registerSeeder } from "@/lib/seeders"
import type { Prisma } from "@prisma/client"

interface LaunchPolicy {
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

function deriveId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export class AppHostingPolicySeeder extends BaseSeeder {
  static override readonly seederName = "AppHostingPolicy"
  static override readonly classification = "system" as const
  static override readonly runOrder = 30
  static override readonly description =
    "App Hosting framework launch policies (Laravel, Next.js)"

  async seed(): Promise<void> {
    this.log("Seeding App Hosting framework policies...")

    for (const policy of POLICIES) {
      const id = deriveId(policy.name)
      const rule = await this.prisma.detectorRule.upsert({
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

      this.trackUpdated()
      this.log(`Upserted rule ${rule.id} (${rule.name})`)
    }
  }
}

registerSeeder(AppHostingPolicySeeder)
