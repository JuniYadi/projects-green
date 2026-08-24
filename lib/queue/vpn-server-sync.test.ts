import { describe, expect, it, mock } from "bun:test"

const mockGetJob = mock()
const mockEnqueue = mock()

class MockQueue {
  async getJob(id: string) {
    return mockGetJob(id)
  }
}

const { VpnServerSyncJob } = await import("./vpn-server-sync")
describe("VpnServerSyncJob", () => {
  it("dispatches job with safe jobId vpn-sync-<serverId>", async () => {
    mockGetJob.mockResolvedValue(null)
    VpnServerSyncJob.getQueue = () => new MockQueue() as never
    VpnServerSyncJob.enqueue = mockEnqueue

    const dispatched = await VpnServerSyncJob.dispatch("srv-123", "corr-1")

    expect(dispatched).toBe(true)
    expect(mockGetJob).toHaveBeenCalledWith("vpn-sync-srv-123")
    expect(mockEnqueue).toHaveBeenCalledWith(
      { serverId: "srv-123", correlationId: "corr-1" },
      { jobId: "vpn-sync-srv-123" }
    )
  })

  it("skips dispatch when active job exists", async () => {
    mockGetJob.mockResolvedValue({
      getState: async () => "active",
    })
    mockEnqueue.mockClear()
    VpnServerSyncJob.getQueue = () => new MockQueue() as never
    VpnServerSyncJob.enqueue = mockEnqueue

    const dispatched = await VpnServerSyncJob.dispatch("srv-456")

    expect(dispatched).toBe(false)
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it("allows redispatch when existing job is completed or failed", async () => {
    mockGetJob.mockResolvedValue({
      getState: async () => "completed",
    })
    mockEnqueue.mockClear()
    VpnServerSyncJob.getQueue = () => new MockQueue() as never
    VpnServerSyncJob.enqueue = mockEnqueue

    const dispatched = await VpnServerSyncJob.dispatch("srv-789")

    expect(dispatched).toBe(true)
    expect(mockEnqueue).toHaveBeenCalledWith(
      { serverId: "srv-789", correlationId: null },
      { jobId: "vpn-sync-srv-789" }
    )
  })
})
