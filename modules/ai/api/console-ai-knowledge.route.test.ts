import { describe, it, expect, mock, beforeEach } from "bun:test"
mock.module("server-only", () => ({}))

// Mock WorkOS auth before imports
const mockAuth = mock(() =>
  Promise.resolve({
    user: { id: "user_1", organizationId: "org_1" },
    organizationId: "org_1",
  })
)
mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockAuth,
}))

// Mock Prisma
const mockPrisma = {
  aiKnowledgeDocument: {
    findMany: mock(),
    findFirst: mock(),
    create: mock(),
    update: mock(),
    delete: mock(),
  },
}
mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

// Mock BullMQ worker functions
const mockEnqueue = mock(() => Promise.resolve("job_123"))
const mockScheduleSync = mock(() => Promise.resolve("repeat_job_123"))
const mockRemoveSync = mock(() => Promise.resolve(true))

mock.module("@/modules/ai/ai-ingestion.worker", () => ({
  enqueueDocumentIngestion: mockEnqueue,
  schedulePeriodicCrawlerSync: mockScheduleSync,
  removePeriodicCrawlerSync: mockRemoveSync,
}))

const { createConsoleAiKnowledgeRoutes } =
  await import("./console-ai-knowledge.route")

describe("Console AI Knowledge Route", () => {
  let app: ReturnType<typeof createConsoleAiKnowledgeRoutes>

  beforeEach(() => {
    mockAuth.mockClear()
    mockPrisma.aiKnowledgeDocument.findMany.mockClear()
    mockPrisma.aiKnowledgeDocument.findFirst.mockClear()
    mockPrisma.aiKnowledgeDocument.create.mockClear()
    mockPrisma.aiKnowledgeDocument.update.mockClear()
    mockPrisma.aiKnowledgeDocument.delete.mockClear()
    mockEnqueue.mockClear()
    mockScheduleSync.mockClear()
    mockRemoveSync.mockClear()

    mockAuth.mockResolvedValue({
      user: { id: "user_1", organizationId: "org_1" },
      organizationId: "org_1",
    })

    app = createConsoleAiKnowledgeRoutes()
  })

  it("lists knowledge documents for tenant", async () => {
    mockPrisma.aiKnowledgeDocument.findMany.mockResolvedValue([
      {
        id: "doc_1",
        title: "Product Catalog 2026",
        purpose: "Catalog",
        category: "Pricelist",
        sourceType: "PDF",
        sourceUrl: null,
        crawlMode: "SINGLE_PAGE",
        syncSchedule: "MANUAL",
        lastSyncedAt: null,
        contentHash: null,
        status: "READY",
        pageCount: 14,
        chunkIndex: 0,
        errorMessage: null,
        agentProfileId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])

    const res = await app.handle(
      new Request("http://localhost/console/ai/knowledge", { method: "GET" })
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; data: unknown[] }
    expect(json.ok).toBe(true)
    expect(json.data.length).toBe(1)
  })

  it("accepts document upload, creates record, and enqueues job", async () => {
    mockPrisma.aiKnowledgeDocument.create.mockResolvedValue({
      id: "doc_new",
      organizationId: "org_1",
      title: "SOP Pengembalian Barang",
      purpose: "SOP",
      category: "Support",
      sourceType: "PDF",
      status: "QUEUED",
    })

    const res = await app.handle(
      new Request("http://localhost/console/ai/knowledge/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "SOP Pengembalian Barang",
          purpose: "SOP",
          category: "Support",
          sourceType: "PDF",
          sourceUrl: "https://s3.example.com/docs/sop.pdf",
          contentMarkdown: "# SOP Retur Barang\n1. Sertakan bukti...",
        }),
      })
    )

    expect(res.status).toBe(202)
    const json = (await res.json()) as {
      ok: boolean
      data: { id: string; status: string }
    }
    expect(json.ok).toBe(true)
    expect(json.data.status).toBe("QUEUED")
    expect(mockPrisma.aiKnowledgeDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceUrl: "https://s3.example.com/docs/sop.pdf",
        }),
      })
    )
    expect(mockEnqueue).toHaveBeenCalled()
  })

  it("accepts URL crawler ingest and schedules periodic sync", async () => {
    mockPrisma.aiKnowledgeDocument.create.mockResolvedValue({
      id: "doc_url_1",
      organizationId: "org_1",
      title: "example.com/docs/faq",
      purpose: "Tenant Web Knowledge",
      category: "Website",
      sourceType: "URL_FIRECRAWL",
      sourceUrl: "https://example.com/docs/faq",
      crawlMode: "SUBPATH_RECURSIVE",
      syncSchedule: "WEEKLY",
      status: "QUEUED",
    })

    const res = await app.handle(
      new Request("http://localhost/console/ai/knowledge/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com/docs/faq",
          crawlMode: "SUBPATH_RECURSIVE",
          syncSchedule: "WEEKLY",
        }),
      })
    )

    expect(res.status).toBe(202)
    const json = (await res.json()) as {
      ok: boolean
      data: { id: string; status: string; crawlMode: string }
    }
    expect(json.ok).toBe(true)
    expect(json.data.status).toBe("QUEUED")
    expect(json.data.crawlMode).toBe("SUBPATH_RECURSIVE")
    expect(mockScheduleSync).toHaveBeenCalledWith({
      documentId: "doc_url_1",
      organizationId: "org_1",
      syncSchedule: "WEEKLY",
    })
  })

  it("rejects private/reserved IP target in URL crawler endpoint", async () => {
    const res = await app.handle(
      new Request("http://localhost/console/ai/knowledge/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "http://127.0.0.1:8080/admin",
        }),
      })
    )

    expect(res.status).toBe(400)
    const json = (await res.json()) as { ok: boolean; error: string }
    expect(json.ok).toBe(false)
    expect(json.error).toBe("INVALID_URL")
    expect(mockPrisma.aiKnowledgeDocument.create).not.toHaveBeenCalled()
  })

  it("marks document as FAILED if queueing fails", async () => {
    mockPrisma.aiKnowledgeDocument.create.mockResolvedValue({
      id: "doc_fail",
      organizationId: "org_1",
      title: "Broken Doc",
      status: "QUEUED",
    })
    mockEnqueue.mockRejectedValueOnce(new Error("Redis connection timeout"))

    const res = await app.handle(
      new Request("http://localhost/console/ai/knowledge/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Broken Doc",
          sourceType: "PDF",
        }),
      })
    )

    expect(res.status).toBe(500)
    const json = (await res.json()) as { ok: boolean; error: string }
    expect(json.ok).toBe(false)
    expect(json.error).toBe("QUEUE_FAILED")
    expect(mockPrisma.aiKnowledgeDocument.update).toHaveBeenCalledWith({
      where: { id: "doc_fail" },
      data: {
        status: "FAILED",
        errorMessage: "Redis connection timeout",
      },
    })
  })

  it("deletes document and removes scheduled sync", async () => {
    mockPrisma.aiKnowledgeDocument.findFirst.mockResolvedValue({
      id: "doc_1",
      organizationId: "org_1",
      syncSchedule: "WEEKLY",
    })
    mockPrisma.aiKnowledgeDocument.delete.mockResolvedValue({ id: "doc_1" })

    const res = await app.handle(
      new Request("http://localhost/console/ai/knowledge/doc_1", {
        method: "DELETE",
      })
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean }
    expect(json.ok).toBe(true)
    expect(mockRemoveSync).toHaveBeenCalledWith("doc_1")
    expect(mockPrisma.aiKnowledgeDocument.delete).toHaveBeenCalled()
  })
})
