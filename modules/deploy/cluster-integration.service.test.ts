import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"

const mockPrisma = {
  applicationStack: {
    findUnique: mock(() => Promise.resolve(null) as any),
  },
  appHostingCluster: {
    findUnique: mock(() => Promise.resolve(null) as any),
    findMany: mock(() => Promise.resolve([] as any)),
  },
  appHostingClusterIntegration: {
    findFirst: mock(() => Promise.resolve(null) as any),
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const {
  encryptClusterIntegrationSecrets,
  decryptClusterIntegrationSecrets,
  maskClusterIntegrationSecret,
  resolveAppHostingClusterForStack,
  resolveClusterIntegration,
  resolveDefaultAppHostingClusterId,
} = await import("./cluster-integration.service")

describe("cluster-integration.service", () => {
  const originalEncryptionKey = process.env.ENCRYPTION_KEY

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "test-key"
    mockPrisma.applicationStack.findUnique.mockClear()
    mockPrisma.appHostingCluster.findUnique.mockClear()
    mockPrisma.appHostingCluster.findMany.mockClear()
    mockPrisma.appHostingClusterIntegration.findFirst.mockClear()
  })

  afterEach(() => {
    if (originalEncryptionKey === undefined) {
      delete process.env.ENCRYPTION_KEY
    } else {
      process.env.ENCRYPTION_KEY = originalEncryptionKey
    }
  })

  it("encrypts then decrypts integration secrets", () => {
    const secrets = { apiToken: "abcd1234efgh5678", username: "user" }
    const ciphertext = encryptClusterIntegrationSecrets(secrets)
    expect(typeof ciphertext).toBe("string")
    expect(ciphertext).not.toContain("abcd1234efgh5678")
    const decrypted = decryptClusterIntegrationSecrets(ciphertext)
    expect(decrypted).toEqual(secrets)
  })

  it("decrypts null ciphertext to empty object", () => {
    const decrypted = decryptClusterIntegrationSecrets(null)
    expect(decrypted).toEqual({})
  })

  it("throws on invalid encrypted payload", () => {
    expect(() => decryptClusterIntegrationSecrets("not-json")).toThrow(
      "Invalid cluster integration encrypted payload"
    )
  })

  it("masks long token as prefix and suffix only", () => {
    const mask = maskClusterIntegrationSecret({ token: "abcdefghijklmnop" })
    expect(mask).toBe("abcd…mnop")
    expect(mask).not.toContain("efghijkl")
  })

  it("returns null mask when no string secrets exist", () => {
    expect(maskClusterIntegrationSecret({})).toBeNull()
    expect(maskClusterIntegrationSecret({ token: "" })).toBeNull()
    expect(maskClusterIntegrationSecret({ token: 1234 })).toBeNull()
  })

  it("resolveAppHostingClusterForStack uses stack clusterId when set", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValue({
      clusterId: "cluster-1",
    })
    mockPrisma.appHostingCluster.findUnique.mockResolvedValue({
      id: "cluster-1",
      code: "sgp",
      name: "Singapore Production",
      region: "Singapore",
      status: "ACTIVE",
    })

    const cluster = await resolveAppHostingClusterForStack("stack-1")
    expect(cluster).toEqual({
      id: "cluster-1",
      code: "sgp",
      name: "Singapore Production",
      region: "Singapore",
    })
    expect(mockPrisma.appHostingCluster.findUnique).toHaveBeenCalledWith({
      where: { id: "cluster-1" },
    })
  })

  it("falls back to single active default cluster when stack has no clusterId", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValue({
      clusterId: null,
    })
    mockPrisma.appHostingCluster.findMany.mockResolvedValue([
      {
        id: "cluster-default",
        code: "sgp",
        name: "Singapore Production",
        region: "Singapore",
      },
    ])

    const cluster = await resolveAppHostingClusterForStack("stack-1")
    expect(cluster.code).toBe("sgp")
    expect(mockPrisma.appHostingCluster.findMany).toHaveBeenCalledWith({
      where: { status: "ACTIVE", isDefault: true },
    })
  })

  it("throws when no active default cluster is configured", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValue({
      clusterId: null,
    })
    mockPrisma.appHostingCluster.findMany.mockResolvedValue([])

    expect(resolveAppHostingClusterForStack("stack-1")).rejects.toThrow(
      "No active default App Hosting cluster configured"
    )
  })

  it("throws when multiple active defaults exist", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValue({
      clusterId: null,
    })
    mockPrisma.appHostingCluster.findMany.mockResolvedValue([
      { id: "c1", code: "sgp", name: "SG", region: "SG" },
      { id: "c2", code: "idn", name: "ID", region: "ID" },
    ])

    expect(resolveAppHostingClusterForStack("stack-1")).rejects.toThrow(
      "Multiple active default App Hosting clusters configured"
    )
  })

  it("resolveDefaultAppHostingClusterId returns the single default id", async () => {
    mockPrisma.appHostingCluster.findMany.mockResolvedValue([
      { id: "cluster-1" },
    ])
    const id = await resolveDefaultAppHostingClusterId()
    expect(id).toBe("cluster-1")
  })

  it("resolveDefaultAppHostingClusterId throws when none exist", async () => {
    mockPrisma.appHostingCluster.findMany.mockResolvedValue([])
    expect(resolveDefaultAppHostingClusterId()).rejects.toThrow(
      "No active default App Hosting cluster configured"
    )
  })

  it("resolveClusterIntegration returns JENKINS typed config with decrypted secrets", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValue({
      clusterId: null,
    })
    mockPrisma.appHostingCluster.findMany.mockResolvedValue([
      { id: "cluster-1", code: "sgp", name: "SG", region: "Singapore" },
    ])
    const ciphertext = encryptClusterIntegrationSecrets({
      username: "jenkins-user",
      apiToken: "abcdefghijklmnop1234",
      webhookToken: "whk-abcdefghij1234",
    })
    mockPrisma.appHostingClusterIntegration.findFirst.mockResolvedValue({
      clusterId: "cluster-1",
      type: "JENKINS",
      metaJson: {
        baseUrl: "https://jenkins.example.com",
        dslOwner: "pfnapp",
        dslRepo: "Jenkins",
        gitCredentialId: "github-token",
      },
      secretCiphertext: ciphertext,
    })

    const config = await resolveClusterIntegration("stack-1", "JENKINS")
    expect(config.baseUrl).toBe("https://jenkins.example.com")
    expect(config.username).toBe("jenkins-user")
    expect(config.apiToken).toBe("abcdefghijklmnop1234")
    expect(config.dslOwner).toBe("pfnapp")
    expect(config.sharedLibraryName).toBeNull()
  })

  it("resolveClusterIntegration returns GITOPS typed config", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValue({
      clusterId: null,
    })
    mockPrisma.appHostingCluster.findMany.mockResolvedValue([
      { id: "cluster-1", code: "sgp", name: "SG", region: "Singapore" },
    ])
    const ciphertext = encryptClusterIntegrationSecrets({
      pat: "ghp_abcdefghijklmnop1234",
    })
    mockPrisma.appHostingClusterIntegration.findFirst.mockResolvedValue({
      clusterId: "cluster-1",
      type: "GITOPS",
      metaJson: {
        repo: "pfnapp/sgp-argocd-prod",
        branch: "main",
        basePath: "services-yaml/{slug}",
      },
      secretCiphertext: ciphertext,
    })

    const config = await resolveClusterIntegration("stack-1", "GITOPS")
    expect(config.repo).toBe("pfnapp/sgp-argocd-prod")
    expect(config.pat).toBe("ghp_abcdefghijklmnop1234")
    expect(config.basePath).toBe("services-yaml/{slug}")
  })

  it("resolveClusterIntegration returns REGISTRY typed config with optional fields", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValue({
      clusterId: null,
    })
    mockPrisma.appHostingCluster.findMany.mockResolvedValue([
      { id: "cluster-1", code: "sgp", name: "SG", region: "Singapore" },
    ])
    mockPrisma.appHostingClusterIntegration.findFirst.mockResolvedValue({
      clusterId: "cluster-1",
      type: "REGISTRY",
      metaJson: {
        host: "registry-apac.pfnapp.com",
        namespace: "team-a",
        pullSecretName: "registry-pull",
      },
      secretCiphertext: null,
    })

    const config = await resolveClusterIntegration("stack-1", "REGISTRY")
    expect(config.host).toBe("registry-apac.pfnapp.com")
    expect(config.namespace).toBe("team-a")
    expect(config.pullSecretName).toBe("registry-pull")
    expect(config.pushCredentialId).toBeNull()
  })

  it("resolveClusterIntegration returns ARGOCD typed config", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValue({
      clusterId: null,
    })
    mockPrisma.appHostingCluster.findMany.mockResolvedValue([
      { id: "cluster-1", code: "sgp", name: "SG", region: "Singapore" },
    ])
    const ciphertext = encryptClusterIntegrationSecrets({
      token: "argo-abcdefghijklmnop1234",
    })
    mockPrisma.appHostingClusterIntegration.findFirst.mockResolvedValue({
      clusterId: "cluster-1",
      type: "ARGOCD",
      metaJson: {
        apiUrl: "https://argocd.example.com",
        project: "default",
        appNamespace: "argocd",
      },
      secretCiphertext: ciphertext,
    })

    const config = await resolveClusterIntegration("stack-1", "ARGOCD")
    expect(config.apiUrl).toBe("https://argocd.example.com")
    expect(config.project).toBe("default")
    expect(config.token).toBe("argo-abcdefghijklmnop1234")
    expect(config.webhookSecret).toBeNull()
  })

  it("resolveClusterIntegration returns KUBECONFIG typed config with metadata defaults", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValue({
      clusterId: null,
    })
    mockPrisma.appHostingCluster.findMany.mockResolvedValue([
      { id: "cluster-1", code: "sgp", name: "SG", region: "Singapore" },
    ])
    const ciphertext = encryptClusterIntegrationSecrets({
      apiServerUrl: "https://k8s.example.com",
      serviceAccountToken: "sa-token-abcdefghijklmnop1234",
    })
    mockPrisma.appHostingClusterIntegration.findFirst.mockResolvedValue({
      clusterId: "cluster-1",
      type: "KUBECONFIG",
      metaJson: {
        namespacePattern: "app-{slug}",
        labelSelector: "app.kubernetes.io/instance={slug}",
      },
      secretCiphertext: ciphertext,
    })

    const config = await resolveClusterIntegration("stack-1", "KUBECONFIG")
    expect(config.namespacePattern).toBe("app-{slug}")
    expect(config.labelSelector).toBe("app.kubernetes.io/instance={slug}")
    expect(config.apiServerUrl).toBe("https://k8s.example.com")
    expect(config.kubeconfig).toBeNull()
  })

  it("resolveClusterIntegration throws when integration is missing", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValue({
      clusterId: null,
    })
    mockPrisma.appHostingCluster.findMany.mockResolvedValue([
      { id: "cluster-1", code: "sgp", name: "SG", region: "Singapore" },
    ])
    mockPrisma.appHostingClusterIntegration.findFirst.mockResolvedValue(null)

    expect(resolveClusterIntegration("stack-1", "JENKINS")).rejects.toThrow(
      "Missing JENKINS integration for App Hosting cluster sgp"
    )
  })

  it("decrypting with a different key version throws", () => {
    const ciphertext = encryptClusterIntegrationSecrets(
      { token: "test-key" },
      1
    )
    expect(() => decryptClusterIntegrationSecrets(ciphertext, 2)).toThrow()
  })

  it("throws when ENCRYPTION_KEY is missing for cluster integration encryption", () => {
    delete process.env.ENCRYPTION_KEY
    expect(() =>
      encryptClusterIntegrationSecrets({ token: "test-key" })
    ).toThrow("Missing ENCRYPTION_KEY env var")
  })
})
