#!/usr/bin/env bun
/**
 * Seed the App Hosting cluster inventory.
 *
 * Idempotent: upserts one active default cluster (sgp) and its
 * platform integrations. Required secret env vars that are missing
 * cause the corresponding integration to be skipped with a logged
 * warning so the seed never prints secret values.
 *
 * Usage:
 *   bun run scripts/seed-app-hosting-cluster.ts
 */
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import type { Prisma } from "@prisma/client"

const DATABASE_URL = process.env.DATABASE_URL?.trim()

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL environment variable")
  process.exit(1)
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
})

type IntegrationSpec = {
  type: "JENKINS" | "GITOPS" | "REGISTRY" | "ARGOCD" | "KUBECONFIG"
  metaJson: Record<string, unknown>
  secrets: Record<string, string>
  requiredSecretEnv: string[]
}

const SINGAPORE_METADATA = {
  namespacePattern: "app-{slug}",
  labelSelector: "app.kubernetes.io/instance={slug}",
}

const buildIntegrationSpecs = (): IntegrationSpec[] => [
  {
    type: "JENKINS",
    metaJson: {
      baseUrl: process.env.JENKINS_URL ?? "https://jenkins.example.com",
      dslOwner: process.env.JENKINS_DSL_OWNER ?? "pfnapp",
      dslRepo: process.env.JENKINS_DSL_REPO ?? "Jenkins",
      gitCredentialId: process.env.JENKINS_GIT_CREDENTIAL_ID ?? "github-token",
      sharedLibraryName: process.env.JENKINS_SHARED_LIBRARY_NAME ?? null,
      sharedLibraryBranch: process.env.JENKINS_SHARED_LIBRARY_BRANCH ?? null,
    },
    secrets: {
      username: process.env.JENKINS_USERNAME ?? "",
      apiToken: process.env.JENKINS_API_TOKEN ?? "",
      webhookToken: process.env.JENKINS_WEBHOOK_TOKEN ?? "",
    },
    requiredSecretEnv: [
      "JENKINS_USERNAME",
      "JENKINS_API_TOKEN",
      "JENKINS_WEBHOOK_TOKEN",
    ],
  },
  {
    type: "GITOPS",
    metaJson: {
      repo: process.env.GITOPS_REPO ?? "pfnapp/sgp-argocd-prod",
      branch: process.env.GITOPS_REPO_BRANCH ?? "main",
      basePath: process.env.GITOPS_BASE_PATH ?? "services-yaml/{slug}",
      authorName: process.env.GITOPS_AUTHOR_NAME ?? null,
      authorEmail: process.env.GITOPS_AUTHOR_EMAIL ?? null,
    },
    secrets: {
      pat: process.env.GITOPS_REPO_PAT ?? "",
    },
    requiredSecretEnv: ["GITOPS_REPO_PAT"],
  },
  {
    type: "REGISTRY",
    metaJson: {
      host:
        process.env.REGISTRY_HOST ??
        process.env.JENKINS_DEFAULT_REGISTRY ??
        "registry-apac.pfnapp.com",
      namespace: process.env.REGISTRY_NAMESPACE ?? null,
      pullSecretName: process.env.REGISTRY_PULL_SECRET_NAME ?? null,
    },
    secrets: {
      pushCredentialId: process.env.REGISTRY_PUSH_CREDENTIAL_ID ?? "",
    },
    requiredSecretEnv: [],
  },
  {
    type: "ARGOCD",
    metaJson: {
      apiUrl: process.env.ARGOCD_API_URL ?? "https://argocd.example.com",
      project: process.env.ARGOCD_PROJECT ?? "default",
      appNamespace: process.env.ARGOCD_APP_NAMESPACE ?? "argocd",
      chartRepo: process.env.ARGOCD_CHART_REPO ?? null,
      chartVersion: process.env.ARGOCD_CHART_VERSION ?? null,
    },
    secrets: {
      token: process.env.ARGOCD_TOKEN ?? "",
      webhookSecret: process.env.ARGOCD_WEBHOOK_SECRET ?? "",
    },
    requiredSecretEnv: ["ARGOCD_TOKEN"],
  },
  {
    type: "KUBECONFIG",
    metaJson: {
      namespacePattern:
        process.env.KUBECONFIG_NAMESPACE_PATTERN ??
        SINGAPORE_METADATA.namespacePattern,
      labelSelector:
        process.env.KUBECONFIG_LABEL_SELECTOR ??
        SINGAPORE_METADATA.labelSelector,
    },
    secrets: {
      apiServerUrl: process.env.KUBECONFIG_API_SERVER_URL ?? "",
      caCertificate: process.env.KUBECONFIG_CA_CERTIFICATE ?? "",
      serviceAccountToken: process.env.KUBECONFIG_SERVICE_ACCOUNT_TOKEN ?? "",
      kubeconfig: process.env.KUBECONFIG_RAW ?? "",
    },
    requiredSecretEnv: [],
  },
]

