import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { Job } from "bullmq"

const mockProcessGithubWebhookEvent = mock(() =>
  Promise.resolve({ outcome: "processed", branch: "main" })
)

mock.module("@/modules/github/github.webhook", () => ({
  processGithubWebhookEvent: mockProcessGithubWebhookEvent,
}))

const mockEnqueue = mock(() => Promise.resolve())

mock.module("@/lib/queue/base-job", () => {
  class BaseJob {
    static enqueue = mockEnqueue
  }
  return { BaseJob }
})

import { GithubEventJob } from "./github-event.job"

describe("GithubEventJob", () => {
  beforeEach(() => {
    mockProcessGithubWebhookEvent.mockClear()
    mockEnqueue.mockClear()
  })

  it("exposes queue configuration and static metadata", () => {
    expect(GithubEventJob.queue).toBe("github-events")
    expect(GithubEventJob.workerConcurrency).toBe(4)
    expect(GithubEventJob.attempts).toBe(5)
  })

  it("dispatches job with eventId and prefixed jobId", async () => {
    const enqueueSpy = mock(() => Promise.resolve())
    ;(GithubEventJob as unknown as { enqueue: typeof enqueueSpy }).enqueue =
      enqueueSpy

    await GithubEventJob.dispatch("evt_12345")

    expect(enqueueSpy).toHaveBeenCalledWith(
      { eventId: "evt_12345" },
      { jobId: "github-event_evt_12345" }
    )
  })

  it("handles job execution with custom attempts", async () => {
    const fakeJob = {
      data: { eventId: "evt_999" },
      opts: { attempts: 5 },
      attemptsMade: 2,
    } as unknown as Job<{ eventId: string }>

    await GithubEventJob.handle(fakeJob)

    expect(mockProcessGithubWebhookEvent).toHaveBeenCalledWith({
      eventId: "evt_999",
      attemptNumber: 3,
      maxAttempts: 5,
    })
  })

  it("defaults maxAttempts to 1 if job.opts.attempts is not a number", async () => {
    const fakeJob = {
      data: { eventId: "evt_fallback" },
      opts: {},
      attemptsMade: 0,
    } as unknown as Job<{ eventId: string }>

    await GithubEventJob.handle(fakeJob)

    expect(mockProcessGithubWebhookEvent).toHaveBeenCalledWith({
      eventId: "evt_fallback",
      attemptNumber: 1,
      maxAttempts: 1,
    })
  })

  it("propagates error when processGithubWebhookEvent throws", async () => {
    mockProcessGithubWebhookEvent.mockRejectedValueOnce(
      new Error("Database connection lost")
    )

    const fakeJob = {
      data: { eventId: "evt_err" },
      opts: { attempts: 3 },
      attemptsMade: 1,
    } as unknown as Job<{ eventId: string }>

    await expect(GithubEventJob.handle(fakeJob)).rejects.toThrow(
      "Database connection lost"
    )
  })
})
