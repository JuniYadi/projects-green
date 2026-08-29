import { describe, expect, it } from "bun:test"
import {
  AppTemplateCategory,
  AppTemplateVisibility,
  Prisma,
} from "@prisma/client"
import {
  OFFICIAL_APP_TEMPLATES,
  seedOfficialAppTemplates,
} from "@/modules/deploy/app-template.seed"
import { appTemplateBlueprintSchema } from "@/modules/deploy/blueprint/app-template-blueprint.schema"

describe("AppTemplate Prisma Schema & Seed", () => {
  it("defines all required AppTemplateCategory enum members", () => {
    const expectedCategories = [
      "AI",
      "AUTOMATION",
      "CMS",
      "DATABASE",
      "DEVELOPER_TOOLS",
      "ANALYTICS",
      "UTILITIES",
    ] as const

    for (const cat of expectedCategories) {
      expect(AppTemplateCategory[cat]).toBe(cat)
    }
  })

  it("defines all required AppTemplateVisibility enum members", () => {
    const expectedVisibilities = [
      "PRIVATE",
      "PENDING_REVIEW",
      "PUBLIC",
      "REJECTED",
      "UNLISTED",
    ] as const

    for (const vis of expectedVisibilities) {
      expect(AppTemplateVisibility[vis]).toBe(vis)
    }
  })

  it("contains 5 official idempotent template definitions", () => {
    expect(OFFICIAL_APP_TEMPLATES.length).toBe(5)
    const slugs = OFFICIAL_APP_TEMPLATES.map((t) => t.slug)
    expect(slugs).toEqual(["n8n", "hermes", "9router", "umami", "wordpress"])
  })

  it("validates that all official template blueprints conform to AppTemplateBlueprint schema", () => {
    for (const template of OFFICIAL_APP_TEMPLATES) {
      const parsed = appTemplateBlueprintSchema.safeParse(template.blueprint)
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data.version).toBe("1.0.0")
        expect(parsed.data.runtime.image.length).toBeGreaterThan(0)
        expect(parsed.data.runtime.defaultPort).toBeGreaterThan(0)
        expect(parsed.data.resources.defaultCpu).toBeGreaterThanOrEqual(100)
        expect(parsed.data.resources.defaultMemory).toBeGreaterThanOrEqual(128)
      }
    }
  })

  it("corrects the Hermes template to match the real nousresearch/hermes-agent product", () => {
    const hermes = OFFICIAL_APP_TEMPLATES.find((t) => t.slug === "hermes")
    expect(hermes).toBeDefined()
    const runtime = hermes?.blueprint.runtime
    expect(runtime?.image).toBe("nousresearch/hermes-agent:v2026.8.18")
    expect(runtime?.defaultPort).toBe(8642)
    expect(runtime?.healthCheckPath).toBe("/healthz")
    expect(runtime?.deploymentType).toBe("statefulset")
    expect(runtime?.additionalPorts).toEqual([
      { port: 9119, name: "dashboard" },
    ])

    expect(hermes?.blueprint.storage?.mountPath).toBe("/opt/data")

    expect(hermes?.blueprint.dependencies).toEqual([])

    const envKeys = hermes?.blueprint.envSchema.map((e) => e.key)
    expect(envKeys).toEqual([
      "ANTHROPIC_API_KEY",
      "HERMES_UID",
      "HERMES_GID",
      "API_SERVER_ENABLED",
      "API_SERVER_HOST",
      "API_SERVER_KEY",
    ])

    const apiKeyEnv = hermes?.blueprint.envSchema.find(
      (e) => e.key === "ANTHROPIC_API_KEY"
    )
    expect(apiKeyEnv?.required).toBe(true)
    expect(apiKeyEnv?.isSecret).toBe(true)

    for (const key of [
      "HERMES_UID",
      "HERMES_GID",
      "API_SERVER_ENABLED",
      "API_SERVER_HOST",
      "API_SERVER_KEY",
    ]) {
      const env = hermes?.blueprint.envSchema.find((e) => e.key === key)
      expect(env?.required).toBe(false)
    }

    const apiServerKeyEnv = hermes?.blueprint.envSchema.find(
      (e) => e.key === "API_SERVER_KEY"
    )
    expect(apiServerKeyEnv?.isSecret).toBe(true)
  })

  it("executes seedOfficialAppTemplates idempotently against mock Prisma delegate", async () => {
    const upserted: Array<{
      slug: string
      create: Prisma.AppTemplateCreateInput
      update: Prisma.AppTemplateUpdateInput
    }> = []

    const mockPrisma = {
      appTemplate: {
        upsert: async (args: {
          where: { slug: string }
          create: Prisma.AppTemplateCreateInput
          update: Prisma.AppTemplateUpdateInput
        }) => {
          upserted.push({
            slug: args.where.slug,
            create: args.create,
            update: args.update,
          })
          return { id: `tpl_${args.where.slug}`, ...args.create }
        },
      },
    }

    const result = await seedOfficialAppTemplates({ prisma: mockPrisma })

    expect(result.count).toBe(5)
    expect(result.slugs).toEqual([
      "n8n",
      "hermes",
      "9router",
      "umami",
      "wordpress",
    ])
    expect(upserted.length).toBe(5)

    for (const op of upserted) {
      expect(op.create.isOfficial).toBe(true)
      expect(op.create.visibility).toBe("PUBLIC")
      expect(op.create.organizationId).toBeNull()
      expect(typeof op.create.blueprintJson).toBe("object")
    }
  })
})
