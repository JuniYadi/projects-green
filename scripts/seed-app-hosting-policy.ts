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
    patternJson: {
      frameworkId: "laravel",
      files: ["artisan", "composer.json"],
      dependencies: ["laravel/framework"],
    },
    implicationsJson: {
      impact: "LAUNCH",
      minConfidence: 0.7,
      framework: "laravel",
      ecosystem: "php",
      defaultPort: 80,
      buildCommand: "composer install --no-dev --optimize-autoloader",
      startCommand: "php artisan serve --host=0.0.0.0 --port=80",
    },
    priority: 100,
  },
  {
    name: "Support Next.js Launch",
    patternJson: {
      frameworkId: "nextjs",
      files: [
        "next.config.js",
        "next.config.mjs",
        "next.config.ts",
        "package.json",
      ],
      dependencies: ["next"],
    },
    implicationsJson: {
      impact: "LAUNCH",
      minConfidence: 0.7,
      framework: "nextjs",
      ecosystem: "node",
      defaultPort: 3000,
      buildCommand: "npm run build",
      startCommand: "npm run start",
    },
    priority: 100,
  },
  {
    name: "Support NestJS Launch",
    patternJson: {
      frameworkId: "nestjs",
      files: ["nest-cli.json", "package.json", "tsconfig.json"],
      dependencies: ["@nestjs/core", "@nestjs/common"],
    },
    implicationsJson: {
      impact: "LAUNCH",
      minConfidence: 0.7,
      framework: "nestjs",
      ecosystem: "node",
      defaultPort: 3000,
      buildCommand: "npm run build",
      startCommand: "npm run start:prod",
    },
    priority: 100,
  },
  {
    name: "Support Vite React Launch",
    patternJson: {
      frameworkId: "react",
      files: [
        "vite.config.js",
        "vite.config.ts",
        "vite.config.mjs",
        "package.json",
      ],
      dependencies: ["react", "react-dom", "vite", "@vitejs/plugin-react"],
    },
    implicationsJson: {
      impact: "LAUNCH",
      minConfidence: 0.65,
      framework: "react",
      ecosystem: "node",
      defaultPort: 3000,
      buildCommand: "npm run build",
      startCommand: "npm run preview",
    },
    priority: 95,
  },
  {
    name: "Support Express Launch",
    patternJson: {
      frameworkId: "express",
      files: ["package.json"],
      dependencies: ["express"],
    },
    implicationsJson: {
      impact: "LAUNCH",
      minConfidence: 0.7,
      framework: "express",
      ecosystem: "node",
      defaultPort: 3000,
      buildCommand: "npm run build",
      startCommand: "npm start",
    },
    priority: 90,
  },
  {
    name: "Support Nuxt Launch",
    patternJson: {
      frameworkId: "nuxt",
      files: ["nuxt.config.js", "nuxt.config.ts", "package.json"],
      dependencies: ["nuxt"],
    },
    implicationsJson: {
      impact: "LAUNCH",
      minConfidence: 0.7,
      framework: "nuxt",
      ecosystem: "node",
      defaultPort: 3000,
      buildCommand: "npm run build",
      startCommand: "node .output/server/index.mjs",
    },
    priority: 95,
  },
  {
    name: "Support Django Launch",
    patternJson: {
      frameworkId: "django",
      files: ["manage.py", "requirements.txt", "Pipfile", "pyproject.toml"],
      dependencies: ["Django", "django"],
    },
    implicationsJson: {
      impact: "LAUNCH",
      minConfidence: 0.7,
      framework: "django",
      ecosystem: "python",
      defaultPort: 8000,
      buildCommand: "pip install -r requirements.txt",
      startCommand: "python manage.py runserver 0.0.0.0:8000",
    },
    priority: 90,
  },
  {
    name: "Support FastAPI Launch",
    patternJson: {
      frameworkId: "fastapi",
      files: ["main.py", "requirements.txt", "Pipfile", "pyproject.toml"],
      dependencies: ["fastapi", "uvicorn"],
    },
    implicationsJson: {
      impact: "LAUNCH",
      minConfidence: 0.7,
      framework: "fastapi",
      ecosystem: "python",
      defaultPort: 8000,
      buildCommand: "pip install -r requirements.txt",
      startCommand: "uvicorn main:app --host 0.0.0.0 --port 8000",
    },
    priority: 90,
  },
  {
    name: "Support Go Gin Launch",
    patternJson: {
      frameworkId: "gin",
      files: ["go.mod", "main.go"],
      dependencies: ["github.com/gin-gonic/gin"],
    },
    implicationsJson: {
      impact: "LAUNCH",
      minConfidence: 0.75,
      framework: "gin",
      ecosystem: "go",
      defaultPort: 8080,
      buildCommand: "go build -o server .",
      startCommand: "./server",
    },
    priority: 90,
  },
]

type RuntimeMappingSeed = {
  frameworkId: string
  frameworkVersion?: string
  runtimeId: string
  runtimeVersion: string
  priority: number
}

const RUNTIME_MAPPINGS: RuntimeMappingSeed[] = [
  {
    frameworkId: "laravel",
    runtimeId: "php",
    runtimeVersion: "8.2",
    priority: 100,
  },
  {
    frameworkId: "nextjs",
    runtimeId: "node",
    runtimeVersion: "20",
    priority: 100,
  },
  {
    frameworkId: "nestjs",
    runtimeId: "node",
    runtimeVersion: "20",
    priority: 100,
  },
  {
    frameworkId: "react",
    runtimeId: "node",
    runtimeVersion: "20",
    priority: 100,
  },
  {
    frameworkId: "express",
    runtimeId: "node",
    runtimeVersion: "20",
    priority: 100,
  },
  {
    frameworkId: "nuxt",
    runtimeId: "node",
    runtimeVersion: "20",
    priority: 100,
  },
  {
    frameworkId: "django",
    runtimeId: "python",
    runtimeVersion: "3.11",
    priority: 100,
  },
  {
    frameworkId: "fastapi",
    runtimeId: "python",
    runtimeVersion: "3.11",
    priority: 100,
  },
  {
    frameworkId: "gin",
    runtimeId: "go",
    runtimeVersion: "1.22",
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

  console.log("Seeding App Hosting runtime mappings...")
  for (const mapping of RUNTIME_MAPPINGS) {
    const existing = await prisma.detectorRuntimeMapping.findFirst({
      where: {
        frameworkId: mapping.frameworkId,
        frameworkVersion: mapping.frameworkVersion ?? null,
        runtimeId: mapping.runtimeId,
      },
    })

    if (existing) {
      await prisma.detectorRuntimeMapping.update({
        where: { id: existing.id },
        data: {
          runtimeVersion: mapping.runtimeVersion,
          priority: mapping.priority,
          isActive: true,
        },
      })
    } else {
      await prisma.detectorRuntimeMapping.create({
        data: {
          frameworkId: mapping.frameworkId,
          frameworkVersion: mapping.frameworkVersion ?? null,
          runtimeId: mapping.runtimeId,
          runtimeVersion: mapping.runtimeVersion,
          priority: mapping.priority,
          isActive: true,
        },
      })
    }
    console.log(
      `  - upserted runtime mapping ${mapping.frameworkId} -> ${mapping.runtimeId} ${mapping.runtimeVersion}`
    )
  }

  console.log("Seeded full framework launch policies and runtime mappings.")
}

try {
  await main()
} catch (error) {
  console.error("Failed to seed App Hosting policies:", error)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
