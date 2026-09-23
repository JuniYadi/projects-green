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
    count: mock(async (..._args: any[]) => 1 as number),

    findMany: mock(async (..._args: any[]) => [mockStackRecord] as any[]),

    findUnique: mock(async (..._args: any[]) => mockStackRecord as any),

    update: mock(
      async (..._args: any[]) =>
        ({
          ...mockStackRecord,
          metadataJson: { suspended: true },
        }) as any
    ),

    delete: mock(async (..._args: any[]) => mockStackRecord as any),
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

const mockResolveClusterIntegration: ReturnType<
  typeof mock<(...args: any[]) => any>
> = mock(async (..._args: unknown[]) => {
  throw new Error("No integration configured")
})

const mockResolveAppHostingClusterForStack: ReturnType<
  typeof mock<(...args: any[]) => any>
> = mock(async (..._args: unknown[]) => {
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

const mockEnqueueStackLifecycle = mock(async () => true)

mock.module("@/lib/queue/app-hosting-stack-lifecycle", () => ({
  enqueueStackLifecycle: mockEnqueueStackLifecycle,
}))

const mockTriggerDeploy = mock(async () => ({
  deploymentId: "deploy_test_123",
  status: "QUEUED" as const,
}))
const mockEnsureManagedDomainForStack = mock(async () => ({}) as any)

mock.module("@/modules/deploy/deploy-pipeline.service", () => ({
  triggerDeploy: mockTriggerDeploy,
}))

mock.module("@/modules/deploy/app-hosting-edge.service", () => ({
  ensureManagedDomainForStack: mockEnsureManagedDomainForStack,
}))

const {
  listAdminStacks,
  adminSuspendStack,
  adminResumeStack,
  processStackLifecycleJob,
  performSuspendScaleToZero,
  performResumeScaleUp,
  adminDeployStack,
  adminDeleteStack,
} = await import("./admin-stacks.service")

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

    await listAdminStacks({ status: "INVALID_STATUS" })
    expect(mockPrisma.applicationStack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    )

    mockPrisma.applicationStack.findMany.mockClear()

    await listAdminStacks({ status: "STOPPED" })
    expect(mockPrisma.applicationStack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          metadataJson: { path: ["suspended"], equals: true },
        }),
      })
    )

    mockPrisma.applicationStack.findMany.mockClear()

    await listAdminStacks({ status: "RUNNING" })
    expect(mockPrisma.applicationStack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "RUNNING",
          NOT: {
            metadataJson: {
              path: ["suspended"],
              equals: true,
            },
          },
        }),
      })
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
    expect(result3.data[0].status).toBe("STOPPED")
    expect(result3.data[0].billingState).toBe("ACTIVE")

    mockPrisma.applicationStack.findMany.mockImplementation(async () => [
      {
        ...mockStackRecord,
        status: "TERMINATED",
        metadataJson: { suspended: true },
      },
    ])

    const result4 = await listAdminStacks()
    expect(result4.data[0].status).toBe("TERMINATED")
    expect(result4.data[0].suspended).toBe(true)
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
    mockEnqueueStackLifecycle.mockClear()
    mockEnqueueStackLifecycle.mockResolvedValue(true)

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

  it("throws ALREADY_TERMINATED when stack is already terminated", async () => {
    mockPrisma.applicationStack.findUnique.mockImplementation(async () => ({
      ...mockStackRecord,
      status: "TERMINATED",
    }))

    await expect(adminSuspendStack("stack_1")).rejects.toThrow(
      "ALREADY_TERMINATED"
    )
  })

  it("enqueues lifecycle job when sync is false and queue succeeds", async () => {
    mockEnqueueStackLifecycle.mockResolvedValueOnce(true)

    const result = await adminSuspendStack("stack_1", { sync: false })

    expect(result).toEqual({
      gitopsPushed: true,
      argocdSynced: true,
      queued: true,
    })
    expect(mockEnqueueStackLifecycle).toHaveBeenCalledWith({
      stackId: "stack_1",
      action: "suspend",
    })
  })

  it("falls back to synchronous execution when enqueue fails", async () => {
    mockEnqueueStackLifecycle.mockRejectedValueOnce(new Error("Queue error"))

    const result = await adminSuspendStack("stack_1", { sync: false })

    expect(result).toEqual({
      gitopsPushed: false,
      argocdSynced: false,
    })
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

// ─── describe adminResumeStack ────────────────────────────────────────────────

describe("adminResumeStack", () => {
  beforeEach(() => {
    mockPrisma.applicationStack.findUnique.mockClear()
    mockPrisma.applicationStack.update.mockClear()
    mockResolveClusterIntegration.mockClear()
    mockResolveAppHostingClusterForStack.mockClear()
    mockCommitFiles.mockClear()
    mockCommitFiles.mockImplementation(async () => {})
    mockEnqueueStackLifecycle.mockClear()
    mockEnqueueStackLifecycle.mockResolvedValue(true)

    mockPrisma.applicationStack.findUnique.mockImplementation(async () => ({
      ...mockStackRecord,
      metadataJson: { suspended: true, previousReplicas: 2 },
    }))
    mockPrisma.applicationStack.update.mockImplementation(async () => ({
      ...mockStackRecord,
      metadataJson: { suspended: false, replicas: 2 },
    }))
    mockResolveClusterIntegration.mockImplementation(async () => null)
    mockResolveAppHostingClusterForStack.mockImplementation(async () => null)
  })

  it("throws NOT_FOUND when stack does not exist", async () => {
    mockPrisma.applicationStack.findUnique.mockImplementation(async () => null)
    await expect(adminResumeStack("stack_1")).rejects.toThrow("NOT_FOUND")
  })

  it("throws ALREADY_TERMINATED when stack is already terminated", async () => {
    mockPrisma.applicationStack.findUnique.mockImplementation(async () => ({
      ...mockStackRecord,
      status: "TERMINATED",
    }))

    await expect(adminResumeStack("stack_1")).rejects.toThrow(
      "ALREADY_TERMINATED"
    )
  })

  it("defaults to 1 replica when previousReplicas is not set or invalid", async () => {
    mockPrisma.applicationStack.findUnique.mockImplementation(async () => ({
      ...mockStackRecord,
      metadataJson: { suspended: true, previousReplicas: 0 },
    }))

    await adminResumeStack("stack_1")

    expect(mockPrisma.applicationStack.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadataJson: expect.objectContaining({
            replicas: 1,
            suspended: false,
          }),
        }),
      })
    )
  })

  it("enqueues lifecycle job when sync is false and queue succeeds", async () => {
    mockEnqueueStackLifecycle.mockResolvedValueOnce(true)

    const result = await adminResumeStack("stack_1", { sync: false })

    expect(result).toEqual({
      gitopsPushed: true,
      argocdSynced: true,
      queued: true,
    })
    expect(mockEnqueueStackLifecycle).toHaveBeenCalledWith({
      stackId: "stack_1",
      action: "resume",
    })
  })

  it("falls back to synchronous execution when enqueue fails", async () => {
    mockEnqueueStackLifecycle.mockRejectedValueOnce(new Error("Queue error"))

    const result = await adminResumeStack("stack_1", { sync: false })

    expect(result).toEqual({
      gitopsPushed: false,
      argocdSynced: false,
    })
  })

  it("restores replicas and clears suspended flag in DB when resumed", async () => {
    const gitops = makeMockGitOpsConfig()
    const cluster = makeMockCluster()
    mockResolveClusterIntegration.mockImplementation(
      async (_id: string, type: string) => {
        if (type === "GITOPS") return gitops
        throw new Error("No integration configured")
      }
    )
    mockResolveAppHostingClusterForStack.mockImplementation(async () => cluster)

    const result = await adminResumeStack("stack_1")
    expect(result.gitopsPushed).toBe(true)
    expect(mockCommitFiles).toHaveBeenCalledWith(
      "my-org/gitops-repo",
      expect.stringContaining("Resume"),
      expect.any(Array)
    )
    expect(mockPrisma.applicationStack.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadataJson: expect.objectContaining({
            suspended: false,
            replicas: 2,
          }),
        }),
      })
    )
  })
})

