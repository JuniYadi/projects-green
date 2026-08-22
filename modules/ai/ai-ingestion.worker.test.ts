import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { Job } from "bullmq"

import {
  processDocumentIngestionJob,
  type AiDocumentIngestionJobData,
} from "./ai-ingestion.worker"

// Mock Prisma
const mockUpdate = mock(async () => ({}))
const mockUpdateMany = mock(async () => ({ count: 1 }))
const mockFindMany = mock(async () => [] as Array<{ pageCount: number }>)

mock.module("@/lib/prisma", () => ({
  prisma: {
    aiKnowledgeDocument: {
      update: mockUpdate,
      updateMany: mockUpdateMany,
      findMany: mockFindMany,
    },
    aiProviderConfig: {
      findFirst: mock(async () => null),
    },
  },
}))

describe("aiIngestionWorker", () => {
  beforeEach(() => {
    mockUpdate.mockReset()
    mockUpdateMany.mockReset()
    mockFindMany.mockReset()
    mockFindMany.mockResolvedValue([])
  })

  it("processes document ingestion, updates pageCount, and sets status to READY", async () => {
    const job = {
      id: "job_1",
      data: {
        documentId: "doc_1",
        organizationId: "org_1",
        filename: "daftar-harga.md",
        rawContent:
          "# Pricelist Toko\n\n- Kaos Polos: Rp 45.000\n- Celana Chino: Rp 120.000",
        sourceType: "MANUAL",
      },
    } as unknown as Job<AiDocumentIngestionJobData>

    const result = await processDocumentIngestionJob(job)

    expect(result.success).toBe(true)
    expect(result.pageCount).toBe(1)
    expect(result.chunkCount).toBeGreaterThanOrEqual(1)
    expect(mockUpdate).toHaveBeenCalledTimes(2) // 1. PROCESSING, 2. READY
  })

  it("fails and marks document as FAILED when page quota is exceeded", async () => {
    mockFindMany.mockResolvedValueOnce([
      { pageCount: 995 }, // 995 + 10 = 1005 > 1000 limit
    ])

    const job = {
      id: "job_2",
      data: {
        documentId: "doc_2",
        organizationId: "org_1",
        filename: "manual-tebal.pdf",
        rawContent: "%PDF-1.4\n/Count 10\n%%EOF",
        sourceType: "PDF",
      },
    } as unknown as Job<AiDocumentIngestionJobData>

    expect(processDocumentIngestionJob(job)).rejects.toThrow(
      "STORAGE_QUOTA_EXCEEDED"
    )
  })
})
