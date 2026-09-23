import { beforeEach, describe, expect, it, mock } from "bun:test"
import {
  AppHostingStackLifecycleJob,
  enqueueStackLifecycle,
} from "./app-hosting-stack-lifecycle"

describe("AppHostingStackLifecycleJob", () => {
  const originalHandler = AppHostingStackLifecycleJob.handler
  const originalDispatch = AppHostingStackLifecycleJob.dispatch
  const originalEnqueue = AppHostingStackLifecycleJob.enqueue

  beforeEach(() => {
    AppHostingStackLifecycleJob.handler = originalHandler
    AppHostingStackLifecycleJob.dispatch = originalDispatch
    AppHostingStackLifecycleJob.enqueue = originalEnqueue
  })

  it("configures expected queue settings with app-hosting prefix", () => {
    expect(AppHostingStackLifecycleJob.queue).toBe(
      "app-hosting-stack-lifecycle"
    )
    expect(AppHostingStackLifecycleJob.workerConcurrency).toBe(2)
    expect(AppHostingStackLifecycleJob.attempts).toBe(3)
  })

  it("dispatches job with formatted jobId via enqueue", async () => {
    const mockEnqueue = mock(async () => undefined as never)
    AppHostingStackLifecycleJob.enqueue = mockEnqueue

    await AppHostingStackLifecycleJob.dispatch({
      stackId: "stack-777",
      action: "resume",
    })

    expect(mockEnqueue).toHaveBeenCalledWith(
      { stackId: "stack-777", action: "resume" },
      { jobId: "app-hosting-stack-lifecycle_resume_stack-777" }
    )
  })

  it("executes default handler delegating to processStackLifecycleJob", async () => {
    // Calling originalHandler executes the dynamic import and handler body
    await expect(
      originalHandler({ stackId: "missing-stack", action: "suspend" })
    ).rejects.toThrow()
  })

  it("processes lifecycle action in handle", async () => {
    const mockHandler = mock(async () => ({
      gitopsPushed: true,
      argocdSynced: true,
    }))
    AppHostingStackLifecycleJob.handler = mockHandler

    await AppHostingStackLifecycleJob.handle({
      data: { stackId: "stack-123", action: "suspend" },
    })

    expect(mockHandler).toHaveBeenCalledWith({
      stackId: "stack-123",
      action: "suspend",
    })
  })

  it("dispatches job safely with enqueueStackLifecycle helper", async () => {
    const mockDispatch = mock(async () => {})
    AppHostingStackLifecycleJob.dispatch = mockDispatch

    const success = await enqueueStackLifecycle({
      stackId: "stack-456",
      action: "resume",
    })
    expect(success).toBe(true)
    expect(mockDispatch).toHaveBeenCalledWith({
      stackId: "stack-456",
      action: "resume",
    })
  })

  it("returns false and logs error when dispatch fails", async () => {
    AppHostingStackLifecycleJob.dispatch = mock(async () => {
      throw new Error("Redis connection failed")
    })

    const success = await enqueueStackLifecycle({
      stackId: "stack-789",
      action: "suspend",
    })
    expect(success).toBe(false)
  })
})
