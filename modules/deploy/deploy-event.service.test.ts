import { describe, it, expect, beforeEach, mock } from "bun:test"

const mockPrisma = {
  applicationDeployEvent: {
    create: mock(() => Promise.resolve({ id: "evt-1", type: "QUEUED" })),
    findMany: mock(() => Promise.resolve([])),
    upsert: mock(() => Promise.resolve({ id: "evt-1", type: "QUEUED" })),
  },
  applicationDeploymentLog: {
    create: mock(() => Promise.resolve({ id: "log-1" })),
    findMany: mock(() => Promise.resolve([])),
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const {
  recordDeployEvent,
  recordDeployEventOnce,
  recordDeployLog,
  getDeployEvents,
  getDeployLogs,
} = await import("./deploy-event.service")

describe("deploy-event.service", () => {
  beforeEach(() => {
    mockPrisma.applicationDeployEvent.create.mockClear()
    mockPrisma.applicationDeployEvent.findMany.mockClear()
    mockPrisma.applicationDeployEvent.upsert.mockClear()
    mockPrisma.applicationDeploymentLog.create.mockClear()
    mockPrisma.applicationDeploymentLog.findMany.mockClear()
  })

  it("recordDeployEvent creates event", async () => {
    const result = await recordDeployEvent({
      deploymentId: "dep-1",
      type: "QUEUED",
      message: "Test",
    })

    expect(result).toBeDefined()
    expect(mockPrisma.applicationDeployEvent.create).toHaveBeenCalledWith({
      data: {
        deploymentId: "dep-1",
        type: "QUEUED",
        message: "Test",
        metadataJson: null,
      },
    })
  })

  it("recordDeployEventOnce upserts by deploymentId+type", async () => {
    const result = await recordDeployEventOnce({
      deploymentId: "dep-1",
      type: "QUEUED",
      message: "Test upsert",
    })
    expect(result).toBeDefined()
    expect(mockPrisma.applicationDeployEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deploymentId_type: {
            deploymentId: "dep-1",
            type: "QUEUED",
          },
        },
        create: expect.objectContaining({
          deploymentId: "dep-1",
          type: "QUEUED",
          message: "Test upsert",
        }),
        update: expect.objectContaining({
          message: "Test upsert",
        }),
      })
    )
  })

  it("recordDeployLog creates log", async () => {
    const result = await recordDeployLog({
      deploymentId: "dep-1",
      scope: "build",
      status: "info",
      message: "Test log",
    })

    expect(result).toBeDefined()
    expect(mockPrisma.applicationDeploymentLog.create).toHaveBeenCalled()
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
