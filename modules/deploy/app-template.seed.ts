import { Prisma } from "@prisma/client"
import {
  type AppTemplateBlueprint,
  appTemplateBlueprintSchema,
} from "@/modules/deploy/blueprint/app-template-blueprint.schema"

export interface OfficialAppTemplateSeedItem {
  slug: string
  name: string
  tagline: string
  description: string
  readmeMarkdown?: string
  iconUrl?: string
  category:
    | "AI"
    | "AUTOMATION"
    | "CMS"
    | "DATABASE"
    | "DEVELOPER_TOOLS"
    | "ANALYTICS"
    | "UTILITIES"
  visibility: "PRIVATE" | "PENDING_REVIEW" | "PUBLIC" | "REJECTED" | "UNLISTED"
  version: string
  blueprint: AppTemplateBlueprint
  isOfficial: boolean
  isFeatured: boolean
  installCount: number
  priceMonthly?: Prisma.Decimal | number
  currency: string
}

export const OFFICIAL_APP_TEMPLATES: readonly OfficialAppTemplateSeedItem[] = [
  {
    slug: "n8n",
    name: "n8n",
    tagline: "Fair-code workflow automation platform",
    description:
      "n8n is an extendable workflow automation tool that enables you to connect anything to everything with self-hosted nodes and integrations.",
    readmeMarkdown:
      "# n8n\n\nSelf-hosted workflow automation platform with support for hundreds of integrations.",
    iconUrl: "https://assets.pfnapp.com/templates/n8n.svg",
    category: "AUTOMATION",
    visibility: "PUBLIC",
    version: "1.0.0",
    isOfficial: true,
    isFeatured: true,
    installCount: 1420,
    priceMonthly: 0,
    currency: "USD",
    blueprint: appTemplateBlueprintSchema.parse({
      version: "1.0.0",
      runtime: {
        image: "docker.io/n8nio/n8n:latest",
        defaultPort: 5678,
        healthCheckPath: "/healthz",
        runAsNonRoot: true,
      },
      resources: {
        defaultCpu: 500,
        defaultMemory: 512,
        minCpu: 250,
        minMemory: 256,
      },
      storage: {
        enabled: true,
        mountPath: "/home/node/.n8n",
        sizeGbDefault: 5,
      },
      dependencies: [
        {
          serviceType: "POSTGRESQL",
          alias: "db",
          envPrefix: "DB",
        },
      ],
      envSchema: [
        {
          key: "N8N_ENCRYPTION_KEY",
          label: "Encryption Key",
          description: "Key used to encrypt credentials in n8n database",
          required: true,
          isSecret: true,
          dataType: "string",
          generateRandomHex: 32,
        },
        {
          key: "N8N_PORT",
          label: "Port",
          defaultValue: "5678",
          required: true,
          isSecret: false,
          dataType: "number",
        },
      ],
    }),
  },
  {
    slug: "hermes",
    name: "Hermes",
    tagline: "AI Agent workspace and interactive canvas",
    description:
      "Hermes provides an autonomous multi-agent workspace with conversational memory, dynamic workflows, and unified LLM orchestration.",
    readmeMarkdown:
      "# Hermes\n\nHigh-performance AI agent canvas built for multi-model orchestrations.",
    iconUrl: "https://assets.pfnapp.com/templates/hermes.svg",
    category: "AI",
    visibility: "PUBLIC",
    version: "1.0.0",
    isOfficial: true,
    isFeatured: true,
    installCount: 980,
    priceMonthly: 0,
    currency: "USD",
    blueprint: appTemplateBlueprintSchema.parse({
      version: "1.0.0",
      runtime: {
        image: "nousresearch/hermes-agent:v2026.8.18",
        defaultPort: 8642,
        additionalPorts: [{ port: 9119, name: "dashboard" }],
        deploymentType: "statefulset",
        healthCheckPath: "/healthz",
        runAsNonRoot: true,
      },
      resources: {
        defaultCpu: 500,
        defaultMemory: 1024,
        minCpu: 250,
        minMemory: 256,
      },
      storage: {
        enabled: true,
        mountPath: "/opt/data",
        sizeGbDefault: 2,
      },
      dependencies: [],
      envSchema: [
        {
          key: "ANTHROPIC_API_KEY",
          label: "Anthropic API Key",
          description: "Provider API key used by Hermes to reach the LLM",
          required: true,
          isSecret: true,
          dataType: "string",
        },
        {
          key: "HERMES_UID",
          label: "Hermes UID",
          description:
            "Alias PUID. Only needed when the mounted volume isn't already owned by UID 10000.",
          defaultValue: "10000",
          required: false,
          isSecret: false,
          dataType: "number",
        },
        {
          key: "HERMES_GID",
          label: "Hermes GID",
          description:
            "Alias PGID. Only needed when the mounted volume isn't already owned by UID 10000.",
          defaultValue: "10000",
          required: false,
          isSecret: false,
          dataType: "number",
        },
        {
          key: "API_SERVER_ENABLED",
          label: "API Server Enabled",
          description:
            "Set to true to enable API ingress. Requires API_SERVER_HOST and API_SERVER_KEY.",
          defaultValue: "true",
          required: false,
          isSecret: false,
          dataType: "boolean",
        },
        {
          key: "API_SERVER_HOST",
          label: "API Server Host",
          description:
            "Bind host for the API server, e.g. 0.0.0.0. Only needed if API ingress is enabled.",
          defaultValue: "0.0.0.0",
          required: false,
          isSecret: false,
          dataType: "string",
        },
        {
          key: "API_SERVER_KEY",
          label: "API Server Key",
          description:
            "Secret key (min 8 chars) securing the API server. Only needed if API ingress is enabled.",
          required: false,
          isSecret: true,
          dataType: "string",
        },
      ],
    }),
  },
  {
    slug: "9router",
    name: "9router",
    tagline: "High-throughput LLM gateway and router",
    description:
      "Unified OpenAI-compatible proxy with fallback routing, load balancing, rate limiting, and cost tracking across AI providers.",
    readmeMarkdown:
      "# 9router\n\nUltra-low-latency AI routing gateway for production LLM traffic.",
    iconUrl: "/app-hosting/icons/9router.svg",
    category: "AI",
    visibility: "PUBLIC",
    version: "1.0.0",
    isOfficial: true,
    isFeatured: true,
    installCount: 1850,
    priceMonthly: 0,
    currency: "USD",
    blueprint: appTemplateBlueprintSchema.parse({
      version: "1.0.0",
      runtime: {
        image: "registry.pfnapp.com/ninerouter:latest",
        defaultPort: 8080,
        healthCheckPath: "/health",
        runAsNonRoot: true,
      },
      resources: {
        defaultCpu: 250,
        defaultMemory: 256,
        minCpu: 100,
        minMemory: 128,
      },
      dependencies: [
        {
          serviceType: "REDIS",
          alias: "redis",
          envPrefix: "REDIS",
        },
      ],
      envSchema: [
        {
          key: "ROUTER_MASTER_KEY",
          label: "Master API Key",
          description: "Admin key for gateway configuration and key issuance",
          required: true,
          isSecret: true,
          dataType: "string",
          generateRandomHex: 32,
        },
      ],
    }),
  },
  {
    slug: "umami",
    name: "Umami",
    tagline: "Privacy-focused, lightweight open-source web analytics",
    description:
      "Umami is an open-source, privacy-friendly alternative to Google Analytics with no cookies and GDPR compliance out of the box.",
    readmeMarkdown:
      "# Umami Analytics\n\nSelf-hosted, real-time website analytics without tracking user identity.",
    iconUrl: "https://assets.pfnapp.com/templates/umami.svg",
    category: "ANALYTICS",
    visibility: "PUBLIC",
    version: "1.0.0",
    isOfficial: true,
    isFeatured: true,
    installCount: 2200,
    priceMonthly: 0,
    currency: "USD",
    blueprint: appTemplateBlueprintSchema.parse({
      version: "1.0.0",
      runtime: {
        image: "docker.io/umami-software/umami:postgresql-latest",
        defaultPort: 3000,
        healthCheckPath: "/api/heartbeat",
        runAsNonRoot: true,
      },
      resources: {
        defaultCpu: 250,
        defaultMemory: 256,
        minCpu: 100,
        minMemory: 128,
      },
      dependencies: [
        {
          serviceType: "POSTGRESQL",
          alias: "db",
          envPrefix: "DATABASE",
        },
      ],
      envSchema: [
        {
          key: "APP_SECRET",
          label: "App Secret",
          description: "Hash secret for anonymizing visitor IPs",
          required: true,
          isSecret: true,
          dataType: "string",
          generateRandomHex: 32,
        },
      ],
    }),
  },
  {
    slug: "wordpress",
    name: "WordPress",
    tagline: "World's most popular open-source content management system",
    description:
      "WordPress is web publishing software you can use to create a beautiful website, blog, or community with thousands of plugins and themes.",
    readmeMarkdown:
      "# WordPress\n\nExtensible CMS and publishing system powered by PHP and MySQL.",
    iconUrl: "https://assets.pfnapp.com/templates/wordpress.svg",
    category: "CMS",
    visibility: "PUBLIC",
    version: "1.0.0",
    isOfficial: true,
    isFeatured: true,
    installCount: 3100,
    priceMonthly: 0,
    currency: "USD",
    blueprint: appTemplateBlueprintSchema.parse({
      version: "1.0.0",
      runtime: {
        image: "docker.io/library/wordpress:php8.3-apache",
        defaultPort: 80,
        healthCheckPath: "/wp-login.php",
        runAsNonRoot: false,
      },
      resources: {
        defaultCpu: 500,
        defaultMemory: 512,
        minCpu: 250,
        minMemory: 256,
      },
      storage: {
        enabled: true,
        mountPath: "/var/www/html",
        sizeGbDefault: 10,
      },
      dependencies: [
        {
          serviceType: "MYSQL",
          alias: "mysql",
          envPrefix: "WORDPRESS_DB",
        },
      ],
      envSchema: [
        {
          key: "WORDPRESS_TABLE_PREFIX",
          label: "Table Prefix",
          defaultValue: "wp_",
          required: false,
          isSecret: false,
          dataType: "string",
        },
      ],
    }),
  },
]

