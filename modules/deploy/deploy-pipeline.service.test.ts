import { describe, it, expect, beforeEach, mock } from "bun:test"

const mockStack = {
  id: "stack-1",
  organizationId: "org-1",
  name: "test-stack",
  slug: "test-stack",
  status: "IDLE",
  sourceType: "GITHUB",
  repositoryConnectionId: "repo-1",
  branchName: "main",
  rootDirectory: "/",
  framework: "nextjs",
  buildCommand: "npm run build",
  dockerfileDetected: false,
  repositoryConnection: {
    id: "repo-1",
    fullName: "org/repo",
    installationId: "inst-1",
  },
}

const mockDeployment = {
  id: "dep-1",
  stackId: "stack-1",
  organizationId: "org-1",
  status: "QUEUED",
  triggerType: "MANUAL",
  branchName: "main",
  manifestPushed: false,
  argocdSynced: false,
  attempt: 1,
  stack: mockStack,
}

const mockPrisma = {
  applicationStack: {
    findFirst: mock(() => Promise.resolve(mockStack)),
    findUniqueOrThrow: mock(() => Promise.resolve(mockStack)),
    findUnique: mock(() => Promise.resolve(mockStack)),
    create: mock(() => Promise.resolve(mockStack)),
    update: mock(() => Promise.resolve(mockStack)),
    delete: mock(() => Promise.resolve(mockStack)),
  },
  applicationDeployment: {
    create: mock(() => Promise.resolve(mockDeployment)),
    findUniqueOrThrow: mock(() => Promise.resolve(mockDeployment)),
    findUnique: mock(() => Promise.resolve(mockDeployment)),
    update: mock(() => Promise.resolve(mockDeployment)),
    count: mock(() => Promise.resolve(0)),
  },
  applicationDeployEvent: {
    create: mock(() => Promise.resolve({ id: "evt-1" })),
    findMany: mock(() => Promise.resolve([])),
  },
  applicationDeploymentLog: {
    create: mock(() => Promise.resolve({ id: "log-1" })),
    findMany: mock(() => Promise.resolve([])),
  },
  githubRepositoryConnection: {
    findUnique: mock(() => Promise.resolve(null)),
  },
  $transaction: mock((fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
    fn(mockPrisma)
  ),
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))
const releaseManagedStock = mock(async () => {})

mock.module("@/modules/deploy/app-managed-stock.service", () => ({
  releaseManagedStock,
  claimManagedStock: mock(async () => ({})),
}))
const mockWriteSecrets = mock(async () => ({
  environment: "dev",
  vaultPath: "tenants/org-1/stacks/stack-1/dev/app-env",
  version: 1,
  updatedAt: "2026-08-28T00:00:00.000Z",
  references: [],
}))

mock.module("@/modules/secrets/vault-secrets.service", () => ({
  VaultSecretsService: class {
    writeSecrets = mockWriteSecrets
  },
}))

const { triggerDeploy, createOrUpdateStack, deleteStack } =
  await import("./deploy-pipeline.service")

