import { Glob } from "bun"

export type TestSuiteName = "logic" | "component" | "all"

export type FeatureMapping = {
  name: string
  sourcePrefixes: string[]
  testPrefixes: string[]
  smokeProjects: string[]
}

export const FEATURE_MAPPINGS: FeatureMapping[] = [
  {
    name: "cron",
    sourcePrefixes: [
      "lib/cron/",
      "modules/admin/api/routes/admin-cron",
      "modules/admin/api/services/cron-admin",
      "modules/admin/api/dto/cronjob",
      "modules/admin/ui/portal-cronjobs-view",
      "app/[lang]/portal/system/cronjobs/",
    ],
    testPrefixes: [
      "lib/cron/telemetry.test.ts",
      "modules/admin/api/routes/admin-cron.route.test.ts",
      "modules/admin/ui/portal-cronjobs-view.test.tsx",
    ],
    smokeProjects: [],
  },
  {
    name: "api",
    sourcePrefixes: ["lib/api.ts", "lib/eden-typing-smoke.ts"],
    testPrefixes: ["lib/api.openapi.test.ts"],
    smokeProjects: [],
  },
  {
    name: "deploy",
    sourcePrefixes: [
      "modules/deploy/",
      "modules/framework-detection/",
      "app/[lang]/console/app/",
      "app/api/deploy/",
      "app/api/integrations/github/",
      "scripts/seed-app-hosting-policy.ts",
    ],
    testPrefixes: [
      "modules/deploy/",
      "modules/framework-detection/",
      "app/api/deploy/",
    ],
    smokeProjects: ["smoke-deploy"],
  },
  {
    name: "billing",
    sourcePrefixes: [
      "app/[lang]/console/billing/",
      "app/[lang]/portal/billing/",
      "app/[lang]/portal/vpn/",
      "components/billing/",
      "lib/billing-client.ts",
      "lib/queue/billing-cron.ts",
      "modules/billing/",
      "modules/invoices/",
      "modules/vouchers/",
      "scripts/billing-cron.ts",
      "scripts/deploy-migrate.ts",
      "scripts/seed-billing.ts",
      "scripts/seed-vpn-server-coordinates.ts",
      "scripts/vpn-renewal-worker.ts",
    ],
    testPrefixes: [
      "components/billing/admin/catalog/product-editor.test.tsx",
      "lib/billing-client.test.ts",
      "modules/billing/api/admin/pricing.route.test.ts",
      "modules/billing/catalog/catalog-admin.route.test.ts",
      "modules/billing/catalog/catalog-admin.service.test.ts",
      "modules/billing/invoice-status.service.test.ts",
      "modules/invoices/",
      "modules/vouchers/api/portal-vouchers.route.test.ts",
      "modules/vouchers/vouchers.service.test.ts",
    ],
    smokeProjects: ["smoke-portal"],
  },
  {
    name: "whatsapp-organization-api-keys",
    sourcePrefixes: [
      "app/[lang]/console/whatsapp/",
      "app/[lang]/portal/whatsapp/",
      "modules/admin/api/admin.route.ts",
      "modules/whatsapp/api/organization-api-key-hono.ts",
      "modules/whatsapp/organization-api-keys/",
      "modules/whatsapp/whatsapp.module.ts",
      "prisma/seeds/manifest.ts",
      "scripts/dump-seed-data.ts",
    ],
    testPrefixes: [
      "app/[lang]/console/whatsapp/",
      "modules/whatsapp/api/organization-api-key-hono.test.ts",
      "modules/whatsapp/organization-api-keys/",
    ],
    smokeProjects: ["smoke-portal"],
  },
  {
    name: "whatsapp-device-meta-webhook",
    sourcePrefixes: [
      "app/[lang]/portal/whatsapp/devices/[deviceId]/page.tsx",
      "modules/whatsapp/webhooks/ui/meta-webhook-card.tsx",
      "modules/whatsapp/webhooks/ui/tabs-device-detail.tsx",
    ],
    testPrefixes: [
      "modules/whatsapp/webhooks/ui/meta-webhook-card.test.tsx",
      "modules/whatsapp/webhooks/ui/tabs-device-detail.test.tsx",
    ],
    smokeProjects: ["smoke-portal"],
  },
  {
    name: "whatsapp-devices",
    sourcePrefixes: [
      "app/[lang]/console/whatsapp/devices/",
      "app/[lang]/portal/whatsapp/devices/",
      "lib/whatsapp/meta-cloud/",
      "modules/whatsapp/devices/",
    ],
    testPrefixes: [
      "app/[lang]/console/whatsapp/devices/",
      "lib/whatsapp/meta-cloud/",
      "modules/whatsapp/devices/",
    ],
    smokeProjects: ["smoke-portal"],
  },
  {
    name: "whatsapp-templates",
    sourcePrefixes: [
      "app/[lang]/console/whatsapp/templates/",
      "app/[lang]/portal/whatsapp/templates/",
      "modules/whatsapp/templates/",
    ],
    testPrefixes: [
      "app/[lang]/console/whatsapp/templates/",
      "app/[lang]/portal/whatsapp/templates/",
      "modules/whatsapp/templates/",
    ],
    smokeProjects: ["smoke-portal"],
  },
  {
    name: "whatsapp-pricing",
    sourcePrefixes: [
      "app/[lang]/portal/whatsapp/pricing/",
      "app/[lang]/console/whatsapp/pricing/",
      "lib/seeders/system/whatsapp-pricing.seeder.ts",
      "scripts/seed-whatsapp-pricing.ts",
    ],
    testPrefixes: [
      "app/[lang]/portal/whatsapp/pricing/",
      "app/[lang]/console/whatsapp/pricing/",
      "lib/seeders/system/whatsapp-pricing.seeder.test.ts",
      "modules/whatsapp/messages/api/admin-pricing.route.test.ts",
      "modules/whatsapp/messages/message-pricing.service.test.ts",
    ],
    smokeProjects: ["smoke-portal"],
  },
  {
    name: "whatsapp-audit-logs",
    sourcePrefixes: [
      "app/[lang]/console/whatsapp/audit-logs/",
      "app/[lang]/portal/whatsapp/audit-logs/",
      "modules/whatsapp/audit/",
    ],
    testPrefixes: [
      "app/[lang]/console/whatsapp/audit-logs/",
      "app/[lang]/portal/whatsapp/audit-logs/",
      "modules/whatsapp/audit/",
    ],
    smokeProjects: ["smoke-portal"],
  },
  {
    name: "portal-ai-governance",
    sourcePrefixes: [
      "app/[lang]/portal/ai/",
      "modules/docs/api/admin-ai.route.ts",
    ],
    testPrefixes: [
      "app/[lang]/portal/ai/",
      "modules/docs/api/admin-ai.route.test.ts",
    ],
    smokeProjects: ["smoke-portal"],
  },
  {
    name: "whatsapp-messages",
    sourcePrefixes: [
      "app/[lang]/console/whatsapp/messages/",
      "app/[lang]/portal/whatsapp/messages/",
      "lib/whatsapp/handle-event.ts",
      "modules/whatsapp/conversations/",
      "modules/whatsapp/messages/",
      "modules/whatsapp/webhooks/",
      "scripts/fix-whatsapp-duplicate-conversations.ts",
    ],
    testPrefixes: [
      "app/[lang]/console/whatsapp/messages/",
      "app/[lang]/portal/whatsapp/messages/",
      "lib/whatsapp/__tests__/webhook-dispatch.test.ts",
      "modules/whatsapp/conversations/",
      "modules/whatsapp/messages/",
      "modules/whatsapp/webhooks/",
    ],
    smokeProjects: ["smoke-portal"],
  },
  {
    name: "whatsapp-broadcasts",
    sourcePrefixes: [
      "app/[lang]/console/whatsapp/broadcasts/",
      "lib/queue/whatsapp-broadcast.ts",
      "modules/whatsapp/broadcasts/",
      "scripts/whatsapp-broadcast-worker.ts",
    ],
    testPrefixes: ["modules/whatsapp/broadcasts/"],
    smokeProjects: [],
  },
  {
    name: "whatsapp-catalogs",
    sourcePrefixes: [
      "app/[lang]/console/whatsapp/catalogs/",
      "modules/whatsapp/catalogs/",
    ],
    testPrefixes: ["modules/whatsapp/catalogs/"],
    smokeProjects: [],
  },
  {
    name: "whatsapp-workflow",
    sourcePrefixes: [
      "modules/whatsapp/workflow/",
      "modules/whatsapp/ai-bot-consumer.service.ts",
    ],
    testPrefixes: [
      "modules/whatsapp/workflow/",
      "modules/whatsapp/ai-bot-consumer.service.test.ts",
    ],
    smokeProjects: [],
  },
  {
    name: "whatsapp-usage",
    sourcePrefixes: [
      "app/[lang]/console/whatsapp/usage/",
      "modules/whatsapp/usage/",
    ],
    testPrefixes: ["modules/whatsapp/usage/"],
    smokeProjects: [],
  },
  {
    name: "i18n",
    sourcePrefixes: ["lib/i18n/"],
    testPrefixes: ["lib/i18n/messages.test.ts"],
    smokeProjects: [],
  },
  {
    name: "indonesian-locale-offer",
    sourcePrefixes: [
      "app/[lang]/layout.tsx",
      "components/indonesian-locale-control.tsx",
      "lib/i18n/indonesian-locale",
    ],
    testPrefixes: [
      "app/[lang]/layout.test.tsx",
      "components/indonesian-locale-control.test.tsx",
      "lib/i18n/indonesian-locale.test.ts",
      "lib/i18n/indonesian-locale-cue.test.ts",
    ],
    smokeProjects: [],
  },
  {
    name: "console-onboarding-tour",
    sourcePrefixes: [
      "lib/onboarding/",
      "components/console-onboarding-tour.tsx",
    ],
    testPrefixes: [
      "lib/onboarding/console-tour.test.ts",
      "components/console-onboarding-tour.test.tsx",
    ],
    smokeProjects: [],
  },
  {
    name: "docs",
    sourcePrefixes: [
      "app/[lang]/docs/",
      "modules/docs/",
      "lib/markdown.ts",
      "lib/seeders/system/knowledge-docs.seeder.ts",
      "scripts/capture-all-billing-kb.ts",
      "scripts/capture-api-key-kb.ts",
      "scripts/capture-billing-kb.ts",
      "scripts/capture-whatsapp-guide-kb.ts",
      "content/knowledge-base/",
    ],
    testPrefixes: [
      "lib/markdown.test.ts",
      "lib/seeders/system/knowledge-docs.seeder.test.ts",
      "modules/docs/",
    ],
    smokeProjects: [],
  },
  {
    name: "legal",
    sourcePrefixes: [
      "app/[lang]/terms/",
      "app/[lang]/privacy/",
      "app/[lang]/acceptable-use/",
      "components/legal/",
      "app/[lang]/(home)/components/footer.tsx",
    ],
    testPrefixes: [
      "app/[lang]/terms/page.test.tsx",
      "app/[lang]/privacy/page.test.tsx",
      "app/[lang]/acceptable-use/page.test.tsx",
      "components/legal/legal-components.test.tsx",
      "app/[lang]/(home)/components/footer.test.tsx",
    ],
    smokeProjects: [],
  },
  {
    name: "auth-and-sessions",
    sourcePrefixes: [
      "modules/auth/",
      "components/profile-dialog",
      "components/nav-user",
      "lib/app-config.ts",
      "lib/workos-directory.ts",
    ],
    testPrefixes: [
      "modules/auth/",
      "components/profile-dialog.test.tsx",
      "components/nav-user.test.tsx",
      "lib/app-config.test.ts",
      "lib/workos-directory.test.ts",
    ],
    smokeProjects: ["smoke-portal"],
  },
  {
    name: "tenants-and-organizations",
    sourcePrefixes: [
      "modules/tenants/",
      "app/[lang]/console/organization/",
      "app/[lang]/portal/settings/members/",
      "app/[lang]/portal/settings/invitations/",
      "app/[lang]/invite/",
    ],
    testPrefixes: [
      "modules/tenants/",
      "app/[lang]/console/organization/",
      "app/[lang]/portal/settings/members/",
      "app/[lang]/portal/settings/invitations/",
      "app/[lang]/invite/",
    ],
    smokeProjects: ["smoke-portal"],
  },
]
export const SHARED_UI_PREFIXES = [
  "components/",
  "app/[lang]/console/layout.tsx",
  "app/[lang]/portal/layout.tsx",
  "lib/auth/functional-test-session.ts",
  "proxy.ts",
]

