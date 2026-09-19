import { Queue, Worker, type Job } from "bullmq"
import { getRedisConnection } from "@/lib/queue/queue-config"
import { prisma } from "@/lib/prisma"
import {
  chunkMarkdownHierarchically,
  parseDocumentContent,
} from "./ai-parser.service"
import { resolveAiProviderConfig } from "./ai-provider.factory"
import {
  computeContentHash,
  shouldUpdateDocument,
  webCrawlerService,
} from "./crawler/web-crawler.service"

export const AI_DOCUMENT_INGESTION_QUEUE = "ai-document-ingestion"

export type AiDocumentIngestionJobData = {
  documentId: string
  organizationId: string
  agentProfileId?: string | null
  filename: string
  rawContent?: string
  sourceType: "PDF" | "DOCX" | "URL_FIRECRAWL" | "MANUAL"
  sourceUrl?: string | null
  crawlMode?: "SINGLE_PAGE" | "SUBPATH_RECURSIVE"
  syncSchedule?: "MANUAL" | "WEEKLY" | "MONTHLY"
  isPeriodicSync?: boolean
}

// Tenant storage quota limits (in pages)
export const STORAGE_LIMITS = {
  STARTER: 100,
  PRO: 1000,
}

let ingestionQueue: Queue<AiDocumentIngestionJobData> | null = null

export function getAiIngestionQueue(): Queue<AiDocumentIngestionJobData> {
  if (!ingestionQueue) {
    ingestionQueue = new Queue<AiDocumentIngestionJobData>(
      AI_DOCUMENT_INGESTION_QUEUE,
      {
        connection: getRedisConnection(),
      }
    )
  }
  return ingestionQueue
}

/**
 * Enqueues a document ingestion task to BullMQ.
 * Returns immediately for sub-50ms API response.
 */
export async function enqueueDocumentIngestion(
  data: AiDocumentIngestionJobData
): Promise<string> {
  const queue = getAiIngestionQueue()
  const job = await queue.add("ingest-document", data, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  })

  return job.id || data.documentId
}

export function getCrawlerSyncJobId(documentId: string): string {
  return `crawler-sync-${documentId}`
}

export function getCronPatternForSchedule(
  schedule: "WEEKLY" | "MONTHLY"
): string {
  if (schedule === "WEEKLY") {
    return "0 0 * * 0"
  }
  return "0 0 1 * *"
}

/**
 * Schedules periodic crawler synchronization job in BullMQ.
 */
export async function schedulePeriodicCrawlerSync(params: {
  documentId: string
  organizationId: string
  syncSchedule: "WEEKLY" | "MONTHLY"
}): Promise<string> {
  const queue = getAiIngestionQueue()
  const jobId = getCrawlerSyncJobId(params.documentId)

  await removePeriodicCrawlerSync(params.documentId)

  const cron = getCronPatternForSchedule(params.syncSchedule)
  const job = await queue.add(
    "crawler-periodic-sync",
    {
      documentId: params.documentId,
      organizationId: params.organizationId,
      filename: `sync-${params.documentId}.url`,
      sourceType: "URL_FIRECRAWL",
      syncSchedule: params.syncSchedule,
      isPeriodicSync: true,
    },
    {
      repeat: {
        pattern: cron,
      },
      jobId,
      removeOnComplete: 50,
      removeOnFail: 100,
    }
  )

  return job.id || jobId
}

/**
 * Removes periodic crawler synchronization job from BullMQ.
 */
export async function removePeriodicCrawlerSync(
  documentId: string
): Promise<boolean> {
  const queue = getAiIngestionQueue()
  const repeatableJobs = await queue.getRepeatableJobs()
  const targetPrefix = `crawler-sync-${documentId}`

  let removed = false
  for (const job of repeatableJobs) {
    if (job.id === targetPrefix || job.key.startsWith(`${targetPrefix}:::`)) {
      await queue.removeRepeatableByKey(job.key)
      removed = true
    }
  }
  return removed
}

/**
 * Core processor for BullMQ document ingestion worker.
 */
