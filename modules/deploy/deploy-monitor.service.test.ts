import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockFindMany = mock(() => Promise.resolve([]))
const mockUpdateDeployment = mock(() => Promise.resolve({}))
const mockUpdateStack = mock(() => Promise.resolve({}))
const mockCount = mock(() => Promise.resolve(0))

mock.module("@/lib/prisma", () => ({
  prisma: {
    applicationDeployment: {
      findMany: mockFindMany,
      update: mockUpdateDeployment,
      count: mockCount,
    },
    applicationStack: {
      update: mockUpdateStack,
    },
  },
}))

const mockRecordDeployEventOnce = mock(() => Promise.resolve({}))
const mockRecordDeployLog = mock(() => Promise.resolve({}))
mock.module("./deploy-event.service", () => ({
  recordDeployEventOnce: mockRecordDeployEventOnce,
  recordDeployLog: mockRecordDeployLog,
}))

const mockProcessQueuedDeployment = mock(() =>
  Promise.resolve({ processed: false, status: "QUEUED" })
)
mock.module("./deploy-builder.service", () => ({
  processQueuedDeployment: mockProcessQueuedDeployment,
}))

const mockPollDeploymentRollout = mock(() => Promise.resolve({ status: null }))
mock.module("./argocd-rollout.service", () => ({
  pollDeploymentRollout: mockPollDeploymentRollout,
}))

import {
  getMonitorStats,
  monitorActiveDeployments,
} from "./deploy-monitor.service"

describe("deploy-monitor.service", () => {
  beforeEach(() => {
    mockFindMany.mockClear()
    mockUpdateDeployment.mockClear()
    mockUpdateStack.mockClear()
    mockCount.mockClear()
    mockRecordDeployEventOnce.mockClear()
    mockRecordDeployLog.mockClear()
    mockProcessQueuedDeployment.mockClear()
    mockPollDeploymentRollout.mockClear()
  })

  it("monitors active deployments and processes queued ones", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: "dep-1",
        stackId: "stack-1",
        status: "QUEUED",
        manifestPushed: false,
        argocdSynced: false,
        attempt: 1,
        stack: { name: "my-app" },
      },
    ] as unknown as never)

    mockProcessQueuedDeployment.mockResolvedValueOnce({
      processed: true,
      status: "RUNNING",
    } as unknown as never)

    const results = await monitorActiveDeployments()

    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({
      deploymentId: "dep-1",
      status: "RUNNING",
      manifestPushed: true,
      argocdSynced: true,
    })
    expect(mockProcessQueuedDeployment).toHaveBeenCalledWith("dep-1")
  })

  it("handles deploying status with completed rollout", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: "dep-2",
        stackId: "stack-1",
        status: "DEPLOYING",
        manifestPushed: true,
        argocdSynced: false,
        attempt: 1,
        stack: { name: "my-app" },
      },
    ] as unknown as never)

    mockPollDeploymentRollout.mockResolvedValueOnce({
      status: { syncStatus: "Synced" },
      completed: true,
    } as unknown as never)

    const results = await monitorActiveDeployments()

    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({
      deploymentId: "dep-2",
      status: "RUNNING",
      manifestPushed: true,
      argocdSynced: true,
    })
  })

  it("handles building status and records progress logs", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: "dep-3",
        stackId: "stack-1",
        status: "BUILDING",
        manifestPushed: false,
        argocdSynced: false,
        attempt: 1,
        stack: { name: "my-app" },
      },
      {
        id: "dep-4",
        stackId: "stack-1",
        status: "BUILDING",
        manifestPushed: true,
        argocdSynced: false,
        attempt: 1,
        stack: { name: "my-app" },
      },
    ] as unknown as never)

    const results = await monitorActiveDeployments()

    expect(results).toHaveLength(2)
    expect(mockRecordDeployLog).toHaveBeenCalledTimes(2)
  })

  it("handles failure during checkDeploymentStatus and updates deployment and stack", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: "dep-fail",
        stackId: "stack-fail",
        status: "QUEUED",
        manifestPushed: false,
        argocdSynced: false,
        attempt: 1,
        stack: { name: "failed-app" },
      },
    ] as unknown as never)

    mockProcessQueuedDeployment.mockRejectedValueOnce(
      new Error("Build cluster unreachable")
    )

    const results = await monitorActiveDeployments()

    expect(results).toHaveLength(0)
    expect(mockUpdateDeployment).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dep-fail" },
        data: expect.objectContaining({
          status: "FAILED",
          failureReason: "Build cluster unreachable",
        }),
      })
    )
    expect(mockRecordDeployEventOnce).toHaveBeenCalledWith({
      deploymentId: "dep-fail",
      type: "DEPLOY_FAILED",
      message: "Monitor detected failure: Build cluster unreachable",
    })
    expect(mockUpdateStack).toHaveBeenCalledWith({
      where: { id: "stack-fail" },
      data: { lastDeployStatus: "FAILED" },
    })
  })

  it("returns aggregated monitor stats", async () => {
    mockCount
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(12)

    const stats = await getMonitorStats()

    expect(stats).toEqual({
      active: 5,
      recentFailed: 2,
      recentSuccess: 12,
    })
    expect(mockCount).toHaveBeenCalledTimes(3)
  })
})
