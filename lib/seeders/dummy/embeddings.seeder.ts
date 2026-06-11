/**
 * Embeddings Dummy Seeder
 *
 * Migrated from scripts/seed-embeddings.ts.
 * Generates vector embeddings for existing KnowledgeDocuments.
 *
 * CLI args (passed via seed-runner):
 *   --dry-run       Preview documents without modifying DB
 *   --limit=N       Process only N documents (default: all)
 *   --org=<orgId>   Process only documents for a specific organization
 *
 * Required env vars:
 *   AI_API_KEY          OpenRouter API key
 *   AI_EMBEDDING_MODEL  (optional) Embedding model name
 */

import { BaseSeeder } from "../base-seeder"
import { registerSeeder } from "../registry"

class EmbeddingsSeeder extends BaseSeeder {
  static override readonly seederName = "Embeddings"
  static override readonly classification = "dummy" as const
  static override readonly runOrder = 30
  static override readonly description =
    "Generate vector embeddings for KnowledgeDocuments"
  static override readonly requiredEnvVars = ["AI_API_KEY"] as const

  async seed(): Promise<void> {
    const dryRun = this.cliArgs.has("--dry-run")
    const limitStr = this.cliArgs.get("--limit")
    const limit = limitStr ? parseInt(limitStr, 10) : undefined
    const orgId = this.cliArgs.get("--org")?.trim()

    this.log(
      `Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE (will update DB)"}`,
    )
    if (limit) this.log(`Limit: ${limit} documents`)
    if (orgId) this.log(`Organization: ${orgId}`)

    const where: Record<string, unknown> = {}
    if (orgId) {
      where.organizationId = orgId
    }

    const total = await this.prisma.knowledgeDocument.count({ where })
    this.log(`Found ${total} documents to process`)

    if (total === 0) {
      this.log("No documents found. Nothing to do.")
      return
    }

    if (dryRun) {
      const docs = await this.prisma.knowledgeDocument.findMany({
        where,
        take: limit ?? 10,
        select: { id: true, path: true, title: true },
      })

      this.log("Documents that would be processed:")
      docs.forEach((doc, i) => {
        this.log(`  ${i + 1}. ${doc.path} (${doc.title})`)
      })
      this.trackSkipped(docs.length)
      return
    }

    // Lazy import to avoid pulling in the service when dry-running
    const { embedDocument } = await import(
      "@/modules/docs/docs-embedding.service"
    )

    let processed = 0
    let errors = 0

    this.log("Processing documents...")

    let cursor: string | undefined
    let hasMore = true

    while (hasMore) {
      const docs = await this.prisma.knowledgeDocument.findMany({
        where,
        take: 50,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
      })

      if (docs.length === 0) {
        hasMore = false
        break
      }

      if (limit && processed >= limit) {
        hasMore = false
        break
      }

      for (const doc of docs) {
        if (limit && processed >= limit) break

        try {
          const embedding = await embedDocument({
            path: doc.path,
            title: doc.title,
            purpose: doc.purpose,
            howTo: doc.howTo,
            notes: doc.notes,
          })

          await this.prisma.knowledgeDocument.update({
            where: { id: doc.id },
            data: { embedding },
          })

          processed++
          this.trackUpdated()
          const pct = ((processed / total) * 100).toFixed(1)
          process.stdout.write(
            `\r  [Embeddings] Progress: ${processed}/${total} (${pct}%)  `,
          )
        } catch (err) {
          errors++
          const msg = err instanceof Error ? err.message : String(err)
          this.trackError(`[${doc.id}]: ${msg}`)
        }
      }

      cursor = docs[docs.length - 1]?.id
      hasMore = docs.length === 50
    }

    // Newline after progress output
    process.stdout.write("\n")

    this.log(`Processed: ${processed}, Errors: ${errors}`)
  }

  async unseed(): Promise<void> {
    const orgId = this.cliArgs.get("--org")?.trim()

    this.log(
      orgId
        ? `Clearing embeddings for org=${orgId}`
        : "Clearing all document embeddings",
    )

    const where: Record<string, unknown> = {}
    if (orgId) {
      where.organizationId = orgId
    }

    const result = await this.prisma.knowledgeDocument.updateMany({
      where,
      data: { embedding: [] },
    })

    this.trackDeleted(result.count)
    this.log(`Cleared embeddings on ${result.count} documents`)
  }
}

registerSeeder(EmbeddingsSeeder)
