import { beforeEach, describe, expect, it, mock } from "bun:test"

const txCreate = mock(async (..._args: unknown[]) => ({ id: "event-1" }))
const txFindFirst = mock(
  async (..._args: unknown[]) => null as any as { id: string } | null
)

const mockTx = {
  applicationDeployment: {
    update: mock(async () => ({ id: "deploy-1", status: "DEPLOYING" })),
  },
  applicationDeployEvent: {
    create: txCreate,
    findFirst: txFindFirst,
  },
}

const defaultStack = {
  id: "stack-1",
  slug: "app-metacard-prod",
  customDomain: "metacard.co.id",
  cpu: 500,
  memory: 1024,
  envVarsJson: [
    { key: "NODE_ENV", value: "production" },
    { key: "DB_URL", value: "shhh", type: "secret" },
  ],
}

const defaultDeployment = {
  id: "deploy-1",
  stackId: "stack-1",
  status: "BUILDING",
  commitSha: "abc123",
  manifestPushed: false,
}

const mockPrisma = {
  $transaction: mock(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
  applicationStack: {
    findUnique: mock(async () => defaultStack),
    findFirst: mock(async () => defaultStack),
  },
  applicationDeployment: {
    findFirst: mock(async () => defaultDeployment),
  },
  applicationDeployEvent: {
    findFirst: mock(async () => null),
    create: mock(async () => ({ id: "event-1" })),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const fakeCommit = mock(
  async (_repo: string, _message: string, _files: unknown[]) => ({
    sha: "gitops-sha-1",
  })
)
class FakeGitOps {
  constructor(public config: unknown) {}
  async commitFiles(repo: string, message: string, files: unknown[]) {
    return fakeCommit(repo, message, files)
  }
}
mock.module("@/modules/gitops/gitops.service", () => ({
  GitOpsRepositoryService: FakeGitOps,
}))

mock.module("@/modules/deploy/cluster-integration.service", () => ({
  resolveClusterIntegration: mock(async (_stackId: string, type: string) => {
    if (type === "GITOPS") {
      return {
        repo: "pfnapp/sgp-argocd-prod",
        branch: "main",
        basePath: "services-yaml/{slug}",
        pat: "ghp_testtoken",
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
    throw new Error("unexpected type " + type)
  }),
}))

const { handleJenkinsImageReady } =
  await import("./jenkins-image-ready.service")

describe("handleJenkinsImageReady", () => {
  beforeEach(() => {
    fakeCommit.mockClear()
    txCreate.mockClear()
    txFindFirst.mockClear()
    mockPrisma.applicationStack.findUnique.mockReset()
    mockPrisma.applicationStack.findUnique.mockResolvedValue(defaultStack)
    mockPrisma.applicationDeployment.findFirst.mockReset()
    mockPrisma.applicationDeployment.findFirst.mockResolvedValue(
      defaultDeployment
    )
    mockPrisma.applicationDeployEvent.findFirst.mockReset()
    mockPrisma.applicationDeployEvent.findFirst.mockResolvedValue(null)
  })

  it("returns empty non-leaking result when stack does not exist", async () => {
    mockPrisma.applicationStack.findFirst.mockResolvedValueOnce(null as any)
    const res = await handleJenkinsImageReady({
      slug: "missing",
      imageTag: "1",
    })
    expect(res).toEqual({
      ok: true,
      deploymentId: null,
      gitopsCommitSha: null,
      idempotent: false,
    })
    expect(fakeCommit).not.toHaveBeenCalled()
  })

  it("returns empty non-leaking result when no active deployment", async () => {
    mockPrisma.applicationDeployment.findFirst.mockResolvedValueOnce(
      null as any
    )
    const res = await handleJenkinsImageReady({
      slug: "app-metacard-prod",
      imageTag: "1",
    })
    expect(res.deploymentId).toBeNull()
    expect(fakeCommit).not.toHaveBeenCalled()
  })

  it("commits helm values, records events, and returns commit sha", async () => {
    const res = await handleJenkinsImageReady({
      slug: "app-metacard-prod",
      deploymentId: "deploy-1",
      imageTag: "187",
      commitSha: "abc123",
      buildNumber: 42,
    })
    expect(res.ok).toBe(true)
    expect(res.deploymentId).toBe("deploy-1")
    expect(res.gitopsCommitSha).toBe("gitops-sha-1")
    expect(res.idempotent).toBe(false)
    expect(fakeCommit).toHaveBeenCalledTimes(1)
    const callArgs = fakeCommit.mock.calls[0] as any as [
      string,
      string,
      Array<{ path: string; content: string }>,
    ]
    const [repo, message, files] = callArgs
    expect(repo).toBe("pfnapp/sgp-argocd-prod")
    expect(message).toContain("image 187")
    expect(files[0]?.path).toBe("services-yaml/app-metacard-prod/value.yml")
    expect(files[0]?.content).toContain("tag: '187'")
  })

  it("returns idempotent when same imageTag already received and manifest pushed", async () => {
    mockPrisma.applicationDeployment.findFirst.mockResolvedValueOnce({
      id: "deploy-1",
      stackId: "stack-1",
      status: "BUILDING",
      commitSha: "abc123",
      manifestPushed: true,
    } as any)
    mockPrisma.applicationDeployEvent.findFirst.mockResolvedValueOnce({
      id: "evt-1",
      type: "IMAGE_TAG_RECEIVED",
      metadataJson: { imageTag: "187" },
    })
    const res = await handleJenkinsImageReady({
      slug: "app-metacard-prod",
      deploymentId: "deploy-1",
      imageTag: "187",
    })
    expect(res.idempotent).toBe(true)
    expect(res.deploymentId).toBe("deploy-1")
    expect(fakeCommit).not.toHaveBeenCalled()
  })

  it("records IMAGE_TAG_RECEIVED, GITOPS_COMMIT_CREATED, MANIFEST_PUSHED, ARGOCD_SYNC_STARTED in transaction", async () => {
    await handleJenkinsImageReady({
      slug: "app-metacard-prod",
      deploymentId: "deploy-1",
      imageTag: "187",
    })
    expect(txCreate).toHaveBeenCalledTimes(4)
    const types = txCreate.mock.calls.map(
      (c) => (c[0] as any as { data: { type: string } }).data.type
    )
    expect(types).toEqual([
      "IMAGE_TAG_RECEIVED",
      "GITOPS_COMMIT_CREATED",
      "MANIFEST_PUSHED",
      "ARGOCD_SYNC_STARTED",
    ])
  })

  it("does not record ARGOCD_SYNC_STARTED twice when already present", async () => {
    txFindFirst.mockImplementationOnce(
      async (args?: { where: { type: string } }) => {
        if (args?.where.type === "ARGOCD_SYNC_STARTED") return { id: "evt-9" }
        return null
      }
    )
    await handleJenkinsImageReady({
      slug: "app-metacard-prod",
      deploymentId: "deploy-1",
      imageTag: "187",
    })
    const types = txCreate.mock.calls.map(
      (c) => (c[0] as any as { data: { type: string } }).data.type
    )
    expect(types).toEqual([
      "IMAGE_TAG_RECEIVED",
      "GITOPS_COMMIT_CREATED",
      "MANIFEST_PUSHED",
    ])
  })
})
