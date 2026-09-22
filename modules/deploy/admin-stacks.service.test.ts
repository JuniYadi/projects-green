import { describe, it, expect, mock, beforeEach } from "bun:test"

// ─── Mock records ─────────────────────────────────────────────────────────────

const mockStackRecord = {
  id: "stack_1",
  slug: "landing-web",
  name: "Landing Web",
  organizationId: "org_alpha",
  framework: "nextjs",
  status: "RUNNING",
  subdomain: "landing-web",
  customDomain: null,
  billingMode: "PAYG",
  billingState: null,
  cpu: 500,
  memory: 512,
  metadataJson: { replicas: 2 },
  sourceType: "GITHUB",
  envVarsJson: [],
  lastDeployedAt: new Date("2026-09-01T10:00:00.000Z"),
  createdAt: new Date("2026-09-01T10:00:00.000Z"),
  updatedAt: new Date("2026-09-01T10:00:00.000Z"),
  template: null,
  deployments: [{ commitSha: "abc1234567" }],
  cluster: { name: "prod-cluster", code: "prod" },
  _count: { deployments: 3 },
}

// ─── Prisma mock ──────────────────────────────────────────────────────────────

const mockPrisma = {
  applicationStack: {
    count: mock(async () => 1),
    findMany: mock(async () => [mockStackRecord]),
    findUnique: mock(async () => mockStackRecord),
    update: mock(async () => ({
      ...mockStackRecord,
      metadataJson: { suspended: true },
    })),
    delete: mock(async () => mockStackRecord),
  },
}

// ─── WorkOS mock ──────────────────────────────────────────────────────────────

const mockGetCachedOrganizations = mock(async (ids: string[]) => {
  const map = new Map<string, { id: string; name: string; slug: string }>()
  for (const id of ids) {
    map.set(id, { id, name: "Acme Corp", slug: id })
  }
  return map
})

// ─── App managed stock mock ───────────────────────────────────────────────────

const mockReleaseManagedStock = mock(async () => undefined)

// ─── Cluster integration mock ─────────────────────────────────────────────────

const mockResolveClusterIntegration = mock(async () => {
  throw new Error("No integration configured")
})

const mockResolveAppHostingClusterForStack = mock(async () => {
  throw new Error("No cluster configured")
})

// ─── GitOps mock ──────────────────────────────────────────────────────────────

const mockCommitFiles = mock(async () => undefined)

// ─── Manifest builder mocks ───────────────────────────────────────────────────

// ─── module mocks (MUST be before any import) ─────────────────────────────────

mock.module("server-only", () => ({}))

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

mock.module("@/lib/workos-directory", () => ({
  getCachedOrganizations: mockGetCachedOrganizations,
}))

mock.module("@/modules/deploy/app-managed-stock.service", () => ({
  releaseManagedStock: mockReleaseManagedStock,
}))

mock.module("@/modules/deploy/cluster-integration.service", () => ({
  resolveClusterIntegration: mockResolveClusterIntegration,
  resolveAppHostingClusterForStack: mockResolveAppHostingClusterForStack,
}))

mock.module("@/modules/gitops/gitops.service", () => ({
  GitOpsRepositoryService: class {
    commitFiles = mockCommitFiles
  },
}))

mock.module("@/modules/deploy/gitops-manifest.builder", () => ({
  resolveGitOpsManifestPaths: mock(() => ({
    serviceDir: "svc/dir",
    helmPath: "helm.yml",
    valuePath: "value.yml",
    argocdProjectPath: "argo.yml",
    appSlug: "app-org",
    namespace: "app-org",
    appServicesDir: "svc/dir",
  })),
  buildArgoCdProjectManifest: mock(() => "argocd: yaml"),
  buildHelmApplicationManifest: mock(() => "helm: yaml"),
}))

mock.module("@/modules/deploy/helm-values.builder", () => ({
  buildHelmValues: mock(() => ({})),
}))

mock.module("@/modules/deploy/jenkins-image-ready.service", () => ({
  loadPersistedEdgePolicy: mock(async () => null),
  resolveHelmEnvInputs: mock(() => ({
    envVars: [],
    externalSecretVaultPath: undefined,
  })),
}))

mock.module("@/modules/deploy/deploy-builder.service", () => ({
  resolveTemplateImageReference: mock(async () => ({
    imageRepository: "reg/img",
    imageTag: "abc1234",
  })),
  getStackDeploymentType: mock(() => "deployment"),
  getStackAdditionalPorts: mock(() => []),
  resolveStackProbes: mock(() => ({
    livenessProbe: null,
    readinessProbe: null,
    startupProbe: null,
  })),
  resolveStorageMounts: mock(() => []),
}))