export const COVERAGE_EXEMPTIONS = [
  {
    pattern: "**/vpn-server-ssh-executor.ts",
    reason: "SSH adapter requires a live VPN host",
    reviewAfter: "2026-10-30",
  },
  {
    pattern: "**/wireguard-ssh-adapter.ts",
    reason: "SSH adapter requires a live WireGuard host",
    reviewAfter: "2026-10-30",
  },
  {
    pattern: "**/proxy-ssh-adapter.ts",
    reason: "SSH adapter requires a live proxy host",
    reviewAfter: "2026-10-30",
  },
  {
    pattern: "**/paypal.provider.ts",
    reason: "Provider boundary is verified with contract fixtures",
    reviewAfter: "2026-10-30",
  },
  {
    pattern: "**/docs-embedding.service.ts",
    reason: "External embedding provider boundary",
    reviewAfter: "2026-10-30",
  },
] as const

const IGNORED_PATH_PARTS = [
  "node_modules/",
  ".next/",
  "coverage/",
  "graphify-out/",
  "integration/",
]

const normalizePath = (path: string) => path.replaceAll("\\", "/")

const isIgnored = (path: string) => {
  const normalized = normalizePath(path)
  return IGNORED_PATH_PARTS.some((part) => normalized.includes(part))
}

export const collectSuiteFiles = (suite: TestSuiteName): string[] => {
  const patterns =
    suite === "logic"
      ? ["**/*.test.ts"]
      : suite === "component"
        ? ["**/*.test.tsx"]
        : ["**/*.test.ts", "**/*.test.tsx"]
  const files = new Set<string>()

  for (const pattern of patterns) {
    for (const path of new Glob(pattern).scanSync(".")) {
      const normalized = normalizePath(path)
      if (
        isIgnored(normalized) ||
        normalized.startsWith("e2e/") ||
        normalized.endsWith(".e2e.test.ts")
      ) {
        continue
      }
      files.add(normalized)
    }
  }

  return [...files].sort()
}

