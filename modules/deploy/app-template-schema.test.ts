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

  it("contains 7 official idempotent template definitions", () => {
    expect(OFFICIAL_APP_TEMPLATES.length).toBe(7)
    const slugs = OFFICIAL_APP_TEMPLATES.map((t) => t.slug)
    expect(slugs).toEqual([
      "n8n",
      "hermes",
      "9router",
      "openclaw",
      "omniroute",
      "umami",
      "wordpress",
    ])
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
    expect(runtime?.image).toBe("ghcr.io/pfnapp/hermes-agent:v2026.9.24")
    expect(runtime?.defaultPort).toBe(9119)
    expect(runtime?.healthCheckPath).toBeUndefined()
    expect(runtime?.deploymentType).toBe("statefulset")
    expect(runtime?.additionalPorts).toEqual([])

    expect(hermes?.blueprint.storage?.mountPath).toBe("/opt/data")
    expect(hermes?.blueprint.storage?.fsGroup).toBe(10000)

    expect(hermes?.blueprint.dependencies).toEqual([])

    const envKeys = hermes?.blueprint.envSchema?.map((e) => e.key)
    expect(envKeys).toEqual([
      "ANTHROPIC_API_KEY",
      "HERMES_UID",
      "HERMES_GID",
      "API_SERVER_ENABLED",
      "API_SERVER_HOST",
      "API_SERVER_KEY",
      "HERMES_DASHBOARD",
      "HERMES_DASHBOARD_BASIC_AUTH_USERNAME",
      "HERMES_DASHBOARD_BASIC_AUTH_PASSWORD",
      "HERMES_DASHBOARD_BASIC_AUTH_SECRET",
    ])

    const apiKeyEnv = hermes?.blueprint.envSchema?.find(
      (e) => e.key === "ANTHROPIC_API_KEY"
    )
    expect(apiKeyEnv?.required).toBe(false)
    expect(apiKeyEnv?.isSecret).toBe(true)
    for (const key of [
      "HERMES_UID",
      "HERMES_GID",
      "API_SERVER_ENABLED",
      "API_SERVER_HOST",
      "API_SERVER_KEY",
    ]) {
      const env = hermes?.blueprint.envSchema?.find((e) => e.key === key)
      expect(env?.required).toBe(false)
    }

    const apiServerKeyEnv = hermes?.blueprint.envSchema?.find(
      (e) => e.key === "API_SERVER_KEY"
    )
    expect(apiServerKeyEnv?.isSecret).toBe(true)
  })

  it("pins the 9router template to the Docker-verified decolua image and its secret contract", () => {
    const ninerouter = OFFICIAL_APP_TEMPLATES.find((t) => t.slug === "9router")
    expect(ninerouter).toBeDefined()
    const runtime = ninerouter?.blueprint.runtime
    expect(runtime?.image).toBe("ghcr.io/pfnapp/9router:0.5.86")
    expect(runtime?.defaultPort).toBe(20128)
    expect(runtime?.deploymentType).toBe("statefulset")

    expect(ninerouter?.blueprint.storage?.mountPath).toBe("/app/data")
    expect(ninerouter?.blueprint.scaling?.maxReplicas).toBe(1)
    expect(ninerouter?.blueprint.scaling?.allowAutoscale).toBe(false)

    expect(ninerouter?.blueprint.dependencies).toEqual([])

    for (const key of [
      "JWT_SECRET",
      "API_KEY_SECRET",
      "MACHINE_ID_SALT",
      "INITIAL_PASSWORD",
    ]) {
      const env = ninerouter?.blueprint.envSchema?.find((e) => e.key === key)
      expect(env?.isSecret).toBe(true)
      expect(env?.required).toBe(true)
      expect(env?.generateRandomHex).toBeGreaterThan(0)
      expect(env?.defaultValue).toBeUndefined()
    }

    const requireApiKey = ninerouter?.blueprint.envSchema?.find(
      (e) => e.key === "REQUIRE_API_KEY"
    )
    expect(requireApiKey?.defaultValue).toBe("true")
  })

  it("pins the openclaw template to the hardened image and gateway token contract", () => {
    const openclaw = OFFICIAL_APP_TEMPLATES.find((t) => t.slug === "openclaw")
    expect(openclaw).toBeDefined()
    const runtime = openclaw?.blueprint.runtime
    expect(runtime?.image).toBe("ghcr.io/pfnapp/openclaw:2026.9.6")
    expect(runtime?.defaultPort).toBe(18789)
    expect(runtime?.deploymentType).toBe("statefulset")
    expect(runtime?.runAsNonRoot).toBe(true)

    expect(openclaw?.blueprint.storage?.mountPath).toBe("/home/node/.openclaw")
    expect(openclaw?.blueprint.scaling?.maxReplicas).toBe(1)
    expect(openclaw?.blueprint.scaling?.allowAutoscale).toBe(false)
    expect(openclaw?.blueprint.access?.mode).toBe("password-only")
    expect(openclaw?.blueprint.access?.fields?.[0]?.key).toBe(
      "OPENCLAW_GATEWAY_TOKEN"
    )

    const tokenEnv = openclaw?.blueprint.envSchema?.find(
      (e) => e.key === "OPENCLAW_GATEWAY_TOKEN"
    )
    expect(tokenEnv?.isSecret).toBe(true)
    expect(tokenEnv?.required).toBe(true)
    expect(tokenEnv?.generateRandomHex).toBe(32)
  })

  it("pins the omniroute template to the hardened image and security contract", () => {
    const omniroute = OFFICIAL_APP_TEMPLATES.find((t) => t.slug === "omniroute")
    expect(omniroute).toBeDefined()
    const runtime = omniroute?.blueprint.runtime
    expect(runtime?.image).toBe("ghcr.io/pfnapp/omniroute:3.8.50")
    expect(runtime?.defaultPort).toBe(20128)
    expect(runtime?.deploymentType).toBe("statefulset")
    expect(runtime?.runAsNonRoot).toBe(true)

    expect(omniroute?.blueprint.storage?.mountPath).toBe("/app/data")
    expect(omniroute?.blueprint.scaling?.maxReplicas).toBe(1)
    expect(omniroute?.blueprint.scaling?.allowAutoscale).toBe(false)
    expect(omniroute?.blueprint.access?.mode).toBe("password-only")
    expect(omniroute?.blueprint.access?.fields?.[0]?.key).toBe(
      "INITIAL_PASSWORD"
    )

    for (const key of ["JWT_SECRET", "API_KEY_SECRET", "INITIAL_PASSWORD"]) {
      const env = omniroute?.blueprint.envSchema?.find((e) => e.key === key)
      expect(env?.isSecret).toBe(true)
      expect(env?.required).toBe(true)
      expect(env?.generateRandomHex).toBeGreaterThan(0)
    }
  })

  it("pins the n8n template to the Docker-verified image on a single-writer volume", () => {
    const n8n = OFFICIAL_APP_TEMPLATES.find((t) => t.slug === "n8n")
    expect(n8n).toBeDefined()
    expect(n8n?.blueprint.runtime.image).toBe("docker.io/n8nio/n8n:2.38.7")
    expect(n8n?.blueprint.runtime.deploymentType).toBe("statefulset")
    expect(n8n?.blueprint.runtime.healthCheckPath).toBe("/healthz")
    expect(n8n?.blueprint.storage?.mountPath).toBe("/home/node/.n8n")
    expect(n8n?.blueprint.scaling?.maxReplicas).toBe(1)
    expect(n8n?.blueprint.dependencies).toEqual([
      { serviceType: "POSTGRESQL", alias: "db", envPrefix: "DB" },
    ])

    const dbType = n8n?.blueprint.envSchema?.find((e) => e.key === "DB_TYPE")
    expect(dbType?.defaultValue).toBe("postgresdb")
  })

  it("never ships a bare :latest image tag in an official template", () => {
    for (const template of OFFICIAL_APP_TEMPLATES) {
      expect(template.blueprint.runtime.image).not.toEndWith(":latest")
    }
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

    expect(result.count).toBe(7)
    expect(result.slugs).toEqual([
      "n8n",
      "hermes",
      "9router",
      "openclaw",
      "omniroute",
      "umami",
      "wordpress",
    ])
    expect(upserted.length).toBe(7)

    for (const op of upserted) {
      expect(op.create.isOfficial).toBe(true)
      expect(op.create.visibility).toBe("PUBLIC")
      expect(op.create.organizationId).toBeNull()
      expect(typeof op.create.blueprintJson).toBe("object")
    }
  })
})
