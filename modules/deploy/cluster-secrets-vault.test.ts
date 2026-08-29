import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"

// ── Mocks ─────────────────────────────────────────────

const mockPrismaAppHostingCluster = {
  findUnique: mock(),
  findFirst: mock(),
  findMany: mock(),
  create: mock(),
  update: mock(),
  updateMany: mock(),
  count: mock(),
}

const mockPrismaAppHostingClusterIntegration = {
  findUnique: mock(),
  findFirst: mock(),
  upsert: mock(),
  update: mock(),
}

const mockPrismaApplicationStack = {
  findUnique: mock(),
}

const mockPrismaClient = {
  appHostingCluster: mockPrismaAppHostingCluster,
  appHostingClusterIntegration: mockPrismaAppHostingClusterIntegration,
  applicationStack: mockPrismaApplicationStack,
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))

const mockVaultWriteKV = mock()
const mockVaultReadKV = mock()

mock.module("@/lib/vault/vault-client", () => ({
  VaultClient: class {
    writeKV = mockVaultWriteKV
    readKV = mockVaultReadKV
  },
}))

// ── Dynamic Imports ───────────────────────────────────

const { upsertClusterIntegration } =
  await import("@/modules/deploy/cluster-management.service")

const { resolveClusterIntegration, encryptClusterIntegrationSecrets } =
  await import("@/modules/deploy/cluster-integration.service")

// ── Tests ─────────────────────────────────────────────