// ─── describe processStackLifecycleJob ────────────────────────────────────────

describe("processStackLifecycleJob", () => {
  beforeEach(() => {
    mockCommitFiles.mockImplementation(async () => {})
  })

  it("processes suspend action", async () => {
    mockPrisma.applicationStack.findUnique.mockImplementation(
      async () => mockStackRecord
    )
    const result = await processStackLifecycleJob({
      stackId: "stack_1",
      action: "suspend",
    })
    expect(result).toHaveProperty("gitopsPushed")
  })

  it("processes resume action", async () => {
    mockPrisma.applicationStack.findUnique.mockImplementation(
      async () => mockStackRecord
    )
    const result = await processStackLifecycleJob({
      stackId: "stack_1",
      action: "resume",
    })
    expect(result).toHaveProperty("gitopsPushed")
  })

  it("throws error for unsupported action", async () => {
    await expect(
      processStackLifecycleJob({
        stackId: "stack_1",
        action: "unknown" as never,
      })
    ).rejects.toThrow("Unsupported lifecycle action: unknown")
  })
})

// ─── describe performSuspendScaleToZero & performResumeScaleUp ───────────────

describe("performSuspendScaleToZero and performResumeScaleUp direct execution", () => {
  it("performSuspendScaleToZero throws NOT_FOUND when stack does not exist", async () => {
    mockPrisma.applicationStack.findUnique.mockImplementation(async () => null)
    await expect(performSuspendScaleToZero("missing_stack")).rejects.toThrow(
      "NOT_FOUND"
    )
  })

  it("performResumeScaleUp throws NOT_FOUND when stack does not exist", async () => {
    mockPrisma.applicationStack.findUnique.mockImplementation(async () => null)
    await expect(performResumeScaleUp("missing_stack")).rejects.toThrow(
      "NOT_FOUND"
    )
  })
})