describe("deploy-pipeline.service", () => {
  beforeEach(() => {
    mockPrisma.applicationStack.findUniqueOrThrow.mockClear()
    mockPrisma.applicationStack.findUnique.mockClear()
    mockPrisma.applicationStack.delete.mockClear()
    mockPrisma.applicationStack.create.mockClear()
    mockPrisma.applicationStack.update.mockClear()
    mockPrisma.applicationDeployment.create.mockClear()
    mockPrisma.applicationDeployEvent.create.mockClear()
    mockPrisma.applicationDeploymentLog.create.mockClear()
    mockPrisma.applicationDeployment.count.mockClear()
    mockPrisma.$transaction.mockClear()
    releaseManagedStock.mockClear()
    releaseManagedStock.mockResolvedValue(undefined)
    mockPrisma.applicationStack.findUnique.mockResolvedValue(mockStack)
    mockPrisma.applicationStack.findUniqueOrThrow.mockResolvedValue(mockStack)
    mockPrisma.applicationStack.delete.mockResolvedValue(mockStack)
  })

  it("releases managed stock before deleting a stack", async () => {
    await deleteStack("stack-1")

    expect(releaseManagedStock).toHaveBeenCalledWith("stack-1")
    expect(mockPrisma.applicationStack.delete).toHaveBeenCalledWith({
      where: { id: "stack-1" },
    })
  })
  it("triggerDeploy creates deployment, event, and initial log", async () => {
    const result = await triggerDeploy({
      stackId: "stack-1",
      triggerType: "MANUAL",
    })

    expect(result).toHaveProperty("deploymentId")
    expect(result.status).toBe("QUEUED")
    expect(mockPrisma.$transaction).toHaveBeenCalled()
    expect(mockPrisma.applicationDeployment.create).toHaveBeenCalled()
    expect(mockPrisma.applicationDeployEvent.create).toHaveBeenCalled()
    expect(mockPrisma.applicationDeploymentLog.create).toHaveBeenCalled()
  })

  it("triggerDeploy blocks when a deployment is already in progress", async () => {
    mockPrisma.applicationStack.findUniqueOrThrow.mockResolvedValueOnce({
      ...mockStack,
      status: "BUILDING",
    })

    await expect(
      triggerDeploy({ stackId: "stack-1", triggerType: "MANUAL" })
    ).rejects.toThrow("already in progress")
  })

  it("createOrUpdateStack creates a new stack when none exists", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValueOnce(null as never)

    await createOrUpdateStack({
      organizationId: "org-1",
      name: "my-app",
      slug: "my-app",
      repositoryConnectionId: "repo-1",
      branchName: "main",
      rootDirectory: "/",
      framework: "nextjs",
      buildCommand: "npm run build",
      dockerfileDetected: false,
      resourcePlanId: "payg",
      billingMode: "PAYG",
      hourlyCost: "1.5",
      envVars: [],
      sourceType: "GITHUB",
    })

    expect(mockPrisma.applicationStack.create).toHaveBeenCalled()
    expect(mockPrisma.applicationStack.update).not.toHaveBeenCalled()
  })

  it("createOrUpdateStack updates an existing idle stack", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
      ...mockStack,
      status: "IDLE",
    })
    await createOrUpdateStack({
      organizationId: "org-1",
      name: "test-stack",
      slug: "test-stack",
      branchName: "main",
      rootDirectory: "/",
      dockerfileDetected: false,
      envVars: [],
      sourceType: "GITHUB",
    })

    expect(mockPrisma.applicationStack.update).toHaveBeenCalled()
    expect(mockPrisma.applicationStack.create).not.toHaveBeenCalled()
  })

  it("createOrUpdateStack blocks mutation while a deploy is in progress", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
      ...mockStack,
      status: "DEPLOYING",
    })
    await expect(
      createOrUpdateStack({
        organizationId: "org-1",
        name: "test-stack",
        slug: "test-stack",
        branchName: "main",
        rootDirectory: "/",
        dockerfileDetected: false,
        envVars: [],
        sourceType: "GITHUB",
      })
    ).rejects.toThrow("STACK_DEPLOY_IN_PROGRESS")
  })

  it("writes plain envVars into HashiCorp Vault on createOrUpdateStack", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValueOnce(null as never)

    await createOrUpdateStack({
      organizationId: "org-1",
      name: "my-vault-app",
      slug: "my-vault-app",
      branchName: "main",
      rootDirectory: "/",
      dockerfileDetected: false,
      envVars: [
        { key: "API_KEY", value: "secret123" },
        { key: "PORT", value: "8080" },
      ],
      sourceType: "GITHUB",
    })

    expect(mockWriteSecrets).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        stackId: "stack-1",
        environment: "dev",
        secrets: {
          API_KEY: "secret123",
          PORT: "8080",
        },
      })
    )
  })
})