export interface SeedAppTemplatesOptions {
  prisma: {
    appTemplate: {
      upsert: (args: {
        where: { slug: string }
        create: Prisma.AppTemplateCreateInput
        update: Prisma.AppTemplateUpdateInput
      }) => Promise<unknown>
    }
  }
}

export async function seedOfficialAppTemplates(
  options: SeedAppTemplatesOptions
): Promise<{ count: number; slugs: string[] }> {
  const seededSlugs: string[] = []

  for (const item of OFFICIAL_APP_TEMPLATES) {
    const validatedBlueprint = appTemplateBlueprintSchema.parse(item.blueprint)

    const payload: Prisma.AppTemplateCreateInput = {
      organizationId: null,
      slug: item.slug,
      name: item.name,
      tagline: item.tagline,
      description: item.description,
      readmeMarkdown: item.readmeMarkdown,
      iconUrl: item.iconUrl,
      category: item.category,
      visibility: item.visibility,
      version: item.version,
      blueprintJson: validatedBlueprint as unknown as Prisma.InputJsonValue,
      isOfficial: item.isOfficial,
      isFeatured: item.isFeatured,
      installCount: item.installCount,
      priceMonthly:
        item.priceMonthly !== undefined
          ? new Prisma.Decimal(item.priceMonthly.toString())
          : null,
      currency: item.currency,
    }

    await options.prisma.appTemplate.upsert({
      where: { slug: item.slug },
      create: payload,
      update: {
        name: payload.name,
        tagline: payload.tagline,
        description: payload.description,
        readmeMarkdown: payload.readmeMarkdown,
        iconUrl: payload.iconUrl,
        category: payload.category,
        visibility: payload.visibility,
        version: payload.version,
        blueprintJson: payload.blueprintJson,
        isOfficial: payload.isOfficial,
        isFeatured: payload.isFeatured,
        priceMonthly: payload.priceMonthly,
        currency: payload.currency,
      },
    })

    seededSlugs.push(item.slug)
  }

  return {
    count: seededSlugs.length,
    slugs: seededSlugs,
  }
}
