import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test"
import type { Job } from "bullmq"
import type { AiDocumentIngestionJobData } from "./ai-ingestion.worker"

// Mock BullMQ queue
const mockQueueAdd = mock(async () => ({ id: "repeat_job_1" }))
const mockQueueGetRepeatableJobs = mock(async () => [
  {
    key: "crawler-sync-doc_crawl_1:::0 0 * * 0",
    id: "crawler-sync-doc_crawl_1",
    name: "crawler-periodic-sync",
  },
])
const mockQueueRemoveRepeatableByKey = mock(async () => true)

mock.module("bullmq", () => ({
  Queue: class {
    add = mockQueueAdd
    getRepeatableJobs = mockQueueGetRepeatableJobs
    removeRepeatableByKey = mockQueueRemoveRepeatableByKey
  },
  Worker: class {},
}))

// Mock Prisma
const mockUpdate = mock(async () => ({}))
const mockUpdateMany = mock(async () => ({ count: 1 }))
const mockFindMany = mock(async () => [] as Array<{ pageCount: number }>)
const mockFindUnique = mock(async () => null as unknown)

mock.module("@/lib/prisma", () => ({
  prisma: {
    aiKnowledgeDocument: {
      update: mockUpdate,
      updateMany: mockUpdateMany,
      findMany: mockFindMany,
      findUnique: mockFindUnique,
    },
    aiProviderConfig: {
      findFirst: mock(async () => null),
    },
  },
}))

const {
  processDocumentIngestionJob,
  schedulePeriodicCrawlerSync,
  removePeriodicCrawlerSync,
  getCronPatternForSchedule,
} = await import("./ai-ingestion.worker")
const { webCrawlerService } = await import("./crawler/web-crawler.service")

describe("aiIngestionWorker", () => {
  let crawlSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    mockUpdate.mockReset()
    mockUpdateMany.mockReset()
    mockFindMany.mockReset()
    mockFindMany.mockResolvedValue([])
    mockFindUnique.mockReset()
    mockQueueAdd.mockClear()
    mockQueueGetRepeatableJobs.mockClear()
    mockQueueRemoveRepeatableByKey.mockClear()

    crawlSpy = spyOn(webCrawlerService, "crawlUrl").mockImplementation(
      async () => ({
        title: "Crawled FAQ",
        contentMarkdown: "# FAQ\n\nFrequently asked questions.",
        contentHash: "hash_new_123",
        pageCount: 2,
        pages: [],
      })
    )
  })

  afterEach(() => {
    crawlSpy.mockRestore()
  })

  it("processes manual ingestion and sets status to READY", async () => {
    const job = {
      id: "job_1",
      data: {
        documentId: "doc_1",
        organizationId: "org_1",
        filename: "daftar-harga.md",
        rawContent:
          "# Pricelist Toko\n\n- Kaos: Rp 45.000\n- Celana: Rp 120.000",
        sourceType: "MANUAL",
      },
    } as unknown as Job<AiDocumentIngestionJobData>

    const result = await processDocumentIngestionJob(job)

    expect(result.success).toBe(true)
    expect(result.pageCount).toBe(1)
    expect(result.chunkCount).toBeGreaterThanOrEqual(1)
    expect(mockUpdate).toHaveBeenCalledTimes(2)
  })

  it("crawls and ingests URL target when hash has changed", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: "doc_url_1",
      organizationId: "org_1",
      sourceUrl: "https://example.com/faq",
      crawlMode: "SINGLE_PAGE",
      contentHash: "hash_old_000",
      pageCount: 1,
    })

    const job = {
      id: "job_crawler_1",
      data: {
        documentId: "doc_url_1",
        organizationId: "org_1",
        filename: "faq.url",
        sourceType: "URL_FIRECRAWL",
        sourceUrl: "https://example.com/faq",
      },
    } as unknown as Job<AiDocumentIngestionJobData>

    const result = await processDocumentIngestionJob(job)

    expect(result.success).toBe(true)
    expect(result.pageCount).toBe(2)
    expect(crawlSpy).toHaveBeenCalledWith("https://example.com/faq", {
      crawlMode: "SINGLE_PAGE",
    })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "doc_url_1" },
        data: expect.objectContaining({
          contentHash: "hash_new_123",
          status: "READY",
        }),
      })
    )
  })

  it("skips re-embedding when contentHash has not changed", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: "doc_url_same",
      organizationId: "org_1",
      sourceUrl: "https://example.com/faq",
      crawlMode: "SINGLE_PAGE",
      contentHash: "hash_new_123", // Matches crawled hash
      pageCount: 2,
    })

    const job = {
      id: "job_crawler_same",
      data: {
        documentId: "doc_url_same",
        organizationId: "org_1",
        filename: "faq.url",
        sourceType: "URL_FIRECRAWL",
        sourceUrl: "https://example.com/faq",
      },
    } as unknown as Job<AiDocumentIngestionJobData>

    const result = await processDocumentIngestionJob(job)

    expect(result.success).toBe(true)
    expect(result.skippedUnchanged).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "doc_url_same" },
        data: expect.objectContaining({
          status: "READY",
          lastSyncedAt: expect.any(Date),
        }),
      })
    )
  })

  it("schedules periodic crawler sync using BullMQ repeatable", async () => {
    expect(getCronPatternForSchedule("WEEKLY")).toBe("0 0 * * 0")
    expect(getCronPatternForSchedule("MONTHLY")).toBe("0 0 1 * *")

    await schedulePeriodicCrawlerSync({
      documentId: "doc_crawl_1",
      organizationId: "org_1",
      syncSchedule: "WEEKLY",
    })

    expect(mockQueueAdd).toHaveBeenCalledWith(
      "crawler-periodic-sync",
      expect.objectContaining({
        documentId: "doc_crawl_1",
        syncSchedule: "WEEKLY",
        isPeriodicSync: true,
      }),
      expect.objectContaining({
        repeat: { pattern: "0 0 * * 0" },
        jobId: "crawler-sync-doc_crawl_1",
      })
    )
  })

  it("removes periodic crawler sync from BullMQ queue", async () => {
    const removed = await removePeriodicCrawlerSync("doc_crawl_1")
    expect(removed).toBe(true)
    expect(mockQueueRemoveRepeatableByKey).toHaveBeenCalled()
  })

  it("fails and marks document FAILED when quota is exceeded", async () => {
    mockFindMany.mockResolvedValueOnce([
      { pageCount: 995 },
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