// ─── describe adminDeleteStack ────────────────────────────────────────────────

describe("adminDeployStack", () => {
  beforeEach(() => {
    mockTriggerDeploy.mockClear()
    mockEnsureManagedDomainForStack.mockClear()
    mockPrisma.applicationStack.findUnique.mockImplementation(
      async () => mockStackRecord as any
    )
    mockPrisma.applicationStack.update.mockImplementation(
      async () => mockStackRecord as any
    )
  })

  it("throws NOT_FOUND when stack does not exist", async () => {
    mockPrisma.applicationStack.findUnique.mockImplementation(async () => null)

    await expect(adminDeployStack("stack_missing")).rejects.toThrow("NOT_FOUND")
  })

  it("throws ALREADY_TERMINATED when stack is terminated", async () => {
    mockPrisma.applicationStack.findUnique.mockImplementation(async () => ({
      ...mockStackRecord,
      status: "TERMINATED",
    }))

    await expect(adminDeployStack("stack_1")).rejects.toThrow(
      "ALREADY_TERMINATED"
    )
  })

  it("triggers deploy with force: true and returns deployment result", async () => {
    const result = await adminDeployStack("stack_1")

    expect(mockEnsureManagedDomainForStack).toHaveBeenCalledWith("stack_1")
    expect(mockTriggerDeploy).toHaveBeenCalledWith({
      stackId: "stack_1",
      triggerType: "MANUAL",
      force: true,
    })
    expect(result).toEqual({
      deploymentId: "deploy_test_123",
      status: "QUEUED",
    })
  })

  it("un-suspends stack if metadata indicated suspended", async () => {
    mockPrisma.applicationStack.findUnique.mockImplementation(async () => ({
      ...mockStackRecord,
      metadataJson: {
        suspended: true,
        suspendedAt: "2026-09-01T10:00:00.000Z",
      },
    }))

    await adminDeployStack("stack_1")

    expect(mockPrisma.applicationStack.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "stack_1" },
        data: expect.objectContaining({
          metadataJson: expect.objectContaining({
            suspended: false,
            suspendedAt: null,
          }),
        }),
      })
    )
  })
})

