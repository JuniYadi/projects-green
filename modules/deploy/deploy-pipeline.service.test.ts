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

const mockEnqueueDeployment = mock(async () => true)
mock.module("@/lib/queue/deploy-pipeline", () => ({
  enqueueDeployment: mockEnqueueDeployment,
}))

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
  buildVaultSecretPath: mock(
    (input: { organizationId: string; stackId: string; environment: string }) =>
      `tenants/${input.organizationId}/stacks/${input.stackId}/${input.environment}/app-env`
  ),
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
    mockEnqueueDeployment.mockClear()
    mockWriteSecrets.mockClear()
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
    expect(mockEnqueueDeployment).toHaveBeenCalledWith("dep-1")
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

  it("stores an initial secret only in Vault, not in stack envVarsJson", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValueOnce(null as never)
    await createOrUpdateStack({
      organizationId: "org-1",
      name: "router",
      slug: "router",
      repositoryConnectionId: null,
      branchName: "main",
      rootDirectory: "/",
      framework: null,
      buildCommand: null,
      dockerfileDetected: false,
      resourcePlanId: "payg",
      billingMode: "PAYG",
      hourlyCost: "1.5",
      sourceType: "TEMPLATE",
      envVars: [
        {
          key: "INITIAL_PASSWORD",
          value: "generated-secret",
          type: "secret_ref",
        },
      ],
    })
    const created = (
      mockPrisma.applicationStack.create as unknown as {
        mock: {
          calls: Array<
            [{ data: { envVarsJson: Array<{ value: string; key: string }> } }]
          >
        }
      }
    ).mock.calls.at(-1)?.[0]
    expect(created).toBeDefined()
    expect(
      created?.data.envVarsJson.find((item) => item.key === "INITIAL_PASSWORD")
        ?.value
    ).toBe("")
    expect(mockWriteSecrets).toHaveBeenCalledWith(
      expect.objectContaining({
        secrets: { INITIAL_PASSWORD: "generated-secret" },
      })
    )
  })

  it("createOrUpdateStack embeds platform operational contract defaults into metadataJson", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValueOnce(null as never)

    await createOrUpdateStack({
      organizationId: "org-1",
      name: "laravel-app",
      slug: "laravel-app",
      repositoryConnectionId: "repo-1",
      branchName: "main",
      rootDirectory: "/",
      framework: "Laravel 13.x",
      buildCommand: "composer install",
      dockerfileDetected: false,
      resourcePlanId: "payg",
      billingMode: "PAYG",
      hourlyCost: "1.5",
      envVars: [],
      sourceType: "GITHUB",
    })

    expect(mockPrisma.applicationStack.create).toHaveBeenCalled()
    const createCall = (
      mockPrisma.applicationStack.create.mock.calls as any
    )[0][0]
    expect(createCall.data.metadataJson).toMatchObject({
      defaultPort: 8080,
      containerPort: 8080,
      runAsUser: 10001,
      runAsGroup: 10001,
      runAsNonRoot: true,
      healthCheckPath: "/healthz",
    })
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
        environment: "prod",
        secrets: expect.objectContaining({
          API_KEY: "secret123",
          PORT: "8080",
        }),
      })
    )
  })

  it("seeds Laravel platform contract tunables and APP_KEY into Vault and metadata", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValueOnce(null as never)

    await createOrUpdateStack({
      organizationId: "org-1",
      name: "laravel-app",
      slug: "laravel-app",
      branchName: "main",
      rootDirectory: "/",
      framework: "laravel",
      dockerfileDetected: false,
      envVars: [],
      sourceType: "GITHUB",
    })

    expect(mockWriteSecrets).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        stackId: "stack-1",
        environment: "prod",
        secrets: expect.objectContaining({
          PHP_UPLOAD_MAX_FILESIZE: "64M",
          PHP_POST_MAX_SIZE: "64M",
          PHP_MEMORY_LIMIT: "256M",
          CONTAINER_ROLE: "app",
          APP_ENV: "production",
          APP_DEBUG: "false",
        }),
      })
    )

    const callArgs = (
      mockWriteSecrets.mock.calls as unknown as Array<
        [{ secrets: Record<string, string> }]
      >
    )[0]?.[0]
    expect(callArgs?.secrets.APP_KEY).toBeDefined()
    expect(callArgs?.secrets.APP_KEY.startsWith("base64:")).toBe(true)
  })

  it("createOrUpdateStack embeds custom securityContext overrides when provided", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValueOnce(null as never)

    await createOrUpdateStack({
      organizationId: "org-1",
      name: "root-app",
      slug: "root-app",
      branchName: "main",
      rootDirectory: "/",
      dockerfileDetected: false,
      envVars: [],
      sourceType: "TEMPLATE",
      runAsNonRoot: false,
      runAsUser: 0,
      runAsGroup: 0,
      readOnlyRootFilesystem: true,
    })

    const createCall = (
      mockPrisma.applicationStack.create.mock.calls as unknown as Array<
        [{ data: { slug?: string; metadataJson: Record<string, unknown> } }]
      >
    ).find((c) => c[0]?.data?.slug === "root-app")?.[0]

    expect(createCall?.data.metadataJson).toMatchObject({
      runAsNonRoot: false,
      runAsUser: 0,
      runAsGroup: 0,
      readOnlyRootFilesystem: true,
    })
  })
})
