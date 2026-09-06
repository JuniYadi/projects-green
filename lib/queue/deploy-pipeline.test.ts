import { beforeEach, describe, expect, it, mock } from "bun:test"
import { DeployPipelineJob, enqueueDeployment } from "./deploy-pipeline"

const mockProcessQueuedDeployment = mock(async () => ({
  processed: true,
  status: "BUILDING",
}))

mock.module("@/modules/deploy/deploy-builder.service", () => ({
  processQueuedDeployment: mockProcessQueuedDeployment,
}))

describe("DeployPipelineJob", () => {
  beforeEach(() => {
    mockProcessQueuedDeployment.mockClear()
  })

  it("configures expected queue settings", () => {
    expect(DeployPipelineJob.queue).toBe("deploy-pipeline")
    expect(DeployPipelineJob.workerConcurrency).toBe(2)
    expect(DeployPipelineJob.attempts).toBe(3)
  })

  it("processes deployment in handle", async () => {
    await DeployPipelineJob.handle({
      data: { deploymentId: "deploy-123" },
    })

    expect(mockProcessQueuedDeployment).toHaveBeenCalledWith("deploy-123")
  })

  it("dispatches job safely with enqueueDeployment helper", async () => {
    const mockDispatch = mock(async () => {})
    DeployPipelineJob.dispatch = mockDispatch

    const success = await enqueueDeployment("deploy-456")
    expect(success).toBe(true)
    expect(mockDispatch).toHaveBeenCalledWith("deploy-456")
  })

  it("returns false and logs error when dispatch fails", async () => {
    DeployPipelineJob.dispatch = mock(async () => {
      throw new Error("Redis connection failed")
    })

    const success = await enqueueDeployment("deploy-789")
    expect(success).toBe(false)
  })
})
