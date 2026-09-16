import { expect, mock, test } from "bun:test"

const detectorRuleUpsert = mock(
  async ({ create }: { create: unknown }) => create
)
const detectorRuntimeMappingUpsert = mock(
  async ({ create }: { create: unknown }) => create
)

mock.module("@/lib/prisma", () => ({
  prisma: {
    detectorRule: { upsert: detectorRuleUpsert },
    detectorRuntimeMapping: { upsert: detectorRuntimeMappingUpsert },
  },
}))

const { AppHostingPolicySeeder } = await import("./app-hosting-policy.seeder")

test("seeds wildcard framework policies and runtime mappings", async () => {
  await new AppHostingPolicySeeder().seed()

  expect(detectorRuleUpsert).toHaveBeenCalledTimes(9)
  expect(detectorRuleUpsert).toHaveBeenNthCalledWith(1, {
    where: { id: "support-laravel-launch" },
    update: {
      name: "Support Laravel Launch",
      patternJson: { frameworkId: "laravel" },
      implicationsJson: {
        impact: "LAUNCH",
        minConfidence: 0.8,
        framework: "laravel",
      },
      priority: 100,
      isActive: true,
    },
    create: {
      id: "support-laravel-launch",
      name: "Support Laravel Launch",
      patternJson: { frameworkId: "laravel" },
      implicationsJson: {
        impact: "LAUNCH",
        minConfidence: 0.8,
        framework: "laravel",
      },
      priority: 100,
      isActive: true,
    },
  })
  expect(detectorRuleUpsert).toHaveBeenNthCalledWith(2, {
    where: { id: "support-next-js-launch" },
    update: {
      name: "Support Next.js Launch",
      patternJson: { frameworkId: "nextjs" },
      implicationsJson: {
        impact: "LAUNCH",
        minConfidence: 0.8,
        framework: "nextjs",
      },
      priority: 100,
      isActive: true,
    },
    create: {
      id: "support-next-js-launch",
      name: "Support Next.js Launch",
      patternJson: { frameworkId: "nextjs" },
      implicationsJson: {
        impact: "LAUNCH",
        minConfidence: 0.8,
        framework: "nextjs",
      },
      priority: 100,
      isActive: true,
    },
  })
  expect(detectorRuleUpsert).toHaveBeenNthCalledWith(3, {
    where: { id: "support-nestjs-launch" },
    update: {
      name: "Support NestJS Launch",
      patternJson: { frameworkId: "nestjs" },
      implicationsJson: {
        impact: "LAUNCH",
        minConfidence: 0.7,
        framework: "nestjs",
      },
      priority: 100,
      isActive: true,
    },
    create: {
      id: "support-nestjs-launch",
      name: "Support NestJS Launch",
      patternJson: { frameworkId: "nestjs" },
      implicationsJson: {
        impact: "LAUNCH",
        minConfidence: 0.7,
        framework: "nestjs",
      },
      priority: 100,
      isActive: true,
    },
  })
  expect(detectorRuleUpsert).toHaveBeenNthCalledWith(4, {
    where: { id: "support-vite-react-launch" },
    update: {
      name: "Support Vite React Launch",
      patternJson: { frameworkId: "react" },
      implicationsJson: {
        impact: "LAUNCH",
        minConfidence: 0.55,
        framework: "react",
      },
      priority: 95,
      isActive: true,
    },
    create: {
      id: "support-vite-react-launch",
      name: "Support Vite React Launch",
      patternJson: { frameworkId: "react" },
      implicationsJson: {
        impact: "LAUNCH",
        minConfidence: 0.55,
        framework: "react",
      },
      priority: 95,
      isActive: true,
    },
  })

  expect(detectorRuntimeMappingUpsert).toHaveBeenCalledTimes(9)
  expect(detectorRuntimeMappingUpsert).toHaveBeenCalledWith({
    where: { id: "laravel-php-runtime" },
    update: {
      frameworkId: "laravel",
      frameworkVersion: null,
      runtimeId: "php",
      runtimeVersion: "8.4",
      buildVersion: null,
      isActive: true,
      priority: 100,
    },
    create: {
      id: "laravel-php-runtime",
      frameworkId: "laravel",
      frameworkVersion: null,
      runtimeId: "php",
      runtimeVersion: "8.4",
      buildVersion: null,
      isActive: true,
      priority: 100,
    },
  })
})