const hasAllRequiredSecrets = (
  spec: IntegrationSpec,
  env: NodeJS.ProcessEnv
): boolean => {
  if (spec.requiredSecretEnv.length === 0) return true
  return spec.requiredSecretEnv.every((name) => {
    const value = env[name]
    return typeof value === "string" && value.length > 0
  })
}

const stripEmptySecrets = (
  secrets: Record<string, string>
): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(secrets)) {
    if (typeof value === "string" && value.length > 0) {
      out[key] = value
    }
  }
  return out
}

const main = async () => {
  console.log("Seeding App Hosting cluster inventory...")

  // Ensure ServiceRegion for Singapore exists
  const serviceRegion = await prisma.serviceRegion.upsert({
    where: { code: "sgp" },
    update: { name: "Singapore", country: "SG", isActive: true },
    create: {
      code: "sgp",
      name: "Singapore",
      country: "SG",
      isActive: true,
    },
  })

  const cluster = await prisma.appHostingCluster.upsert({
    where: { code: "sgp" },
    update: {
      name: "Singapore Production",
      regionId: serviceRegion.id,
      status: "ACTIVE",
      isDefault: true,
      metadataJson: SINGAPORE_METADATA,
    },
    create: {
      code: "sgp",
      name: "Singapore Production",
      regionId: serviceRegion.id,
      status: "ACTIVE",
      isDefault: true,
      metadataJson: SINGAPORE_METADATA,
    },
  })
  console.log(`  - upserted cluster ${cluster.code} (${cluster.id})`)

  const { encryptClusterIntegrationSecrets, maskClusterIntegrationSecret } =
    await import("../modules/deploy/cluster-integration.service")

  for (const spec of buildIntegrationSpecs()) {
    if (!hasAllRequiredSecrets(spec, process.env)) {
      console.log(
        `Skipping ${spec.type} integration: missing ${spec.requiredSecretEnv.join(", ")}`
      )
      continue
    }
    const cleanedSecrets = stripEmptySecrets(spec.secrets)
    const preview = maskClusterIntegrationSecret(cleanedSecrets)

    const existing = await prisma.appHostingClusterIntegration.findUnique({
      where: { clusterId_type: { clusterId: cluster.id, type: spec.type } },
    })

    const ciphertext = encryptClusterIntegrationSecrets(
      cleanedSecrets,
      existing?.keyVersion ?? 1
    )

    if (existing) {
      await prisma.appHostingClusterIntegration.update({
        where: { id: existing.id },
        data: {
          metaJson: spec.metaJson as Prisma.InputJsonValue,
          secretCiphertext: ciphertext,
          secretPreview: preview,
          isActive: true,
        },
      })
    } else {
      await prisma.appHostingClusterIntegration.create({
        data: {
          clusterId: cluster.id,
          type: spec.type,
          metaJson: spec.metaJson as Prisma.InputJsonValue,
          secretCiphertext: ciphertext,
          secretPreview: preview,
          isActive: true,
        },
      })
    }
    console.log(
      `  - upserted ${spec.type} integration (preview: ${preview ?? "n/a"})`
    )
  }

  console.log("Seeded App Hosting cluster inventory.")
}

try {
  await main()
} catch (error) {
  console.error("Failed to seed App Hosting cluster:", error)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
