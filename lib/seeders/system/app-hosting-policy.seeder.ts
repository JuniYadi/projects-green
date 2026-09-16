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

interface RuntimeMappingSeed {
  id: string
  frameworkId: string
  frameworkVersion: string | null
  runtimeId: string
  runtimeVersion: string
  buildVersion: string | null
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
  {
    name: "Support NestJS Launch",
    patternJson: { frameworkId: "nestjs" },
    implicationsJson: {
      impact: "LAUNCH",
      minConfidence: 0.7,
      framework: "nestjs",
    },
    priority: 100,
  },
  {
    name: "Support Vite React Launch",
    patternJson: { frameworkId: "react" },
    implicationsJson: {
      impact: "LAUNCH",
      minConfidence: 0.55,
      framework: "react",
    },
    priority: 95,
  },
  {
    name: "Support Express Launch",
    patternJson: { frameworkId: "express" },
    implicationsJson: {
      impact: "LAUNCH",
      minConfidence: 0.7,
      framework: "express",
    },
    priority: 90,
  },
  {
    name: "Support Nuxt Launch",
    patternJson: { frameworkId: "nuxt" },
    implicationsJson: {
      impact: "LAUNCH",
      minConfidence: 0.7,
      framework: "nuxt",
    },
    priority: 95,
  },
  {
    name: "Support Django Launch",
    patternJson: { frameworkId: "django" },
    implicationsJson: {
      impact: "LAUNCH",
      minConfidence: 0.7,
      framework: "django",
    },
    priority: 90,
  },
  {
    name: "Support FastAPI Launch",
    patternJson: { frameworkId: "fastapi" },
    implicationsJson: {
      impact: "LAUNCH",
      minConfidence: 0.7,
      framework: "fastapi",
    },
    priority: 90,
  },
  {
    name: "Support Go Gin Launch",
    patternJson: { frameworkId: "gin" },
    implicationsJson: {
      impact: "LAUNCH",
      minConfidence: 0.7,
      framework: "gin",
    },
    priority: 90,
  },
]

const RUNTIME_MAPPINGS: RuntimeMappingSeed[] = [
  {
    id: "laravel-php-runtime",
    frameworkId: "laravel",
    frameworkVersion: null,
    runtimeId: "php",
    runtimeVersion: "8.4",
    buildVersion: null,
    priority: 100,
  },
  {
    id: "nextjs-node-runtime",
    frameworkId: "nextjs",
    frameworkVersion: null,
    runtimeId: "node",
    runtimeVersion: "20",
    buildVersion: null,
    priority: 100,
  },
  {
    id: "nestjs-node-runtime",
    frameworkId: "nestjs",
    frameworkVersion: null,
    runtimeId: "node",
    runtimeVersion: "20",
    buildVersion: null,
    priority: 100,
  },
  {
    id: "react-node-runtime",
    frameworkId: "react",
    frameworkVersion: null,
    runtimeId: "node",
    runtimeVersion: "20",
    buildVersion: null,
    priority: 100,
  },
  {
    id: "express-node-runtime",
    frameworkId: "express",
    frameworkVersion: null,
    runtimeId: "node",
    runtimeVersion: "20",
    buildVersion: null,
    priority: 100,
  },
  {
    id: "nuxt-node-runtime",
    frameworkId: "nuxt",
    frameworkVersion: null,
    runtimeId: "node",
    runtimeVersion: "20",
    buildVersion: null,
    priority: 100,
  },
  {
    id: "django-python-runtime",
    frameworkId: "django",
    frameworkVersion: null,
    runtimeId: "python",
    runtimeVersion: "3.11",
    buildVersion: null,
    priority: 100,
  },
  {
    id: "fastapi-python-runtime",
    frameworkId: "fastapi",
    frameworkVersion: null,
    runtimeId: "python",
    runtimeVersion: "3.11",
    buildVersion: null,
    priority: 100,
  },
  {
    id: "gin-go-runtime",
    frameworkId: "gin",
    frameworkVersion: null,
    runtimeId: "go",
    runtimeVersion: "1.22",
    buildVersion: null,
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
    "App Hosting framework launch policies and runtime mappings (Laravel, Next.js)"

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

    for (const mapping of RUNTIME_MAPPINGS) {
      const runtimeMapping = await this.prisma.detectorRuntimeMapping.upsert({
        where: { id: mapping.id },
        update: {
          frameworkId: mapping.frameworkId,
          frameworkVersion: mapping.frameworkVersion,
          runtimeId: mapping.runtimeId,
          runtimeVersion: mapping.runtimeVersion,
          buildVersion: mapping.buildVersion,
          isActive: true,
          priority: mapping.priority,
        },
        create: {
          id: mapping.id,
          frameworkId: mapping.frameworkId,
          frameworkVersion: mapping.frameworkVersion,
          runtimeId: mapping.runtimeId,
          runtimeVersion: mapping.runtimeVersion,
          buildVersion: mapping.buildVersion,
          isActive: true,
          priority: mapping.priority,
        },
      })

      this.trackUpdated()
      this.log(`Upserted runtime mapping ${runtimeMapping.id}`)
    }
  }
}

registerSeeder(AppHostingPolicySeeder)
