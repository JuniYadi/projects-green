import { describe, it, expect, beforeEach, mock } from "bun:test"

const mockStack = {
  id: "stack-1",
  organizationId: "org-1",
  name: "test-stack",
  status: "RUNNING",
}

const mockTargetDeployment = {
  id: "dep-old",
  stackId: "stack-1",
  status: "RUNNING",
  commitSha: "abc123",
  branchName: "main",
}

const mockRollbackDeployment = {
  id: "dep-rollback",
  stackId: "stack-1",
  status: "QUEUED",
  rollbackOfId: "dep-old",
}

const mockPrisma = {
  applicationStack: {
    findUniqueOrThrow: mock(() => Promise.resolve(mockStack)),
    update: mock(() => Promise.resolve(mockStack)),
  },
  deployment: {
    findUniqueOrThrow: mock(() => Promise.resolve(mockTargetDeployment)),
    create: mock(() => Promise.resolve(mockRollbackDeployment)),
    findMany: mock(() => Promise.resolve([mockTargetDeployment])),
  },
  deployEvent: {
    create: mock(() => Promise.resolve({ id: "evt-1" })),
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const { rollbackDeployment, getRollbackOptions } = await import(
  "./deploy-rollback.service"
)

describe("deploy-rollback.service", () => {
  beforeEach(() => {
    mockPrisma.deployment.create.mockClear()
    mockPrisma.deployEvent.create.mockClear()
  })

  it("rollbackDeployment creates rollback deployment", async () => {
    const result = await rollbackDeployment({
      stackId: "stack-1",
      targetDeploymentId: "dep-old",
    })

    expect(result).toHaveProperty("deploymentId")
    expect(result.status).toBe("QUEUED")
    expect(mockPrisma.deployment.create).toHaveBeenCalled()
    expect(mockPrisma.deployEvent.create).toHaveBeenCalled()
  })

  it("rollbackDeployment fails for non-running target", async () => {
    mockPrisma.deployment.findUniqueOrThrow.mockResolvedValueOnce({
      ...mockTargetDeployment,
      status: "FAILED",
    })

    await expect(
      rollbackDeployment({
        stackId: "stack-1",
        targetDeploymentId: "dep-old",
      })
    ).rejects.toThrow("Can only rollback to a successful deployment")
  })

  it("getRollbackOptions returns successful deployments", async () => {
    const result = await getRollbackOptions("stack-1")
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("dep-old")
  })
})