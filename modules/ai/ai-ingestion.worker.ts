import { Queue, Worker, type Job } from "bullmq"
import { getRedisConnection } from "@/lib/queue/queue-config"
import { prisma } from "@/lib/prisma"
import { parseDocumentContent } from "./ai-parser.service"
import { resolveAiProviderConfig } from "./ai-provider.factory"

export const AI_DOCUMENT_INGESTION_QUEUE = "ai-document-ingestion"

export type AiDocumentIngestionJobData = {
  documentId: string
  organizationId: string
  agentProfileId?: string | null
  filename: string
  rawContent?: string
  sourceType: "PDF" | "DOCX" | "URL_FIRECRAWL" | "MANUAL"
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

/**
 * Core processor for BullMQ document ingestion worker.
 */
export async function processDocumentIngestionJob(
  job: Job<AiDocumentIngestionJobData>
): Promise<{ success: boolean; pageCount: number; chunkCount: number }> {
  const { documentId, organizationId, filename, rawContent } = job.data

  try {
    // 1. Mark status as PROCESSING
    await prisma.aiKnowledgeDocument.update({
      where: { id: documentId },
      data: { status: "PROCESSING" },
    })

    // 2. Parse document with AnyDoc and calculate pageCount with pdf-inspector
    const buffer = Buffer.from(rawContent || "")
    const parseResult = parseDocumentContent(buffer, filename, rawContent)

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
          errorMessage: `STORAGE_QUOTA_EXCEEDED: Exceeds page limit of ${allowedLimit} pages.`,
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

    // Mock/Generate 1536-dim vector for chunks
    const dummyEmbedding = new Array(1536).fill(0.01)

    // 5. Update parent document status to READY
    await prisma.aiKnowledgeDocument.update({
      where: { id: documentId },
      data: {
        status: "READY",
        pageCount: parseResult.pageCount,
        contentMarkdown: parseResult.contentMarkdown,
        searchText: parseResult.contentMarkdown,
        embedding: dummyEmbedding,
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