const { listAdminStacks, adminSuspendStack, adminDeleteStack } =
  await import("./admin-stacks.service")

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMockGitOpsConfig() {
  return {
    pat: "gh-pat-token",
    repo: "my-org/gitops-repo",
    branch: "main",
    basePath: "services",
  }
}

function makeMockCluster() {
  return {
    id: "cluster_1",
    name: "prod-cluster",
    code: "prod",
    managedBaseDomain: "apps.example.com",
    storageClass: "standard",
    nodeSelector: null,
    tolerations: null,
  }
}

// ─── describe listAdminStacks ─────────────────────────────────────────────────

describe("listAdminStacks", () => {
  beforeEach(() => {
    mockPrisma.applicationStack.count.mockClear()
    mockPrisma.applicationStack.findMany.mockClear()
    mockGetCachedOrganizations.mockClear()

    mockPrisma.applicationStack.count.mockImplementation(async () => 1)
    mockPrisma.applicationStack.findMany.mockImplementation(async () => [
      mockStackRecord,
    ])
    mockGetCachedOrganizations.mockImplementation(async (ids: string[]) => {
      const map = new Map<string, { id: string; name: string; slug: string }>()
      for (const id of ids) {
        map.set(id, { id, name: "Acme Corp", slug: id })
      }
      return map
    })
  })

  it("returns paginated stacks with org name", async () => {
    const result = await listAdminStacks()

    expect(result.data).toHaveLength(1)
    expect(result.data[0].slug).toBe("landing-web")
    expect(result.data[0].organizationName).toBe("Acme Corp")
    expect(result.data[0].replicas).toBe(2)
    expect(result.total).toBe(1)
  })

  it("filters by exact organizationId", async () => {
    await listAdminStacks({ organizationId: "org_alpha" })

    expect(mockPrisma.applicationStack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org_alpha",
        }),
      })
    )
  })

  it("filters by query across slug, name, id", async () => {
    await listAdminStacks({ query: "landing" })

    expect(mockPrisma.applicationStack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { slug: { contains: "landing", mode: "insensitive" } },
            { name: { contains: "landing", mode: "insensitive" } },
            { id: { contains: "landing", mode: "insensitive" } },
          ]),
        }),
      })
    )
  })

  it("filters by valid StackStatus and ignores invalid status", async () => {
    await listAdminStacks({ status: "RUNNING" })
    expect(mockPrisma.applicationStack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "RUNNING" }),
      })
    )

    mockPrisma.applicationStack.findMany.mockClear()

    await listAdminStacks({ status: "STOPPED" })
    expect(mockPrisma.applicationStack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    )

    mockPrisma.applicationStack.findMany.mockClear()

    await listAdminStacks({ status: "ALL" })
    expect(mockPrisma.applicationStack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    )
  })

  it("ignores undefined and null sentinel values", async () => {
    await listAdminStacks({
      organizationId: "undefined",
      query: "null",
      status: "undefined",
    })

    expect(mockPrisma.applicationStack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    )
  })

  it("resolves billingState from metadataJson", async () => {
    mockPrisma.applicationStack.findMany.mockImplementation(async () => [
      { ...mockStackRecord, metadataJson: { billingState: "SUSPENDED" } },
    ])

    const result1 = await listAdminStacks()
    expect(result1.data[0].billingState).toBe("SUSPENDED")
    expect(result1.data[0].suspended).toBe(false)

    mockPrisma.applicationStack.findMany.mockImplementation(async () => [
      { ...mockStackRecord, metadataJson: { billingState: "PAYMENT_GRACE" } },
    ])

    const result2 = await listAdminStacks()
    expect(result2.data[0].billingState).toBe("PAYMENT_GRACE")

    mockPrisma.applicationStack.findMany.mockImplementation(async () => [
      { ...mockStackRecord, metadataJson: { suspended: true } },
    ])

    const result3 = await listAdminStacks()
    expect(result3.data[0].suspended).toBe(true)
    expect(result3.data[0].billingState).toBe("ACTIVE")
  })

  it("returns null lastDeployedAt when missing", async () => {
    mockPrisma.applicationStack.findMany.mockImplementation(async () => [
      { ...mockStackRecord, lastDeployedAt: null },
    ])

    const result = await listAdminStacks()
    expect(result.data[0].lastDeployedAt).toBeNull()
  })
})

// ─── describe adminSuspendStack ───────────────────────────────────────────────

