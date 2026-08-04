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

test("seeds wildcard Laravel runtime mapping for PHP 8.4", async () => {
  await new AppHostingPolicySeeder().seed()

  expect(detectorRuleUpsert).toHaveBeenCalledTimes(2)
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
