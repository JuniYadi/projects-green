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
    iconUrl: "/app-hosting/icons/n8n.svg",
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
        image: "docker.io/n8nio/n8n:2.38.7",
        defaultPort: 5678,
        healthCheckPath: "/healthz",
        deploymentType: "statefulset",
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
      scaling: {
        allowAutoscale: false,
        maxReplicas: 1,
        advisoryNote:
          "The n8n settings file lives on a single-writer RWO volume; replicas stay at 1 until queue mode and an RWX class are configured.",
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
        {
          key: "DB_TYPE",
          label: "Database Type",
          description:
            "n8n persists workflows and credentials in the claimed PostgreSQL stock, not in SQLite.",
          defaultValue: "postgresdb",
          required: true,
          isSecret: false,
          dataType: "string",
          isFixed: true,
          isHidden: true,
        },
        {
          key: "N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS",
          label: "Enforce Settings File Permissions",
          description:
            "Restricts the permissions of the settings file on the persistent volume.",
          defaultValue: "true",
          required: true,
          isSecret: false,
          dataType: "boolean",
          isFixed: true,
          isHidden: true,
        },
        {
          key: "GENERIC_TIMEZONE",
          label: "Timezone",
          description:
            "Timezone used by Schedule and Cron nodes, e.g. Asia/Jakarta.",
          defaultValue: "UTC",
          required: true,
          isSecret: false,
          dataType: "string",
        },
        {
          key: "TZ",
          label: "System Timezone",
          description:
            "Timezone of the container itself. Keep it aligned with the n8n timezone.",
          defaultValue: "UTC",
          required: true,
          isSecret: false,
          dataType: "string",
        },
      ],
    }),
  },
  {
    slug: "hermes",
    name: "Hermes Agent",
    tagline: "Autonomous AI agent gateway by Nous Research",
    description:
      "Hermes Agent is Nous Research's autonomous AI agent gateway with persistent memory, tool orchestration, and optional API and web dashboard.",
    readmeMarkdown:
      "# Hermes Agent\n\nManaged deployment of Nous Research's autonomous AI agent gateway with persistent storage at `/opt/data` and supervised gateway runtime.",
    iconUrl: "/app-hosting/icons/hermes.svg",
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
        image: "ghcr.io/pfnapp/hermes-agent:v2026.9.24",
        command: ["hermes", "gateway", "run"],
        defaultPort: 9119,
        additionalPorts: [],
        deploymentType: "statefulset",
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
        fsGroup: 10000,
      },
      dependencies: [],
      envSchema: [
        {
          key: "ANTHROPIC_API_KEY",
          label: "Anthropic API Key",
          description:
            "Provider API key used by Hermes to reach the LLM. Can be provided now or configured later.",
          required: false,
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
          isFixed: true,
          isHidden: true,
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
          isFixed: true,
          isHidden: true,
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
        {
          key: "HERMES_DASHBOARD",
          label: "Hermes Dashboard",
          description:
            "Starts the supervised web dashboard service on port 9119 inside the container.",
          defaultValue: "true",
          required: false,
          isSecret: false,
          dataType: "boolean",
        },
        {
          key: "HERMES_DASHBOARD_BASIC_AUTH_USERNAME",
          label: "Dashboard Username",
          description: "Username for the dashboard sign-in form.",
          defaultValue: "admin",
          required: false,
          isSecret: false,
          dataType: "string",
        },
        {
          key: "HERMES_DASHBOARD_BASIC_AUTH_PASSWORD",
          label: "Dashboard Password",
          description: "Password for the dashboard sign-in form.",
          required: false,
          isSecret: true,
          dataType: "string",
        },
        {
          key: "HERMES_DASHBOARD_BASIC_AUTH_SECRET",
          label: "Dashboard Session Secret",
          description:
            "Signing key for dashboard basic-auth session cookies. Generates a random key if left empty.",
          required: false,
          isSecret: true,
          dataType: "string",
          generateRandomHex: 32,
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
        image: "ghcr.io/pfnapp/9router:0.5.86",
        defaultPort: 20128,
        deploymentType: "statefulset",
        runAsNonRoot: false,
      },
      access: {
        mode: "password-only",
        title: "Mulai menggunakan 9router",
        loginPath: "/login",
        fields: [
          {
            id: "initial-password",
            label: "Password awal",
            source: "env",
            key: "INITIAL_PASSWORD",
            secret: true,
          },
        ],
        steps: [
          {
            text: "Lihat dan salin password awal di PFNApp.",
            action: { type: "reveal-field", fieldId: "initial-password" },
          },
          { text: "Buka dashboard 9router.", action: { type: "open-app" } },
          { text: "Masukkan password tersebut. Tidak perlu username." },
        ],
      },
      resources: {
        defaultCpu: 250,
        defaultMemory: 256,
        minCpu: 100,
        minMemory: 128,
      },
      storage: {
        enabled: true,
        mountPath: "/app/data",
        sizeGbDefault: 10,
      },
      scaling: {
        allowAutoscale: false,
        maxReplicas: 1,
        advisoryNote:
          "9router stores its state in SQLite on a single-writer RWO volume; replicas stay at 1.",
      },
      dependencies: [],
      envSchema: [
        {
          key: "DATA_DIR",
          label: "Data Directory",
          description:
            "Directory holding the SQLite database and its backups. Must match the mounted volume.",
          defaultValue: "/app/data",
          required: true,
          isSecret: false,
          dataType: "string",
          isFixed: true,
          isHidden: true,
        },
        {
          key: "PORT",
          label: "Port",
          defaultValue: "20128",
          required: true,
          isSecret: false,
          dataType: "number",
          isFixed: true,
          isHidden: true,
        },
        {
          key: "HOSTNAME",
          label: "Bind Host",
          defaultValue: "0.0.0.0",
          required: true,
          isSecret: false,
          dataType: "string",
          isFixed: true,
          isHidden: true,
        },
        {
          key: "NODE_ENV",
          label: "Node Environment",
          defaultValue: "production",
          required: true,
          isSecret: false,
          dataType: "string",
          isFixed: true,
          isHidden: true,
        },
        {
          key: "JWT_SECRET",
          label: "JWT Secret",
          description:
            "Signs dashboard sessions. Generated per instance; never reuse the upstream default.",
          required: true,
          isSecret: true,
          dataType: "string",
          generateRandomHex: 32,
        },
        {
          key: "API_KEY_SECRET",
          label: "API Key Secret",
          description:
            "HMAC secret for issued API keys. Generated per instance; never reuse the upstream default.",
          required: true,
          isSecret: true,
          dataType: "string",
          generateRandomHex: 32,
        },
        {
          key: "MACHINE_ID_SALT",
          label: "Machine ID Salt",
          description:
            "Salt for machine identity hashing. Generated per instance; never reuse the upstream default.",
          required: true,
          isSecret: true,
          dataType: "string",
          generateRandomHex: 32,
        },
        {
          key: "INITIAL_PASSWORD",
          label: "Initial Admin Password",
          description:
            "First-login password for the dashboard. Replaces the upstream default of 123456.",
          required: true,
          isSecret: true,
          dataType: "string",
          generateRandomHex: 8,
        },
        {
          key: "REQUIRE_API_KEY",
          label: "Require API Key",
          description:
            "Rejects unauthenticated inference calls. Keep enabled on any public ingress.",
          defaultValue: "true",
          required: true,
          isSecret: false,
          dataType: "boolean",
        },
        {
          key: "AUTH_COOKIE_SECURE",
          label: "Secure Auth Cookie",
          description:
            "Marks the session cookie secure. Keep enabled when serving over HTTPS.",
          defaultValue: "true",
          required: true,
          isSecret: false,
          dataType: "boolean",
        },
      ],
    }),
  },
  {
    slug: "openclaw",
    name: "OpenClaw",
    tagline: "Autonomous AI agent runtime and multi-channel gateway",
    description:
      "OpenClaw is an extensible agent runtime supporting multi-provider LLMs, browser execution, skills, and multi-channel integrations with integrated Control UI.",
    readmeMarkdown:
      "# OpenClaw\n\nHardened deployment of OpenClaw autonomous AI agent gateway with persistent home directory at `/home/node/.openclaw` and integrated Control UI.",
    iconUrl: "/app-hosting/icons/openclaw.svg",
    category: "AI",
    visibility: "PUBLIC",
    version: "1.0.0",
    isOfficial: true,
    isFeatured: true,
    installCount: 1250,
    priceMonthly: 0,
    currency: "USD",
    blueprint: appTemplateBlueprintSchema.parse({
      version: "1.0.0",
      runtime: {
        image: "ghcr.io/pfnapp/openclaw:2026.9.6",
        command: ["node", "openclaw.mjs", "gateway", "--allow-unconfigured"],
        defaultPort: 18789,
        healthCheckPath: "/healthz",
        deploymentType: "statefulset",
        runAsNonRoot: true,
      },
      access: {
        mode: "password-only",
        title: "Mulai menggunakan OpenClaw",
        loginPath: "/",
        fields: [
          {
            id: "gateway-token",
            label: "Gateway Token",
            source: "env",
            key: "OPENCLAW_GATEWAY_TOKEN",
            secret: true,
          },
        ],
        steps: [
          {
            text: "Lihat dan salin Gateway Token di PFNApp.",
            action: { type: "reveal-field", fieldId: "gateway-token" },
          },
          { text: "Buka Control UI OpenClaw.", action: { type: "open-app" } },
          {
            text: "Masukkan token pada form Gateway secret untuk mengakses dashboard.",
          },
        ],
      },
      resources: {
        defaultCpu: 500,
        defaultMemory: 1024,
        minCpu: 250,
        minMemory: 512,
      },
      storage: {
        enabled: true,
        mountPath: "/home/node/.openclaw",
        sizeGbDefault: 5,
        fsGroup: 1000,
      },
      scaling: {
        allowAutoscale: false,
        maxReplicas: 1,
        advisoryNote:
          "OpenClaw stores agent configurations and persistent sessions on a single-writer RWO volume; replicas stay at 1.",
      },
      dependencies: [],
      envSchema: [
        {
          key: "OPENCLAW_GATEWAY_TOKEN",
          label: "Gateway Token",
          description:
            "Bearer token required by gateway clients and Control UI.",
          required: true,
          isSecret: true,
          dataType: "string",
          generateRandomHex: 32,
        },
        {
          key: "OPENCLAW_GATEWAY_BIND",
          label: "Gateway Bind Mode",
          description:
            "Where the gateway listens: 0.0.0.0 accepts container traffic.",
          defaultValue: "0.0.0.0",
          required: true,
          isSecret: false,
          dataType: "string",
          isFixed: true,
          isHidden: true,
        },
        {
          key: "OPENCLAW_GATEWAY_PORT",
          label: "Gateway Port",
          defaultValue: "18789",
          required: true,
          isSecret: false,
          dataType: "number",
          isFixed: true,
          isHidden: true,
        },
        {
          key: "NODE_ENV",
          label: "Node Environment",
          defaultValue: "production",
          required: true,
          isSecret: false,
          dataType: "string",
          isFixed: true,
          isHidden: true,
        },
        {
          key: "OPENAI_API_KEY",
          label: "OpenAI API Key",
          description: "OpenAI credential recognized by core provider plugins.",
          required: false,
          isSecret: true,
          dataType: "string",
        },
        {
          key: "ANTHROPIC_API_KEY",
          label: "Anthropic API Key",
          description: "Anthropic credential for Claude models.",
          required: false,
          isSecret: true,
          dataType: "string",
        },
        {
          key: "GEMINI_API_KEY",
          label: "Gemini API Key",
          description: "Google Gemini credential for Gemini models.",
          required: false,
          isSecret: true,
          dataType: "string",
        },
        {
          key: "GROQ_API_KEY",
          label: "Groq API Key",
          description: "Groq credential for fast open models.",
          required: false,
          isSecret: true,
          dataType: "string",
        },
        {
          key: "OPENROUTER_API_KEY",
          label: "OpenRouter API Key",
          description: "OpenRouter credential for multi-provider routing.",
          required: false,
          isSecret: true,
          dataType: "string",
        },
        {
          key: "DEEPSEEK_API_KEY",
          label: "DeepSeek API Key",
          description: "DeepSeek credential for DeepSeek models.",
          required: false,
          isSecret: true,
          dataType: "string",
        },
        {
          key: "TELEGRAM_BOT_TOKEN",
          label: "Telegram Bot Token",
          description: "Telegram bot token for Telegram channel adapter.",
          required: false,
          isSecret: true,
          dataType: "string",
        },
        {
          key: "DISCORD_BOT_TOKEN",
          label: "Discord Bot Token",
          description: "Discord bot token for Discord channel adapter.",
          required: false,
          isSecret: true,
          dataType: "string",
        },
      ],
    }),
  },
  {
    slug: "omniroute",
    name: "OmniRoute",
    tagline: "High-throughput multi-provider AI model routing gateway",
    description:
      "OmniRoute is an ultra-low-latency AI routing gateway providing unified OpenAI-compatible proxy, fallback routing, rate limiting, and cost tracking.",
    readmeMarkdown:
      "# OmniRoute\n\nHigh-throughput AI model routing gateway with persistent storage at `/app/data` and integrated management dashboard.",
    iconUrl: "/app-hosting/icons/omniroute.svg",
    category: "AI",
    visibility: "PUBLIC",
    version: "1.0.0",
    isOfficial: true,
    isFeatured: true,
    installCount: 1600,
    priceMonthly: 0,
    currency: "USD",
    blueprint: appTemplateBlueprintSchema.parse({
      version: "1.0.0",
      runtime: {
        image: "ghcr.io/pfnapp/omniroute:3.8.50",
        defaultPort: 20128,
        deploymentType: "statefulset",
        runAsNonRoot: true,
      },
      access: {
        mode: "password-only",
        title: "Mulai menggunakan OmniRoute",
        loginPath: "/login",
        fields: [
          {
            id: "initial-password",
            label: "Password awal",
            source: "env",
            key: "INITIAL_PASSWORD",
            secret: true,
          },
        ],
        steps: [
          {
            text: "Lihat dan salin password awal di PFNApp.",
            action: { type: "reveal-field", fieldId: "initial-password" },
          },
          { text: "Buka dashboard OmniRoute.", action: { type: "open-app" } },
          { text: "Masukkan password tersebut. Tidak perlu username." },
        ],
      },
      resources: {
        defaultCpu: 500,
        defaultMemory: 1024,
        minCpu: 250,
        minMemory: 512,
      },
      storage: {
        enabled: true,
        mountPath: "/app/data",
        sizeGbDefault: 10,
        fsGroup: 1000,
      },
      scaling: {
        allowAutoscale: false,
        maxReplicas: 1,
        advisoryNote:
          "OmniRoute persists state, API keys, and SQLite database on a single-writer RWO volume; replicas stay at 1.",
      },
      dependencies: [],
      envSchema: [
        {
          key: "DATA_DIR",
          label: "Data Directory",
          description:
            "Persistent application data directory holding SQLite database and keys.",
          defaultValue: "/app/data",
          required: true,
          isSecret: false,
          dataType: "string",
          isFixed: true,
          isHidden: true,
        },
        {
          key: "PORT",
          label: "Port",
          defaultValue: "20128",
          required: true,
          isSecret: false,
          dataType: "number",
          isFixed: true,
          isHidden: true,
        },
        {
          key: "HOSTNAME",
          label: "Bind Address",
          defaultValue: "0.0.0.0",
          required: true,
          isSecret: false,
          dataType: "string",
          isFixed: true,
          isHidden: true,
        },
        {
          key: "NODE_ENV",
          label: "Node Environment",
          defaultValue: "production",
          required: true,
          isSecret: false,
          dataType: "string",
          isFixed: true,
          isHidden: true,
        },
        {
          key: "JWT_SECRET",
          label: "JWT Secret",
          description:
            "Signing key for login sessions, WebSocket handshakes and CSRF tokens.",
          required: true,
          isSecret: true,
          dataType: "string",
          generateRandomHex: 32,
        },
        {
          key: "API_KEY_SECRET",
          label: "API Key Secret",
          description: "Key-encryption secret for issued API keys.",
          required: true,
          isSecret: true,
          dataType: "string",
          generateRandomHex: 32,
        },
        {
          key: "INITIAL_PASSWORD",
          label: "Initial Password",
          description:
            "Bootstrap password for the first management user on initial setup.",
          required: true,
          isSecret: true,
          dataType: "string",
          generateRandomHex: 12,
        },
        {
          key: "OMNIROUTE_MEMORY_MB",
          label: "Memory Budget",
          description: "OmniRoute memory budget in megabytes.",
          defaultValue: "1024",
          required: false,
          isSecret: false,
          dataType: "number",
        },
        {
          key: "NODE_OPTIONS",
          label: "Node Options",
          description: "V8 heap limit passed to the Node.js runtime.",
          defaultValue: "--max-old-space-size=1024",
          required: false,
          isSecret: false,
          dataType: "string",
        },
        {
          key: "REQUIRE_API_KEY",
          label: "Require API Key",
          description:
            "Enforce Bearer API key validation on all /v1/* endpoints.",
          defaultValue: "true",
          required: false,
          isSecret: false,
          dataType: "boolean",
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
    iconUrl: "/app-hosting/icons/wordpress.svg",
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
