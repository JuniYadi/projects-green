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
