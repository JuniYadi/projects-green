import { describe, it, expect, mock, beforeEach } from "bun:test"

const mockPrisma = {
  applicationStack: {
    findUnique: mock(),
    update: mock(async () => ({ id: "stack-1" })),
  },
  applicationDeployment: {
    update: mock(async () => ({ id: "deploy-1" })),
  },
  applicationDeployEvent: {
    upsert: mock(async () => ({ id: "event-1" })),
  },
  applicationDeploymentLog: {
    create: mock(async () => ({ id: "log-1" })),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const commitFilesMock = mock(
  async (_repo: string, _message: string, _files: unknown[]) => ({
    sha: "sync-commit-sha-123",
  })
)

class FakeGitOps {
  constructor(public config: unknown) {}
  async commitFiles(repo: string, message: string, files: unknown[]) {
    return commitFilesMock(repo, message, files)
  }
}

mock.module("@/modules/gitops/gitops.service", () => ({
  GitOpsRepositoryService: FakeGitOps,
}))

const RealClusterIntegration =
  await import("@/modules/deploy/cluster-integration.service")

mock.module("@/modules/deploy/cluster-integration.service", () => ({
  ...RealClusterIntegration,
  resolveAppHostingClusterForStack: mock(async () => ({
    id: "cluster-1",
    code: "sgp",
    name: "Singapore Production",
    region: "Singapore",
    storageClass: "standard",
    managedBaseDomain: "pfnapp.dev",
  })),
  resolveClusterIntegration: mock(async (_stackId: string, type: string) => {
    if (type === "GITOPS") {
      return {
        repo: "pfnapp/sgp-argocd-prod",
        branch: "main",
        basePath: "services-yaml/{slug}",
        pat: "test-pat",
      }
    }
    if (type === "ARGOCD") {
      return {
        apiUrl: "https://argocd.example.com",
        token: "test-token",
        chartRepo: "https://pfnapp.github.io/charts",
        chartVersion: "2.12.4",
      }
    }
    return {}
  }),
}))
const RealJenkinsImageReady =
  await import("@/modules/deploy/jenkins-image-ready.service")

mock.module("@/modules/deploy/jenkins-image-ready.service", () => ({
  ...RealJenkinsImageReady,
  loadPersistedEdgePolicy: mock(async () => null),
  resolveHelmEnvInputs: mock(() => ({
    envVars: [{ name: "DATA_DIR", value: "/app/data" }],
    externalSecretVaultPath: null,
  })),
}))
globalThis.fetch = mock(async () => {
  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}) as unknown as typeof fetch

const { syncStackConfiguration } = await import("./sync-stack.service")

describe("syncStackConfiguration", () => {
  beforeEach(() => {
    mockPrisma.applicationStack.findUnique.mockReset()
    mockPrisma.applicationStack.update.mockReset()
    mockPrisma.applicationDeployment.update.mockReset()
    commitFilesMock.mockClear()
  })

  it("regenerates Helm and value yaml with RFC 1035 app name for numeric slug", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
      id: "stack-9router",
      slug: "9router-daring-pulsar",
      name: "9router-daring-pulsar",
      sourceType: "TEMPLATE",
      organizationId: "org-1",
      cpu: 500,
      memory: 1024,
      envVarsJson: [],
      metadataJson: { defaultPort: 8080 },
      template: {
        blueprintJson: {
          runtime: {
            image: "ghcr.io/decolua/9router:latest",
            defaultPort: 8080,
          },
          storage: {
            enabled: true,
            mountPath: "/app/data",
            sizeGbDefault: 10,
          },
        },
      },
      deployments: [
        {
          id: "deploy-failed-1",
          status: "FAILED",
          failureReason: "Deployment timed out",
          attempt: 1,
        },
      ],
    } as never)

    const result = await syncStackConfiguration({
      slug: "9router-daring-pulsar",
      organizationId: "org-1",
    })

    expect(result.ok).toBe(true)
    expect(result.commitSha).toBe("sync-commit-sha-123")
    expect(commitFilesMock).toHaveBeenCalledTimes(1)

    const committedFiles = commitFilesMock.mock.calls[0]?.[2] as Array<{
      path: string
      content: string
    }>
    expect(committedFiles).toBeDefined()
    expect(committedFiles).toHaveLength(3)

    const valueFile = committedFiles.find((f) => f.path.endsWith("value.yml"))
    expect(valueFile).toBeDefined()
    // RFC 1035 check: numeric slug "9router-daring-pulsar" must become "app-9router-daring-pulsar"
    expect(valueFile?.content).toContain("name: app-9router-daring-pulsar")

    // Deployment should transition to DEPLOYING and clear failureReason
    expect(mockPrisma.applicationDeployment.update).toHaveBeenCalledWith({
      where: { id: "deploy-failed-1" },
      data: {
        status: "DEPLOYING",
        manifestPushed: true,
        manifestPushedAt: expect.any(Date),
        startedAt: expect.any(Date),
        completedAt: null,
        failureReason: null,
      },
    })
  })

  it("throws error when stack not found", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValueOnce(null)
    expect(
      syncStackConfiguration({
        slug: "nonexistent",
        organizationId: "org-1",
      })
    ).rejects.toThrow("Application nonexistent not found")
  })
})
