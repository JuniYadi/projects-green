import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import * as RealClusterIntegrationService from "@/modules/deploy/cluster-integration.service"

const txCreate = mock(async (..._args: unknown[]) => ({ id: "event-1" }))

const defaultDeployment = {
  id: "deploy-1",
  stackId: "stack-1",
  status: "QUEUED",
  commitSha: "abc123",
  stack: {
    id: "stack-1",
    slug: "app-test",
    branchName: "main",
    repositoryConnectionId: "conn-1",
    framework: null,
  },
}

const mockPrisma = {
  $transaction: mock(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
  applicationDeployment: {
    findUnique: mock(async (..._args: unknown[]) => defaultDeployment),
    update: mock(async (..._args: unknown[]) => ({})),
  },
  applicationStack: {
    update: mock(async (..._args: unknown[]) => ({})),
    findUnique: mock(async () => ({ clusterId: "cluster-1" })),
  },
  applicationDeploymentLog: {
    create: mock(async (..._args: unknown[]) => ({})),
  },
  applicationDeployEvent: {
    create: txCreate,
    upsert: txCreate,
  },
  githubRepositoryConnection: {
    findUnique: mock(async (..._args: unknown[]) => ({
      ownerLogin: "owner",
      repoName: "console-next-app",
      installation: { githubInstallationId: BigInt(1) },
    })),
  },
  appHostingCluster: {
    findMany: mock(async (..._args: unknown[]) => [
      {
        id: "cluster-1",
        code: "sgp",
        name: "Singapore Production",
        region: "Singapore",
        storageClass: "openebs-lvmpv",
        managedBaseDomain: "pfnapp.dev",
        status: "ACTIVE",
        isDefault: true,
      },
    ]),
    findUnique: mock(async (..._args: unknown[]) => ({
      id: "cluster-1",
      code: "sgp",
      name: "Singapore Production",
      region: "Singapore",
      storageClass: "openebs-lvmpv",
      managedBaseDomain: "pfnapp.dev",
      status: "ACTIVE",
      isDefault: true,
    })),
  },
}

const mockTx = {
  applicationDeployment: {
    update: mock(async (..._args: unknown[]) => ({})),
  },
  applicationStack: {
    update: mock(async (..._args: unknown[]) => ({})),
  },
  applicationDeployEvent: {
    create: txCreate,
    upsert: txCreate,
  },
  applicationDeploymentLog: {
    create: mock(async (..._args: unknown[]) => ({})),
  },
}

const triggerJenkinsJobMock = mock(async (..._args: unknown[]) => undefined)
const syncJenkinsPipelineMock = mock(async (..._args: unknown[]) => undefined)

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
mock.module("@/modules/jenkins/jenkins.service", () => ({
  triggerJenkinsJob: triggerJenkinsJobMock,
}))
mock.module("@/modules/jenkins/jenkins-sync.service", () => ({
  syncJenkinsPipeline: syncJenkinsPipelineMock,
}))
const commitFilesMock = mock(async (..._args: unknown[]) => ({
  sha: "gitops-sha-1",
}))
mock.module("@/modules/gitops/gitops.service", () => ({
  GitOpsRepositoryService: class {
    commitFiles = commitFilesMock
  },
}))

const mockResolveClusterIntegration = mock(
  async (_id: string, type: string) => {
    if (type === "JENKINS") {
      return {
        baseUrl: "https://jenkins.example.com",
        username: "user",
        apiToken: "token",
        webhookToken: "whk-token",
        dslOwner: "pfnapp",
        dslRepo: "Jenkins",
        gitCredentialId: "github-token",
        sharedLibraryName: null,
        sharedLibraryBranch: null,
      }
    }
    if (type === "REGISTRY") {
      return {
        host: "registry-apac.pfnapp.com",
        namespace: null,
        pushCredentialId: null,
        pullSecretName: null,
      }
    }
    if (type === "GITOPS") {
      return {
        repo: "pfnapp/sgp-argocd-prod",
        branch: "main",
        basePath: "",
        pat: "gitops-pat",
        authorName: null,
        authorEmail: null,
      }
    }
    throw new Error("missing " + type)
  }
)
mock.module("@/modules/deploy/cluster-integration.service", () => ({
  ...RealClusterIntegrationService,
  resolveClusterIntegration: mockResolveClusterIntegration,
}))

const { processQueuedDeployment } = await import("./deploy-builder.service")

describe("processQueuedDeployment", () => {
  let originalEagerFlag: string | undefined

  beforeEach(() => {
    txCreate.mockClear()
    triggerJenkinsJobMock.mockClear()
    syncJenkinsPipelineMock.mockClear()
    commitFilesMock.mockClear()
    mockPrisma.applicationDeployment.findUnique.mockReset()
    mockPrisma.applicationDeployment.findUnique.mockResolvedValue(
      defaultDeployment
    )
    mockPrisma.applicationDeployment.update.mockClear()
    mockPrisma.applicationStack.update.mockClear()
    mockTx.applicationDeployment.update.mockClear()
    mockTx.applicationStack.update.mockClear()
    originalEagerFlag = process.env.APP_HOSTING_EAGER_DEPLOY_FALLBACK
  })

  afterEach(() => {
    if (originalEagerFlag === undefined) {
      delete process.env.APP_HOSTING_EAGER_DEPLOY_FALLBACK
    } else {
      process.env.APP_HOSTING_EAGER_DEPLOY_FALLBACK = originalEagerFlag
    }
  })

  it("returns not_queued when deployment is missing", async () => {
    mockPrisma.applicationDeployment.findUnique.mockResolvedValueOnce(
      null as never
    )
    const result = await processQueuedDeployment("missing")
    expect(result).toEqual({ processed: false, reason: "not_queued" })
  })

  it("records JENKINS_JOB_TRIGGERED event after triggering Jenkins", async () => {
    delete process.env.APP_HOSTING_EAGER_DEPLOY_FALLBACK
    const result = await processQueuedDeployment("deploy-1")
    expect(result.processed).toBe(true)
    expect(triggerJenkinsJobMock).toHaveBeenCalledTimes(1)
    const eventTypes = txCreate.mock.calls
      .map((c) => {
        const arg = c[0] as {
          create?: { type?: string }
          data?: { type?: string }
          type?: string
        }
        return arg.create?.type ?? arg.data?.type ?? arg.type
      })
      .filter((t): t is string => Boolean(t))
    expect(eventTypes).toContain("JENKINS_JOB_TRIGGERED")
    expect(eventTypes).toContain("BUILD_STARTED")
  })

  it("returns BUILDING status when eager fallback flag is not set", async () => {
    delete process.env.APP_HOSTING_EAGER_DEPLOY_FALLBACK
    const result = await processQueuedDeployment("deploy-1")
    expect(result.status).toBe("BUILDING")
  })

  it("returns RUNNING status when eager fallback flag is true", async () => {
    process.env.APP_HOSTING_EAGER_DEPLOY_FALLBACK = "true"
    const result = await processQueuedDeployment("deploy-1")
    expect(result.status).toBe("RUNNING")
  })

  it("commits manifests via GitOps cluster integration repo", async () => {
    process.env.APP_HOSTING_EAGER_DEPLOY_FALLBACK = "true"
    await processQueuedDeployment("deploy-1")
    expect(commitFilesMock).toHaveBeenCalledTimes(1)
    const repoArg = commitFilesMock.mock.calls[0]?.[0]
    expect(repoArg).toBe("pfnapp/sgp-argocd-prod")
  })

  it("skips GitOps commit when cluster integration missing", async () => {
    process.env.APP_HOSTING_EAGER_DEPLOY_FALLBACK = "true"
    const { resolveClusterIntegration } =
      await import("@/modules/deploy/cluster-integration.service")
    const resolver = resolveClusterIntegration as unknown as {
      mockImplementation: (
        fn: (id: string, type: string) => Promise<unknown>
      ) => void
    }
    resolver.mockImplementation(async (_id, type) => {
      if (type === "GITOPS") throw new Error("no cluster")
      if (type === "JENKINS") {
        return {
          baseUrl: "https://jenkins.example.com",
          username: "user",
          apiToken: "token",
          webhookToken: "whk-token",
          dslOwner: "pfnapp",
          dslRepo: "Jenkins",
          gitCredentialId: "github-token",
          sharedLibraryName: null,
          sharedLibraryBranch: null,
        }
      }
      if (type === "REGISTRY") {
        return {
          host: "registry-apac.pfnapp.com",
          namespace: null,
          pushCredentialId: null,
          pullSecretName: null,
        }
      }
      throw new Error("missing " + type)
    })
    const result = await processQueuedDeployment("deploy-1")
    expect(commitFilesMock).not.toHaveBeenCalled()
  })

  it("returns not_queued when deployment status is not QUEUED", async () => {
    mockPrisma.applicationDeployment.findUnique.mockResolvedValueOnce({
      ...defaultDeployment,
      status: "BUILDING",
    } as never)
    const result = await processQueuedDeployment("deploy-1")
    expect(result).toEqual({ processed: false, reason: "not_queued" })
  })

  it("triggers Jenkins job for public source with PUBLIC_SOURCE_URL", async () => {
    process.env.APP_HOSTING_EAGER_DEPLOY_FALLBACK = "true"
    mockPrisma.applicationDeployment.findUnique.mockResolvedValueOnce({
      ...defaultDeployment,
      repositoryConnectionId: null,
      stack: {
        ...defaultDeployment.stack,
        repositoryConnectionId: null,
        sourceType: "PUBLIC",
        publicSourceUrl: "https://example.com/source",
        publicSourceRef: "main",
      },
    } as never)
    const result = await processQueuedDeployment("deploy-1")
    expect(triggerJenkinsJobMock).toHaveBeenCalledTimes(1)
    expect(triggerJenkinsJobMock).toHaveBeenCalledWith(
      "deploy-app-test",
      expect.objectContaining({
        PUBLIC_SOURCE_URL: "https://example.com/source",
        GIT_REF: "main",
        STACK_ID: "stack-1",
        PFNAPP_WEBHOOK_TOKEN: "whk-token",
      }),
      expect.objectContaining({
        baseUrl: "https://jenkins.example.com",
      })
    )
    expect(result.status).toBe("RUNNING")
  })

  it("handles manifest push failure gracefully in eager fallback", async () => {
    process.env.APP_HOSTING_EAGER_DEPLOY_FALLBACK = "true"
    const { resolveClusterIntegration } =
      await import("@/modules/deploy/cluster-integration.service")
    const resolver = resolveClusterIntegration as unknown as {
      mockImplementation: (
        fn: (id: string, type: string) => Promise<unknown>
      ) => void
    }
    resolver.mockImplementation(async (_id, type) => {
      if (type === "JENKINS") {
        return {
          baseUrl: "https://jenkins.example.com",
          username: "user",
          apiToken: "token",
          webhookToken: "whk-token",
          dslOwner: "pfnapp",
          dslRepo: "Jenkins",
          gitCredentialId: "github-token",
          sharedLibraryName: null,
          sharedLibraryBranch: null,
        }
      }
      if (type === "REGISTRY") {
        return {
          host: "registry-apac.pfnapp.com",
          namespace: null,
          pushCredentialId: null,
          pullSecretName: null,
        }
      }
      if (type === "GITOPS") {
        return {
          repo: "pfnapp/sgp-argocd-prod",
          branch: "main",
          basePath: "",
          pat: "gitops-pat",
          authorName: null,
          authorEmail: null,
        }
      }
      throw new Error("missing " + type)
    })
    commitFilesMock.mockImplementationOnce(async () => {
      throw new Error("GitOps push failed")
    })
    const result = await processQueuedDeployment("deploy-1")
    expect(result.status).toBe("RUNNING")
    expect(commitFilesMock).toHaveBeenCalledTimes(1)
  })

  it("marks deployment as FAILED when transaction errors", async () => {
    mockPrisma.githubRepositoryConnection.findUnique.mockImplementationOnce(
      async () => {
        throw new Error("Database error")
      }
    )
    const result = await processQueuedDeployment("deploy-1")
    expect(result.status).toBe("FAILED")
    expect((result as { error?: string }).error).toBe("Database error")
    expect(mockPrisma.applicationDeployment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "deploy-1" },
        data: expect.objectContaining({
          status: "FAILED",
          failureReason: "Database error",
        }),
      })
    )
  })

  it("advances a TEMPLATE deployment straight to DEPLOYING without ever going through BUILDING", async () => {
    mockPrisma.applicationDeployment.findUnique.mockResolvedValueOnce({
      id: "deploy-template-1",
      stackId: "stack-template-1",
      status: "QUEUED",
      commitSha: null,
      stack: {
        id: "stack-template-1",
        slug: "n8n-app",
        branchName: "main",
        repositoryConnectionId: null,
        framework: null,
        sourceType: "TEMPLATE",
        publicSourceUrl: null,
        publicSourceRef: null,
        cpu: 500,
        memory: 512,
        customDomain: null,
        envVarsJson: [],
        metadataJson: { imageRepository: "docker.io/n8nio/n8n:latest" },
      },
    } as never)

    const result = await processQueuedDeployment("deploy-template-1")

    expect(triggerJenkinsJobMock).not.toHaveBeenCalled()
    expect(syncJenkinsPipelineMock).not.toHaveBeenCalled()

    const statusesWritten = [
      ...mockPrisma.applicationDeployment.update.mock.calls,
      ...mockTx.applicationDeployment.update.mock.calls,
    ].map(
      (call) =>
        (call[0] as unknown as { data?: { status?: string } })?.data?.status
    )
    expect(statusesWritten).not.toContain("BUILDING")
    expect(result.processed).toBe(true)
    expect(result.status).toBe("DEPLOYING")

    expect(mockTx.applicationDeployment.update).toHaveBeenCalledTimes(1)
    const txUpdateArgs = mockTx.applicationDeployment.update.mock
      .calls[0]?.[0] as unknown as {
      data: { status: string; manifestPushed: boolean }
    }
    expect(txUpdateArgs.data.status).toBe("DEPLOYING")
    expect(txUpdateArgs.data.manifestPushed).toBe(true)
    expect(commitFilesMock).toHaveBeenCalledTimes(1)
    const [repoArg, messageArg, filesArg] = commitFilesMock.mock.calls[0] as [
      string,
      string,
      Array<{ path: string; content: string }>,
    ]
    expect(repoArg).toBe("pfnapp/sgp-argocd-prod")
    expect(messageArg).toContain("image latest")
    expect(filesArg[0]?.content).toContain("repository: docker.io/n8nio/n8n")
    expect(filesArg[0]?.content).toContain("tag: latest")
  })

  it("threads deploymentType and additionalPorts from stack metadataJson into the committed Helm values (Hermes case)", async () => {
    mockPrisma.applicationDeployment.findUnique.mockResolvedValueOnce({
      id: "deploy-hermes-1",
      stackId: "stack-hermes-1",
      status: "QUEUED",
      commitSha: null,
      stack: {
        id: "stack-hermes-1",
        slug: "hermes-agent",
        branchName: "main",
        repositoryConnectionId: null,
        framework: null,
        sourceType: "TEMPLATE",
        publicSourceUrl: null,
        publicSourceRef: null,
        cpu: 500,
        memory: 1024,
        customDomain: null,
        envVarsJson: [],
        metadataJson: {
          imageRepository: "nousresearch/hermes-agent:v2026.8.18",
          deploymentType: "statefulset",
          additionalPorts: [{ port: 9119, name: "dashboard" }],
        },
      },
    } as never)

    const result = await processQueuedDeployment("deploy-hermes-1")

    expect(result.processed).toBe(true)
    expect(result.status).toBe("DEPLOYING")

    const [, , filesArg] = commitFilesMock.mock.calls[
      commitFilesMock.mock.calls.length - 1
    ] as [string, string, Array<{ path: string; content: string }>]
    expect(filesArg[0]?.content).toContain("deploymentType: statefulset")
    expect(filesArg[0]?.content).toContain("containerPort: 9119")
    expect(filesArg[0]?.content).toContain("name: dashboard")
  })

  it("resolves template image from template blueprint without requiring REGISTRY integration", async () => {
    mockPrisma.applicationDeployment.findUnique.mockResolvedValueOnce({
      id: "deploy-template-1",
      status: "QUEUED",
      attempt: 1,
      stack: {
        id: "stack-tpl-1",
        slug: "hermes-demo",
        name: "hermes-demo",
        sourceType: "TEMPLATE",
        templateId: "tpl-hermes",
        clusterId: "cluster-1",
        customDomain: null,
        envVarsJson: [],
        metadataJson: {},
        template: {
          blueprintJson: {
            runtime: {
              image: "nousresearch/hermes-agent:v2026.8.18",
              defaultPort: 8642,
              deploymentType: "deployment",
            },
          },
        },
      },
    } as never)

    mockResolveClusterIntegration.mockImplementation(
      async (_stackId: string, type: string) => {
        if (type === "GITOPS") {
          return {
            repo: "org/repo",
            branch: "main",
            basePath: "apps/hermes-demo",
            token: "ghp_mock",
            vaultPath: "admin/clusters/c1/integrations/GITOPS",
            authorName: "GitOps Bot",
            authorEmail: "bot@example.com",
          }
        }
        if (type === "REGISTRY") {
          throw new Error("Missing REGISTRY integration")
        }
        throw new Error("missing " + type)
      }
    )

    const result = await processQueuedDeployment("deploy-template-1")
    expect(result.processed).toBe(true)
    expect(result.status).toBe("DEPLOYING")
    const [, , filesArg] = commitFilesMock.mock.calls[
      commitFilesMock.mock.calls.length - 1
    ] as [string, string, Array<{ path: string; content: string }>]
    expect(filesArg[0]?.content).toContain(
      "repository: nousresearch/hermes-agent"
    )
    expect(filesArg[0]?.content).toContain("tag: v2026.8.18")
  })
})