describe("adminSuspendStack", () => {
  beforeEach(() => {
    mockPrisma.applicationStack.findUnique.mockClear()
    mockPrisma.applicationStack.update.mockClear()
    mockResolveClusterIntegration.mockClear()
    mockResolveAppHostingClusterForStack.mockClear()
    mockCommitFiles.mockClear()

    mockPrisma.applicationStack.findUnique.mockImplementation(
      async () => mockStackRecord
    )
    mockPrisma.applicationStack.update.mockImplementation(async () => ({
      ...mockStackRecord,
      metadataJson: { suspended: true },
    }))
    mockResolveClusterIntegration.mockImplementation(async () => {
      throw new Error("No integration configured")
    })
    mockResolveAppHostingClusterForStack.mockImplementation(async () => {
      throw new Error("No cluster configured")
    })
    mockCommitFiles.mockImplementation(async () => undefined)
  })

  it("throws NOT_FOUND when stack does not exist", async () => {
    mockPrisma.applicationStack.findUnique.mockImplementation(async () => null)

    await expect(adminSuspendStack("stack_1")).rejects.toThrow("NOT_FOUND")
  })

  it("sets suspended flag in DB when no gitops configured", async () => {
    const result = await adminSuspendStack("stack_1")

    expect(mockPrisma.applicationStack.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadataJson: expect.objectContaining({ suspended: true }),
        }),
      })
    )
    expect(result).toEqual({ gitopsPushed: false, argocdSynced: false })
  })

  it("pushes replicas=0 to gitops and returns gitopsPushed=true when gitops configured", async () => {
    const gitopsConfig = makeMockGitOpsConfig()
    const cluster = makeMockCluster()

    mockResolveClusterIntegration.mockImplementation(
      async (_stackId: string, type: string) => {
        if (type === "GITOPS") return gitopsConfig
        throw new Error("No integration configured")
      }
    )
    mockResolveAppHostingClusterForStack.mockImplementation(async () => cluster)

    const result = await adminSuspendStack("stack_1")

    expect(mockCommitFiles).toHaveBeenCalledWith(
      gitopsConfig.repo,
      expect.stringContaining("Suspend"),
      expect.any(Array)
    )
    expect(result.gitopsPushed).toBe(true)
    expect(result.argocdSynced).toBe(false)
  })

  it("triggers ArgoCD sync and returns argocdSynced=true when both gitops and argocd configured", async () => {
    const gitopsConfig = makeMockGitOpsConfig()
    const cluster = makeMockCluster()
    const argocdConfig = {
      apiUrl: "https://argocd.example.com",
      token: "argocd-token",
      project: "default",
      appNamespace: "argocd",
      webhookSecret: null,
      chartRepo: null,
      chartVersion: null,
    }

    mockResolveClusterIntegration.mockImplementation(
      async (_stackId: string, type: string) => {
        if (type === "GITOPS") return gitopsConfig
        if (type === "ARGOCD") return argocdConfig
        throw new Error("No integration configured")
      }
    )
    mockResolveAppHostingClusterForStack.mockImplementation(async () => cluster)

    // Mock fetch for ArgoCD sync
    globalThis.fetch = mock(async () => ({
      ok: true,
      status: 200,
    })) as unknown as typeof fetch

    const result = await adminSuspendStack("stack_1")

    expect(result.gitopsPushed).toBe(true)
    expect(result.argocdSynced).toBe(true)
  })

  it("uses TEMPLATE image reference when sourceType is TEMPLATE", async () => {
    const gitopsConfig = makeMockGitOpsConfig()
    const cluster = makeMockCluster()

    mockPrisma.applicationStack.findUnique.mockImplementation(async () => ({
      ...mockStackRecord,
      sourceType: "TEMPLATE",
      template: {
        blueprintJson: {},
      },
    }))

    mockResolveClusterIntegration.mockImplementation(
      async (_stackId: string, type: string) => {
        if (type === "GITOPS") return gitopsConfig
        throw new Error("No integration configured")
      }
    )
    mockResolveAppHostingClusterForStack.mockImplementation(async () => cluster)

    const result = await adminSuspendStack("stack_1")

    // TEMPLATE path resolves imageRepository from template, not registry
    // commitFiles should still be called with replicas=0 payload
    expect(mockCommitFiles).toHaveBeenCalled()
    expect(result.gitopsPushed).toBe(true)
  })

  it("returns gitopsPushed=false when commitFiles throws", async () => {
    const gitopsConfig = makeMockGitOpsConfig()
    const cluster = makeMockCluster()

    mockResolveClusterIntegration.mockImplementation(
      async (_stackId: string, type: string) => {
        if (type === "GITOPS") return gitopsConfig
        throw new Error("No integration configured")
      }
    )
    mockResolveAppHostingClusterForStack.mockImplementation(async () => cluster)
    mockCommitFiles.mockImplementation(async () => {
      throw new Error("Git push failed")
    })

    const result = await adminSuspendStack("stack_1")

    expect(result.gitopsPushed).toBe(false)
    expect(mockPrisma.applicationStack.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadataJson: expect.objectContaining({ suspended: true }),
        }),
      })
    )
  })
})