describe("adminDeleteStack", () => {
  beforeEach(() => {
    mockPrisma.applicationStack.findUnique.mockClear()
    mockPrisma.applicationStack.update.mockClear()
    mockPrisma.applicationStack.delete.mockClear()
    mockResolveClusterIntegration.mockClear()
    mockResolveAppHostingClusterForStack.mockClear()
    mockCommitFiles.mockClear()
    mockReleaseManagedStock.mockClear()

    mockPrisma.applicationStack.findUnique.mockImplementation(
      async () => mockStackRecord
    )
    mockPrisma.applicationStack.update.mockImplementation(async () => ({
      ...mockStackRecord,
      status: "TERMINATED",
    }))
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

  it("throws ALREADY_TERMINATED when stack is already terminated and cleaned up", async () => {
    mockPrisma.applicationStack.findUnique.mockImplementation(async () => ({
      ...mockStackRecord,
      status: "TERMINATED",
      metadataJson: {
        gitopsDeleted: true,
        argocdDeleted: true,
        stockReleased: true,
      },
    }))

    await expect(adminDeleteStack("stack_1")).rejects.toThrow(
      "ALREADY_TERMINATED"
    )
  })

  it("allows re-terminating a TERMINATED stack when cleanup was incomplete", async () => {
    const gitopsConfig = makeMockGitOpsConfig()
    const cluster = makeMockCluster()

    mockPrisma.applicationStack.findUnique.mockImplementation(async () => ({
      ...mockStackRecord,
      status: "TERMINATED",
      metadataJson: {
        gitopsDeleted: true,
        argocdDeleted: false,
        stockReleased: false,
      },
    }))

    mockResolveClusterIntegration.mockImplementation(
      async (_stackId: string, type: string) => {
        if (type === "GITOPS") return gitopsConfig
        throw new Error("No integration configured")
      }
    )
    mockResolveAppHostingClusterForStack.mockImplementation(async () => cluster)

    const result = await adminDeleteStack("stack_1")
    expect(result.gitopsDeleted).toBe(true)
    expect(result.stockReleased).toBe(true)
    expect(mockPrisma.applicationStack.update).toHaveBeenCalled()
  })

  it("terminates: deletes manifests in GitOps, triggers ArgoCD delete, releases stock, and retains DB record", async () => {
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

    globalThis.fetch = mock(async () => ({
      ok: true,
      status: 200,
    })) as unknown as typeof fetch

    const result = await adminDeleteStack("stack_1")

    expect(mockCommitFiles).toHaveBeenCalledWith(
      gitopsConfig.repo,
      expect.stringContaining("Terminate"),
      [],
      expect.any(Array)
    )
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/applications/"),
      expect.objectContaining({ method: "DELETE" })
    )
    expect(mockReleaseManagedStock).toHaveBeenCalledWith("stack_1")
    expect(mockPrisma.applicationStack.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "stack_1" },
        data: expect.objectContaining({
          status: "TERMINATED",
          terminatedAt: expect.any(Date),
          scheduledPurgeAt: null,
        }),
      })
    )
    expect(result.gitopsDeleted).toBe(true)
    expect(result.argocdDeleted).toBe(true)
    expect(result.stockReleased).toBe(true)
    // Should NOT hard-delete the record from database
    expect(mockPrisma.applicationStack.delete).not.toHaveBeenCalled()
  })

  it("fails and throws GITOPS_DELETE_FAILED without updating DB when gitops commitFiles fails", async () => {
    const gitopsConfig = makeMockGitOpsConfig()
    const cluster = makeMockCluster()

    mockResolveClusterIntegration.mockImplementation(
      async (_stackId: string, type: string) => {
        if (type === "GITOPS") return gitopsConfig
        throw new Error("No integration configured")
      }
    )
    mockResolveAppHostingClusterForStack.mockImplementation(async () => cluster)
    mockCommitFiles.mockImplementationOnce(async () => {
      throw new Error("Git push failed")
    })

    await expect(adminDeleteStack("stack_1")).rejects.toThrow(
      "GITOPS_DELETE_FAILED"
    )
    expect(mockPrisma.applicationStack.update).not.toHaveBeenCalled()
  })

  it("handles releaseManagedStock failure during terminate gracefully", async () => {
    const gitopsConfig = makeMockGitOpsConfig()
    const cluster = makeMockCluster()

    mockResolveClusterIntegration.mockImplementation(
      async (_stackId: string, type: string) => {
        if (type === "GITOPS") return gitopsConfig
        throw new Error("No integration configured")
      }
    )
    mockResolveAppHostingClusterForStack.mockImplementation(async () => cluster)

    mockReleaseManagedStock.mockImplementationOnce(async () => {
      throw new Error("Vault error")
    })

    const result = await adminDeleteStack("stack_1")

    expect(result.stockReleased).toBe(false)
    expect(mockPrisma.applicationStack.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "stack_1" },
        data: expect.objectContaining({
          status: "TERMINATED",
        }),
      })
    )
  })

  it("fails and throws CONFIG_MISSING when GitOps is not configured", async () => {
    mockResolveClusterIntegration.mockImplementation(async () => {
      throw new Error("No integration configured")
    })

    await expect(adminDeleteStack("stack_1")).rejects.toThrow("CONFIG_MISSING")
    expect(mockPrisma.applicationStack.update).not.toHaveBeenCalled()
  })
})