export const isUiPath = (path: string) => {
  const normalized = normalizePath(path)
  return (
    normalized.endsWith(".tsx") ||
    normalized.startsWith("components/") ||
    (normalized.startsWith("app/") && normalized.includes("/ui/"))
  )
}

export const findFeatureMappings = (path: string) => {
  const normalized = normalizePath(path)
  return FEATURE_MAPPINGS.filter((mapping) =>
    mapping.sourcePrefixes.some((prefix) => normalized.startsWith(prefix))
  )
}

export const isSharedUiPath = (path: string) => {
  const normalized = normalizePath(path)
  return SHARED_UI_PREFIXES.some(
    (prefix) =>
      normalized === prefix ||
      (prefix.endsWith("/") && normalized.startsWith(prefix))
  )
}

export const selectSmokeProjects = (changedPaths: string[]) => {
  const allProjects = [
    ...new Set(FEATURE_MAPPINGS.flatMap((mapping) => mapping.smokeProjects)),
  ].sort()
  const projects = new Set<string>()
  const unmappedUiPaths: string[] = []

  for (const path of changedPaths) {
    if (!isUiPath(path)) {
      continue
    }

    if (isSharedUiPath(path)) {
      for (const project of allProjects) {
        projects.add(project)
      }
      continue
    }

    const mappings = findFeatureMappings(path)
    if (mappings.length === 0) {
      unmappedUiPaths.push(path)
      continue
    }

    for (const mapping of mappings) {
      for (const project of mapping.smokeProjects) {
        projects.add(project)
      }
    }
  }

  return {
    projects: [...projects].sort(),
    unmappedUiPaths: unmappedUiPaths.sort(),
  }
}
