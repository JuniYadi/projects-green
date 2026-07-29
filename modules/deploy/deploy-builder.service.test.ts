import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

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
    findUnique: mock(async () => defaultDeployment),
    update: mock(async () => ({})),
  },
  applicationStack: {
    update: mock(async () => ({})),
  },
  applicationDeployEvent: {
    create: txCreate,
    upsert: txCreate,
  },
  applicationDeploymentLog: {
    create: mock(async () => ({})),
  },
  githubRepositoryConnection: {
    findUnique: mock(async () => ({
      id: "conn-1",
      ownerLogin: "pfnapp",
      repoName: "console-next-app",
      installation: { githubInstallationId: BigInt(1) },
    })),
  },
  appHostingCluster: {
    findMany: mock(async () => []),
    findUnique: mock(async () => null),
  },
}

const mockTx = {
  applicationDeployment: {
    update: mock(async () => ({})),
  },
  applicationStack: {
    update: mock(async () => ({})),
  },
  applicationDeployEvent: {
    create: txCreate,
    upsert: txCreate,
  },
  applicationDeploymentLog: {
    create: mock(async () => ({})),
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
mock.module("@/modules/deploy/cluster-integration.service", () => ({
  resolveClusterIntegration: mock(async (_id: string, type: string) => {
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
  }),
  resolveDefaultAppHostingClusterId: mock(async () => "cluster-sgp"),
}))

const { processQueuedDeployment } = await import("./deploy-builder.service")

describe("processQueuedDeployment", () => {
  let originalEagerFlag: string | undefined

  beforeEach(() => {
    txCreate.mockClear()
    triggerJenkinsJobMock.mockClear()
    commitFilesMock.mockClear()
    mockPrisma.applicationDeployment.findUnique.mockReset()
    mockPrisma.applicationDeployment.findUnique.mockResolvedValue(
      defaultDeployment
    )
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
    expect(result.status).toBe("RUNNING")
  })
})