describe("cluster-secrets-vault lifecycle", () => {
  const originalEncryptionKey = process.env.ENCRYPTION_KEY

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "test-encryption-key-for-vault"
    mock.clearAllMocks()

    mockVaultWriteKV.mockImplementation(async () => ({
      version: 1,
      createdTime: new Date().toISOString(),
      deletionTime: null,
      destroyed: false,
    }))

    mockVaultReadKV.mockImplementation(async () => ({}))
  })

  afterEach(() => {
    if (originalEncryptionKey === undefined) {
      delete process.env.ENCRYPTION_KEY
    } else {
      process.env.ENCRYPTION_KEY = originalEncryptionKey
    }
  })

  it("upserts KUBECONFIG secrets into Vault and resolves them from Vault", async () => {
    const clusterId = "cl_k8s_prod"
    const stackId = "st_k8s_1"

    mockPrismaAppHostingCluster.findUnique.mockResolvedValue({
      id: clusterId,
      code: "k8s-prod",
      name: "K8s Production",
      region: "ap-southeast-1",
      status: "ACTIVE",
    })

    mockPrismaAppHostingClusterIntegration.findUnique.mockResolvedValue(null)
    mockPrismaAppHostingClusterIntegration.upsert.mockImplementation(
      async ({ create }) => ({
        id: "int_k8s_1",
        clusterId,
        type: create.type,
        metaJson: create.metaJson,
        secretCiphertext: create.secretCiphertext,
        secretPreview: create.secretPreview,
        isActive: true,
        keyVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    )

    const kubeconfigPayload = {
      metaJson: {
        namespacePattern: "app-{slug}",
        labelSelector: "app.kubernetes.io/name={slug}",
      },
      secrets: {
        apiServerUrl: "https://k8s-api.internal:6443",
        serviceAccountToken: "dummy-sa-token-sample",
        caCertificate: "-----BEGIN CERTIFICATE-----\nMIIB...",
        kubeconfig: "apiVersion: v1\nclusters:\n- cluster:...",
      },
    }

    const upsertResult = await upsertClusterIntegration(
      clusterId,
      "KUBECONFIG",
      kubeconfigPayload
    )

    expect(mockVaultWriteKV).toHaveBeenCalledTimes(1)
    expect(mockVaultWriteKV).toHaveBeenCalledWith(
      `admin/clusters/${clusterId}/integrations/KUBECONFIG`,
      expect.objectContaining({
        apiServerUrl: "https://k8s-api.internal:6443",
        serviceAccountToken: "dummy-sa-token-sample",
        caCertificate: "-----BEGIN CERTIFICATE-----\nMIIB...",
        kubeconfig: "apiVersion: v1\nclusters:\n- cluster:...",
      })
    )

    expect(upsertResult.type).toBe("KUBECONFIG")
    const savedMeta = upsertResult.metaJson as Record<string, unknown>
    expect(savedMeta.vaultPath).toBe(
      `admin/clusters/${clusterId}/integrations/KUBECONFIG`
    )
    expect(savedMeta.vaultVersion).toBe(1)

    // Now resolve integration for stack
    mockPrismaApplicationStack.findUnique.mockResolvedValue({
      clusterId,
    })

    mockPrismaAppHostingClusterIntegration.findFirst.mockResolvedValue({
      id: "int_k8s_1",
      clusterId,
      type: "KUBECONFIG",
      metaJson: savedMeta,
      secretCiphertext: "encrypted-fallback-payload",
      isActive: true,
      keyVersion: 1,
    })

    mockVaultReadKV.mockResolvedValueOnce({
      apiServerUrl: "https://k8s-api.internal:6443",
      serviceAccountToken: "dummy-service-account-token",
      caCertificate: "-----BEGIN CERTIFICATE-----\nMIIB...",
      kubeconfig: "apiVersion: v1\nclusters:\n- cluster:...",
    })

    const resolved = await resolveClusterIntegration(stackId, "KUBECONFIG")

    expect(mockVaultReadKV).toHaveBeenCalledWith(
      `admin/clusters/${clusterId}/integrations/KUBECONFIG`,
      1
    )
    expect(resolved.apiServerUrl).toBe("https://k8s-api.internal:6443")
    expect(resolved.serviceAccountToken).toBe("dummy-service-account-token")
    expect(resolved.namespacePattern).toBe("app-{slug}")
    expect(resolved.labelSelector).toBe("app.kubernetes.io/name={slug}")
  })

  it("upserts GITOPS secrets into Vault and resolves them from Vault", async () => {
    const clusterId = "cl_gitops_prod"
    const stackId = "st_gitops_1"

    mockPrismaAppHostingCluster.findUnique.mockResolvedValue({
      id: clusterId,
      code: "gitops-prod",
      name: "GitOps Production",
      region: "ap-southeast-1",
      status: "ACTIVE",
    })

    mockPrismaAppHostingClusterIntegration.findUnique.mockResolvedValue(null)
    mockPrismaAppHostingClusterIntegration.upsert.mockImplementation(
      async ({ create }) => ({
        id: "int_gitops_1",
        clusterId,
        type: create.type,
        metaJson: create.metaJson,
        secretCiphertext: create.secretCiphertext,
        secretPreview: create.secretPreview,
        isActive: true,
        keyVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    )

    const gitopsPayload = {
      metaJson: {
        repo: "pfnapp/gitops-deployments",
        branch: "main",
        basePath: "clusters/prod/{slug}",
        authorName: "DeployBot",
        authorEmail: "bot@pfnapp.com",
      },
      secrets: {
        pat: "ghp_mockGitOpsPersonalAccessToken123456",
      },
    }

    const upsertResult = await upsertClusterIntegration(
      clusterId,
      "GITOPS",
      gitopsPayload
    )

    expect(mockVaultWriteKV).toHaveBeenCalledTimes(1)
    expect(mockVaultWriteKV).toHaveBeenCalledWith(
      `admin/clusters/${clusterId}/integrations/GITOPS`,
      {
        pat: "ghp_mockGitOpsPersonalAccessToken123456",
      }
    )

    const savedMeta = upsertResult.metaJson as Record<string, unknown>
    expect(savedMeta.vaultPath).toBe(
      `admin/clusters/${clusterId}/integrations/GITOPS`
    )

    mockPrismaApplicationStack.findUnique.mockResolvedValue({
      clusterId,
    })

    mockPrismaAppHostingClusterIntegration.findFirst.mockResolvedValue({
      id: "int_gitops_1",
      clusterId,
      type: "GITOPS",
      metaJson: savedMeta,
      secretCiphertext: "encrypted-fallback-payload",
      isActive: true,
      keyVersion: 1,
    })

    mockVaultReadKV.mockResolvedValueOnce({
      pat: "ghp_mockGitOpsPersonalAccessToken123456",
    })

    const resolved = await resolveClusterIntegration(stackId, "GITOPS")

    expect(mockVaultReadKV).toHaveBeenCalledWith(
      `admin/clusters/${clusterId}/integrations/GITOPS`,
      1
    )
    expect(resolved.repo).toBe("pfnapp/gitops-deployments")
    expect(resolved.branch).toBe("main")
    expect(resolved.basePath).toBe("clusters/prod/{slug}")
    expect(resolved.pat).toBe("ghp_mockGitOpsPersonalAccessToken123456")
  })

  it("upserts REGISTRY/ARGOCD/JENKINS secrets into Vault with canonical path", async () => {
    const clusterId = "cl_infra_1"

    mockPrismaAppHostingCluster.findUnique.mockResolvedValue({
      id: clusterId,
      code: "infra-1",
      name: "Infra 1",
      region: "ap-southeast-1",
      status: "ACTIVE",
    })

    mockPrismaAppHostingClusterIntegration.findUnique.mockResolvedValue(null)
    mockPrismaAppHostingClusterIntegration.upsert.mockImplementation(
      async ({ create }) => ({
        id: "int_reg_1",
        clusterId,
        type: create.type,
        metaJson: create.metaJson,
        secretCiphertext: create.secretCiphertext,
        secretPreview: create.secretPreview,
        isActive: true,
        keyVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    )

    await upsertClusterIntegration(clusterId, "ARGOCD", {
      metaJson: {
        apiUrl: "https://argocd.internal.net",
        project: "app-hosting",
        appNamespace: "argocd",
      },
      secrets: {
        token: "argo-token-xyz-123456",
        webhookSecret: "argo-webhook-secret-999",
      },
    })

    expect(mockVaultWriteKV).toHaveBeenCalledWith(
      `admin/clusters/${clusterId}/integrations/ARGOCD`,
      {
        token: "argo-token-xyz-123456",
        webhookSecret: "argo-webhook-secret-999",
      }
    )
  })

  it("gracefully falls back to legacy DB decryption when vaultPath is absent", async () => {
    const clusterId = "cl_legacy_1"
    const stackId = "st_legacy_1"

    mockPrismaApplicationStack.findUnique.mockResolvedValue({
      clusterId,
    })

    mockPrismaAppHostingCluster.findUnique.mockResolvedValue({
      id: clusterId,
      code: "legacy-cluster",
      name: "Legacy Cluster",
      region: "ap-southeast-1",
      status: "ACTIVE",
    })

    const legacySecrets = {
      pat: "ghp_legacyGitOpsPat987654",
    }
    const legacyCiphertext = encryptClusterIntegrationSecrets(legacySecrets)

    mockPrismaAppHostingClusterIntegration.findFirst.mockResolvedValue({
      id: "int_legacy_gitops",
      clusterId,
      type: "GITOPS",
      metaJson: {
        repo: "pfnapp/legacy-gitops",
        branch: "master",
        basePath: "apps/{slug}",
        // No vaultPath or vaultVersion
      },
      secretCiphertext: legacyCiphertext,
      isActive: true,
      keyVersion: 1,
    })

    const resolved = await resolveClusterIntegration(stackId, "GITOPS")

    expect(mockVaultReadKV).not.toHaveBeenCalled()
    expect(resolved.repo).toBe("pfnapp/legacy-gitops")
    expect(resolved.branch).toBe("master")
    expect(resolved.pat).toBe("ghp_legacyGitOpsPat987654")
  })

  it("gracefully falls back to legacy DB decryption when Vault read fails", async () => {
    const clusterId = "cl_fallback_1"
    const stackId = "st_fallback_1"

    mockPrismaApplicationStack.findUnique.mockResolvedValue({
      clusterId,
    })

    mockPrismaAppHostingCluster.findUnique.mockResolvedValue({
      id: clusterId,
      code: "fallback-cluster",
      name: "Fallback Cluster",
      region: "ap-southeast-1",
      status: "ACTIVE",
    })

    const fallbackSecrets = {
      username: "jenkins-admin",
      apiToken: "dummy-api-token-value",
      webhookToken: "whk-secret-token",
    }
    const fallbackCiphertext = encryptClusterIntegrationSecrets(fallbackSecrets)

    mockPrismaAppHostingClusterIntegration.findFirst.mockResolvedValue({
      id: "int_jenkins_fb",
      clusterId,
      type: "JENKINS",
      metaJson: {
        baseUrl: "https://jenkins.internal",
        dslOwner: "pfnapp",
        dslRepo: "jenkins-dsl",
        gitCredentialId: "git-cred-id",
        vaultPath: `admin/clusters/${clusterId}/integrations/JENKINS`,
        vaultVersion: 1,
      },
      secretCiphertext: fallbackCiphertext,
      isActive: true,
      keyVersion: 1,
    })

    mockVaultReadKV.mockRejectedValueOnce(
      new Error("Vault service unavailable")
    )

    const resolved = await resolveClusterIntegration(stackId, "JENKINS")

    expect(mockVaultReadKV).toHaveBeenCalledWith(
      `admin/clusters/${clusterId}/integrations/JENKINS`,
      1
    )
    expect(resolved.baseUrl).toBe("https://jenkins.internal")
    expect(resolved.username).toBe("jenkins-admin")
    expect(resolved.apiToken).toBe("dummy-api-token-value")
    expect(resolved.webhookToken).toBe("whk-secret-token")
  })
})
