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
    findUniqueOrThrow: mock(() => Promise.resolve(mockStack)),
    findUnique: mock(() => Promise.resolve(mockStack)),
    update: mock(() => Promise.resolve(mockStack)),
  },
  deployment: {
    create: mock(() => Promise.resolve(mockDeployment)),
    findUniqueOrThrow: mock(() => Promise.resolve(mockDeployment)),
    findUnique: mock(() => Promise.resolve(mockDeployment)),
    update: mock(() => Promise.resolve(mockDeployment)),
    count: mock(() => Promise.resolve(0)),
  },
  deployEvent: {
    create: mock(() => Promise.resolve({ id: "evt-1" })),
    findMany: mock(() => Promise.resolve([])),
  },
  deploymentLog: {
    create: mock(() => Promise.resolve({ id: "log-1" })),
    findMany: mock(() => Promise.resolve([])),
  },
  $transaction: mock((fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const { triggerDeploy } = await import("./deploy-pipeline.service")

describe("deploy-pipeline.service", () => {
  beforeEach(() => {
    mockPrisma.applicationStack.findUniqueOrThrow.mockClear()
    mockPrisma.deployment.create.mockClear()
    mockPrisma.deployEvent.create.mockClear()
    mockPrisma.deployment.count.mockClear()
    mockPrisma.$transaction.mockClear()
  })

  it("triggerDeploy creates deployment and records event", async () => {
    const result = await triggerDeploy({
      stackId: "stack-1",
      triggerType: "MANUAL",
    })

    expect(result).toHaveProperty("deploymentId")
    expect(result.status).toBe("QUEUED")
    expect(mockPrisma.$transaction).toHaveBeenCalled()
    expect(mockPrisma.deployment.create).toHaveBeenCalled()
    expect(mockPrisma.deployEvent.create).toHaveBeenCalled()
  })
})