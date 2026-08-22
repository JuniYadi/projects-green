import { describe, it, expect, mock, beforeEach } from "bun:test"
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

// Mock BullMQ enqueue
const mockEnqueue = mock(() => Promise.resolve("job_123"))
mock.module("@/modules/ai/ai-ingestion.worker", () => ({
  enqueueDocumentIngestion: mockEnqueue,
}))

import { createConsoleAiKnowledgeRoutes } from "./console-ai-knowledge.route"

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

  it("accepts document upload, creates record, and enqueues BullMQ job", async () => {
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
    expect(mockPrisma.aiKnowledgeDocument.create).toHaveBeenCalled()
    expect(mockEnqueue).toHaveBeenCalled()
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

  it("deletes document", async () => {
    mockPrisma.aiKnowledgeDocument.findFirst.mockResolvedValue({
      id: "doc_1",
      organizationId: "org_1",
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
    expect(mockPrisma.aiKnowledgeDocument.delete).toHaveBeenCalled()
  })
})