// ─── describe adminDeleteStack ────────────────────────────────────────────────

describe("adminDeleteStack", () => {
  beforeEach(() => {
    mockPrisma.applicationStack.findUnique.mockClear()
    mockPrisma.applicationStack.delete.mockClear()
    mockResolveClusterIntegration.mockClear()
    mockResolveAppHostingClusterForStack.mockClear()
    mockCommitFiles.mockClear()
    mockReleaseManagedStock.mockClear()

    mockPrisma.applicationStack.findUnique.mockImplementation(
      async () => mockStackRecord
    )
    mockPrisma.applicationStack.delete.mockImplementation(
      async () => mockStackRecord
    )
    mockResolveClusterIntegration.mockImplementation(async () => {
      throw new Error("No integration configured")
    })
    mockResolveAppHostingClusterForStack.mockImplementation(async () => {
      throw new Error("No cluster configured")
    })
    mockCommitFiles.mockImplementation(async () => undefined)
    mockReleaseManagedStock.mockImplementation(async () => undefined)
  })

  it("throws NOT_FOUND when stack does not exist", async () => {
    mockPrisma.applicationStack.findUnique.mockImplementation(async () => null)

    await expect(adminDeleteStack("stack_1")).rejects.toThrow("NOT_FOUND")
  })

  it("deletes DB record and releases stock when no gitops configured", async () => {
    const result = await adminDeleteStack("stack_1")

    expect(mockReleaseManagedStock).toHaveBeenCalledWith("stack_1")
    expect(mockPrisma.applicationStack.delete).toHaveBeenCalledWith({
      where: { id: "stack_1" },
    })
    expect(result.stockReleased).toBe(true)
    expect(result.gitopsDeleted).toBe(false)
    expect(result.argocdDeleted).toBe(false)
  })

  it("sets stockReleased=false when releaseManagedStock throws", async () => {
    mockReleaseManagedStock.mockImplementation(async () => {
      throw new Error("Vault cleanup failed")
    })

    const result = await adminDeleteStack("stack_1")

    expect(result.stockReleased).toBe(false)
    expect(mockPrisma.applicationStack.delete).toHaveBeenCalledWith({
      where: { id: "stack_1" },
    })
  })

  it("deletes gitops manifests when gitops configured", async () => {
    const gitopsConfig = makeMockGitOpsConfig()

    mockResolveClusterIntegration.mockImplementation(
      async (_stackId: string, type: string) => {
        if (type === "GITOPS") return gitopsConfig
        throw new Error("No integration configured")
      }
    )

    const result = await adminDeleteStack("stack_1")

    expect(mockCommitFiles).toHaveBeenCalledWith(
      gitopsConfig.repo,
      expect.any(String),
      [],
      expect.arrayContaining(["svc/dir"])
    )
    expect(result.gitopsDeleted).toBe(true)
  })

  it("calls ArgoCD delete and returns argocdDeleted=true when argocd configured", async () => {
    const argocdConfig = {
      apiUrl: "https://argocd.example.com",
      token: "argocd-token",
      project: "default",
      appNamespace: "argocd",
      webhookSecret: null,
      chartRepo: null,
      chartVersion: null,
    }

    mockResolveClusterIntegration.mockImplementation(
      async (_stackId: string, type: string) => {
        if (type === "ARGOCD") return argocdConfig
        throw new Error("No integration configured")
      }
    )

    // Mock fetch for ArgoCD DELETE
    const mockFetch = mock(async () => ({ ok: true, status: 200 }))
    globalThis.fetch = mockFetch as unknown as typeof fetch

    const result = await adminDeleteStack("stack_1")

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("api/v1/applications/landing-web"),
      expect.objectContaining({ method: "DELETE" })
    )
    expect(result.argocdDeleted).toBe(true)
  })

  it("returns argocdDeleted=false when ArgoCD delete returns non-200", async () => {
    const argocdConfig = {
      apiUrl: "https://argocd.example.com",
      token: "argocd-token",
      project: "default",
      appNamespace: "argocd",
      webhookSecret: null,
      chartRepo: null,
      chartVersion: null,
    }

    mockResolveClusterIntegration.mockImplementation(
      async (_stackId: string, type: string) => {
        if (type === "ARGOCD") return argocdConfig
        throw new Error("No integration configured")
      }
    )

    // Mock fetch returning 500
    globalThis.fetch = mock(async () => ({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    })) as unknown as typeof fetch

    const result = await adminDeleteStack("stack_1")

    expect(result.argocdDeleted).toBe(false)
  })
})
