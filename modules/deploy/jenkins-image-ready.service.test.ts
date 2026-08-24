import { beforeEach, describe, expect, it, mock } from "bun:test"

const txCreate = mock(async (..._args: unknown[]) => ({ id: "event-1" }))
const txFindFirst = mock(
  async (..._args: unknown[]): Promise<{ id: string } | null> => null
)

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

const txQueryRaw = mock(
  async (_strings: TemplateStringsArray, ..._args: unknown[]) => undefined
)
const txUpsert = mock(async (..._args: unknown[]) => ({ id: "event-1" }))
const mockTx = {
  $queryRaw: txQueryRaw,
  applicationDeployment: {
    update: mock(async () => ({ id: "deploy-1", status: "DEPLOYING" })),
    findUnique: mock(async () => defaultDeployment),
  },
  applicationDeployEvent: {
    create: txCreate,
    findFirst: txFindFirst,
    findUnique: txFindFirst,
    upsert: txUpsert,
  },
}

type MockEdgeDomain = {
  id: string
  hostname: string
  allowlistMode: "OPEN" | "ALLOWLIST_ONLY"
  certificate: {
    source: "MANAGED" | "UPLOADED"
    status: string
    tlsSecretName: string | null
  } | null
  allowlistEntries: Array<{ cidr: string }>
}
const mockPrisma = {
  $transaction: mock(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
  applicationStack: {
    findUnique: mock(async () => defaultStack),
    findFirst: mock(async () => defaultStack),
  },
  applicationDomain: {
    findFirst: mock(
      async (..._args: unknown[]): Promise<MockEdgeDomain | null> => null
    ),
  },
  applicationDeployment: {
    findFirst: mock(async () => defaultDeployment),
  },
  applicationDeployEvent: {
    findFirst: mock(
      async (
        ..._args: unknown[]
      ): Promise<{
        id: string
        type: string
        metadataJson: Record<string, unknown>
      } | null> => null
    ),
    findUnique: mock(
      async (
        ..._args: unknown[]
      ): Promise<{
        id: string
        type: string
        metadataJson: Record<string, unknown>
      } | null> => null
    ),
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
    txUpsert.mockClear()
    txFindFirst.mockClear()
    txQueryRaw.mockClear()
    mockPrisma.applicationDomain.findFirst.mockReset()
    mockPrisma.applicationDomain.findFirst.mockResolvedValue(null)
    mockPrisma.applicationStack.findUnique.mockReset()
    mockPrisma.applicationStack.findUnique.mockResolvedValue(defaultStack)
    mockPrisma.applicationDeployment.findFirst.mockReset()
    mockPrisma.applicationDeployment.findFirst.mockResolvedValue(
      defaultDeployment
    )
    mockPrisma.applicationDeployEvent.findFirst.mockReset()
    mockPrisma.applicationDeployEvent.findFirst.mockResolvedValue(null)
    mockTx.applicationDeployment.findUnique.mockReset()
    mockTx.applicationDeployment.findUnique.mockResolvedValue(defaultDeployment)
    mockTx.applicationDeployEvent.findUnique.mockReset()
    mockTx.applicationDeployEvent.findUnique.mockResolvedValue(null)
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

  it("commits helm values, upserts events, and returns commit sha", async () => {
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
    expect(txQueryRaw).toHaveBeenCalledTimes(1)
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
    expect(files[0]?.content).toContain("replicaCount: 1")
  })
  it("uses an external secret and removes Vault refs from Helm env", async () => {
    mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
      ...defaultStack,
      envVarsJson: JSON.stringify([
        { key: "NODE_ENV", value: "production", type: "plain" },
        {
          key: "DATABASE_URL",
          value: "",
          type: "secret_ref",
          source: "vault",
          vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env/DATABASE_URL",
          vaultKey: "DATABASE_URL",
        },
      ]),
    } as any)

    await handleJenkinsImageReady({
      slug: "app-metacard-prod",
      deploymentId: "deploy-1",
      imageTag: "189",
    })

    const files = (fakeCommit.mock.calls[0] as any)[2] as Array<{
      content: string
    }>
    expect(files[0]?.content).toContain("externalSecret:")
    expect(files[0]?.content).toContain(
      "vaultPath: tenants/org-1/stacks/stack-1/prod/app-env"
    )
    expect(files[0]?.content).not.toContain("secrets:")
    expect(files[0]?.content).not.toContain("DATABASE_URL")
  })
  it("uses the persisted uploaded certificate secret name in Helm values", async () => {
    mockPrisma.applicationDomain.findFirst.mockResolvedValueOnce({
      id: "domain-1",
      hostname: "metacard.co.id",
      allowlistMode: "OPEN" as const,
      certificate: {
        source: "UPLOADED" as const,
        status: "ACTIVE" as const,
        tlsSecretName: "persisted-tls",
      },
      allowlistEntries: [],
    })
    await handleJenkinsImageReady({
      slug: "app-metacard-prod",
      deploymentId: "deploy-1",
      imageTag: "188",
    })
    const files = (fakeCommit.mock.calls[0] as any)[2] as Array<{
      content: string
    }>
    expect(files[0]?.content).toContain("tlsSecretName: persisted-tls")
  })

  it("returns idempotent when same imageTag already received and manifest pushed", async () => {
    mockTx.applicationDeployment.findUnique.mockResolvedValue({
      id: "deploy-1",
      stackId: "stack-1",
      status: "BUILDING",
      commitSha: "abc123",
      manifestPushed: true,
    } as any)
    mockTx.applicationDeployEvent.findUnique.mockResolvedValueOnce({
      id: "evt-1",
      type: "IMAGE_TAG_RECEIVED",
      metadataJson: { imageTag: "187" },
    } as any)
    const res = await handleJenkinsImageReady({
      slug: "app-metacard-prod",
      deploymentId: "deploy-1",
      imageTag: "187",
    })
    expect(res.idempotent).toBe(true)
    expect(res.deploymentId).toBe("deploy-1")
    expect(fakeCommit).not.toHaveBeenCalled()
    expect(txQueryRaw).toHaveBeenCalledTimes(1)
  })

  it("upserts IMAGE_TAG_RECEIVED, GITOPS_COMMIT_CREATED, MANIFEST_PUSHED, ARGOCD_SYNC_STARTED in transaction", async () => {
    await handleJenkinsImageReady({
      slug: "app-metacard-prod",
      deploymentId: "deploy-1",
      imageTag: "187",
    })
    expect(txUpsert).toHaveBeenCalledTimes(4)
    const types = txUpsert.mock.calls.map(
      (c) => (c[0] as any as { create: { type: string } }).create.type
    )
    expect(types).toEqual([
      "IMAGE_TAG_RECEIVED",
      "GITOPS_COMMIT_CREATED",
      "MANIFEST_PUSHED",
      "ARGOCD_SYNC_STARTED",
    ])
  })
})