export async function processDocumentIngestionJob(
  job: Job<AiDocumentIngestionJobData>
): Promise<{
  success: boolean
  pageCount: number
  chunkCount: number
  skippedUnchanged?: boolean
}> {
  const { documentId, organizationId, filename, rawContent, sourceType } =
    job.data

  try {
    // 1. Mark status as PROCESSING
    await prisma.aiKnowledgeDocument.update({
      where: { id: documentId },
      data: { status: "PROCESSING" },
    })

    if (sourceType === "URL_FIRECRAWL") {
      const doc = await prisma.aiKnowledgeDocument.findUnique({
        where: { id: documentId },
      })
      if (!doc) {
        throw new Error(`DOCUMENT_NOT_FOUND: Document ${documentId} not found`)
      }

      const targetUrl = job.data.sourceUrl || doc.sourceUrl
      if (!targetUrl) {
        throw new Error(
          "MISSING_SOURCE_URL: URL is required for URL_FIRECRAWL"
        )
      }

      const crawlMode = (job.data.crawlMode ||
        doc.crawlMode ||
        "SINGLE_PAGE") as "SINGLE_PAGE" | "SUBPATH_RECURSIVE"

      const crawlResult = await webCrawlerService.crawlUrl(targetUrl, {
        crawlMode,
      })

      const hasChanged = shouldUpdateDocument(
        doc.contentHash,
        crawlResult.contentHash
      )

      if (!hasChanged) {
        await prisma.aiKnowledgeDocument.update({
          where: { id: documentId },
          data: {
            status: "READY",
            lastSyncedAt: new Date(),
          },
        })
        return {
          success: true,
          pageCount: doc.pageCount,
          chunkCount: 0,
          skippedUnchanged: true,
        }
      }

      // Quota check
      const currentDocs = await prisma.aiKnowledgeDocument.findMany({
        where: {
          organizationId,
          status: { in: ["READY", "PROCESSING"] },
          NOT: { id: documentId },
        },
        select: { pageCount: true },
      })

      const totalPagesUsed = currentDocs.reduce(
        (sum, d) => sum + d.pageCount,
        0
      )
      const allowedLimit = STORAGE_LIMITS.PRO

      if (totalPagesUsed + crawlResult.pageCount > allowedLimit) {
        await prisma.aiKnowledgeDocument.update({
          where: { id: documentId },
          data: {
            status: "FAILED",
            errorMessage:
              `STORAGE_QUOTA_EXCEEDED: Exceeds page limit of ` +
              `${allowedLimit} pages.`,
            pageCount: crawlResult.pageCount,
          },
        })
        throw new Error(
          `STORAGE_QUOTA_EXCEEDED: Max ${allowedLimit} pages allowed.`
        )
      }

      const chunks = chunkMarkdownHierarchically(crawlResult.contentMarkdown)

      await resolveAiProviderConfig({
        organizationId,
      })

      const embedding: number[] = []

      await prisma.aiKnowledgeDocument.update({
        where: { id: documentId },
        data: {
          status: "READY",
          title: doc.title || crawlResult.title,
          contentMarkdown: crawlResult.contentMarkdown,
          contentHash: crawlResult.contentHash,
          pageCount: crawlResult.pageCount,
          lastSyncedAt: new Date(),
          searchText: crawlResult.contentMarkdown,
          errorMessage: null,
          embedding,
        },
      })

      return {
        success: true,
        pageCount: crawlResult.pageCount,
        chunkCount: chunks.length,
      }
    }

    // 2. Parse document with AnyDoc and calculate pageCount with pdf-inspector
    const buffer = Buffer.from(rawContent || "")
    const parseResult = parseDocumentContent(buffer, filename, rawContent)
    const contentHash = computeContentHash(parseResult.contentMarkdown)

    // 3. Quota check: Count total current pages in org
    const currentDocs = await prisma.aiKnowledgeDocument.findMany({
      where: {
        organizationId,
        status: { in: ["READY", "PROCESSING"] },
        NOT: { id: documentId },
      },
      select: { pageCount: true },
    })

    const totalPagesUsed = currentDocs.reduce((sum, d) => sum + d.pageCount, 0)
    const allowedLimit = STORAGE_LIMITS.PRO // default tenant limit

    if (totalPagesUsed + parseResult.pageCount > allowedLimit) {
      await prisma.aiKnowledgeDocument.update({
        where: { id: documentId },
        data: {
          status: "FAILED",
          errorMessage:
            `STORAGE_QUOTA_EXCEEDED: Exceeds page limit of ` +
            `${allowedLimit} pages.`,
          pageCount: parseResult.pageCount,
        },
      })
      throw new Error(
        `STORAGE_QUOTA_EXCEEDED: Max ${allowedLimit} pages allowed.`
      )
    }

    // 4. Resolve BYOK provider credentials for zero-cost embedding
    await resolveAiProviderConfig({
      organizationId,
    })

    // Embeddings remain empty until the resolved provider pipeline is wired.
    const embedding: number[] = []

    // 5. Update parent document status to READY
    await prisma.aiKnowledgeDocument.update({
      where: { id: documentId },
      data: {
        status: "READY",
        pageCount: parseResult.pageCount,
        contentMarkdown: parseResult.contentMarkdown,
        contentHash,
        searchText: parseResult.contentMarkdown,
        errorMessage: null,
        embedding,
      },
    })

    return {
      success: true,
      pageCount: parseResult.pageCount,
      chunkCount: parseResult.chunks.length,
    }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : "Unknown error"
    await prisma.aiKnowledgeDocument.updateMany({
      where: { id: documentId },
      data: {
        status: "FAILED",
        errorMessage: errMessage,
      },
    })
    throw error
  }
}

/**
 * Creates BullMQ worker instance for background document ingestion.
 */
export function createAiIngestionWorker(): Worker<AiDocumentIngestionJobData> {
  return new Worker<AiDocumentIngestionJobData>(
    AI_DOCUMENT_INGESTION_QUEUE,
    processDocumentIngestionJob,
    {
      connection: getRedisConnection(),
      concurrency: 2,
    }
  )
}
