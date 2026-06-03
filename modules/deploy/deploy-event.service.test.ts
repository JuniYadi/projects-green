import { describe, it, expect, beforeEach, mock } from "bun:test"

const mockPrisma = {
  deployEvent: {
    create: mock(() => Promise.resolve({ id: "evt-1", type: "QUEUED" })),
    findMany: mock(() => Promise.resolve([])),
  },
  deploymentLog: {
    create: mock(() => Promise.resolve({ id: "log-1" })),
    findMany: mock(() => Promise.resolve([])),
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const { recordDeployEvent, recordDeployLog, getDeployEvents, getDeployLogs } =
  await import("./deploy-event.service")

describe("deploy-event.service", () => {
  beforeEach(() => {
    mockPrisma.deployEvent.create.mockClear()
    mockPrisma.deployEvent.findMany.mockClear()
    mockPrisma.deploymentLog.create.mockClear()
    mockPrisma.deploymentLog.findMany.mockClear()
  })

  it("recordDeployEvent creates event", async () => {
    const result = await recordDeployEvent({
      deploymentId: "dep-1",
      type: "QUEUED",
      message: "Test",
    })

    expect(result).toBeDefined()
    expect(mockPrisma.deployEvent.create).toHaveBeenCalledWith({
      data: {
        deploymentId: "dep-1",
        type: "QUEUED",
        message: "Test",
        metadataJson: null,
      },
    })
  })

  it("recordDeployLog creates log", async () => {
    const result = await recordDeployLog({
      deploymentId: "dep-1",
      scope: "build",
      status: "info",
      message: "Test log",
    })

    expect(result).toBeDefined()
    expect(mockPrisma.deploymentLog.create).toHaveBeenCalled()
  })

  it("getDeployEvents returns events", async () => {
    const result = await getDeployEvents("dep-1")
    expect(result).toEqual([])
  })

  it("getDeployLogs returns logs", async () => {
    const result = await getDeployLogs("dep-1")
    expect(result).toEqual([])
  })
})