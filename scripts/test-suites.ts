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
    name: "deploy",
    sourcePrefixes: [
      "modules/deploy/",
      "app/[lang]/console/app/deploy/",
      "app/api/deploy/",
      "app/api/integrations/github/",
    ],
    testPrefixes: ["modules/deploy/", "app/api/deploy/"],
    smokeProjects: ["smoke-deploy"],
  },
  {
    name: "billing",
    sourcePrefixes: [
      "app/[lang]/portal/billing/",
      "app/[lang]/portal/vpn/",
      "components/billing/",
      "lib/billing-client.ts",
      "modules/billing/",
      "modules/vouchers/",
      "scripts/billing-cron.ts",
    ],
    testPrefixes: [
      "components/billing/admin/catalog/product-editor.test.tsx",
      "lib/billing-client.test.ts",
      "modules/billing/api/admin/pricing.route.test.ts",
      "modules/billing/catalog/catalog-admin.route.test.ts",
      "modules/billing/catalog/catalog-admin.service.test.ts",
      "modules/billing/invoice-status.service.test.ts",
      "modules/vouchers/api/portal-vouchers.route.test.ts",
      "modules/vouchers/vouchers.service.test.ts",
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
