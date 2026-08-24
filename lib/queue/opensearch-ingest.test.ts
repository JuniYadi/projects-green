import { describe, expect, it, mock } from "bun:test"

const mockAdd = mock((..._args: unknown[]) =>
  Promise.resolve({ id: "mock-job-id" })
)
const mockAddBulk = mock((..._args: unknown[]) =>
  Promise.resolve([{ id: "mock-job-1" }, { id: "mock-job-2" }])
)

class MockQueue {
  async add(...args: unknown[]) {
    return mockAdd(...args)
  }
  async addBulk(...args: unknown[]) {
    return mockAddBulk(...args)
  }
}

mock.module("bullmq", () => ({
  Queue: MockQueue,
}))

const { enqueueLogEntry, enqueueLogBatch } = await import("./opensearch-ingest")

describe("opensearch-ingest", () => {
  it("enqueues a log entry with UUID v7 job ID without colons", async () => {
    mockAdd.mockClear()
    await enqueueLogEntry({
      tenantSlug: "tenant-abc",
      timestamp: "2026-08-24T00:00:12.696Z",
      level: "INFO",
      source: "app",
      message: "test log",
    })

    expect(mockAdd).toHaveBeenCalledTimes(1)
    const call = (mockAdd.mock.calls as unknown[][])[0]
    expect(call[0]).toBe("ingest")
    const opts = call[2] as { jobId: string }
    expect(opts.jobId).toMatch(
      /^opensearch-ingest_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(opts.jobId).not.toContain(":")
  })

  it("enqueues log batch with distinct UUID v7 job IDs without colons", async () => {
    mockAddBulk.mockClear()
    await enqueueLogBatch([
      {
        tenantSlug: "tenant-1",
        timestamp: "2026-08-24T00:00:12.000Z",
        level: "INFO",
        source: "app",
        message: "batch 1",
      },
      {
        tenantSlug: "tenant-2",
        timestamp: "2026-08-24T00:00:13.000Z",
        level: "WARN",
        source: "app",
        message: "batch 2",
      },
    ])

    expect(mockAddBulk).toHaveBeenCalledTimes(1)
    const calls = mockAddBulk.mock.calls as unknown[][]
    const jobs = calls[0][0] as Array<{
      name: string
      data: unknown
      opts: { jobId: string }
    }>
    expect(jobs).toHaveLength(2)
    expect(jobs[0].opts.jobId).toMatch(
      /^opensearch-ingest_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(jobs[1].opts.jobId).toMatch(
      /^opensearch-ingest_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(jobs[0].opts.jobId).not.toContain(":")
    expect(jobs[1].opts.jobId).not.toContain(":")
    expect(jobs[0].opts.jobId).not.toBe(jobs[1].opts.jobId)
  })
})
