import { describe, expect, it, mock, beforeEach } from "bun:test"

const mockClient = {
  indices: {
    exists: mock(() => Promise.resolve({ body: false })),
    create: mock(() => Promise.resolve({ body: { acknowledged: true } })),
    putMapping: mock(() => Promise.resolve({ body: { acknowledged: true } })),
  },
}

mock.module("@/lib/opensearch", () => ({
  getOpenSearchClient: () => mockClient,
}))

const { ensureLogIndex, getLogIndexName } =
  await import("./opensearch-index.service")

describe("OpenSearch Index Service", () => {
  beforeEach(() => {
    mockClient.indices.exists.mockClear()
    mockClient.indices.create.mockClear()
  })

  it("generates correct index name from tenant and date", () => {
    const name = getLogIndexName("acme-corp", new Date("2026-06-01"))
    expect(name).toBe("deploy-logs-acme-corp-2026.06")
  })

  it("creates index if it does not exist", async () => {
    mockClient.indices.exists.mockResolvedValue({ body: false })
    await ensureLogIndex("acme-corp")
    expect(mockClient.indices.create).toHaveBeenCalled()
  })

  it("skips creation if index already exists", async () => {
    mockClient.indices.exists.mockResolvedValue({ body: true })
    await ensureLogIndex("acme-corp")
    expect(mockClient.indices.create).not.toHaveBeenCalled()
  })

  it("handles race condition when index already exists between exists check and create", async () => {
    mockClient.indices.exists.mockResolvedValue({ body: false })
    mockClient.indices.create.mockRejectedValueOnce(
      new Error("resource_already_exists_exception")
    )

    // Should not throw
    const result = await ensureLogIndex("acme-corp")
    expect(result).toBe(getLogIndexName("acme-corp"))
  })
})
