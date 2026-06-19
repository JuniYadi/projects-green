/**
 * Seed script for generating embeddings for existing DocsKnowledgeDocuments.
 *
 * Usage: bun run scripts/seed-embeddings.ts [--dry-run] [--limit=N] [--org=<orgId>]
 *
 * Options:
 *   --dry-run     Preview documents to be processed without modifying DB
 *   --limit=N     Process only N documents (default: all)
 *   --org=<orgId> Process only documents for a specific organization
 *
 * Env vars:
 *   AI_API_KEY        OpenRouter API key (required)
 *   AI_EMBEDDING_MODEL  Embedding model (default: text-embedding-3-small)
 */

import { prisma } from "@/lib/prisma"
import { embedDocument } from "@/modules/docs/docs-embedding.service"

const DRY_RUN = Bun.argv.includes("--dry-run")
const LIMIT_ARG = Bun.argv.find((a) => a.startsWith("--limit="))
const ORG_ARG = Bun.argv.find((a) => a.startsWith("--org="))

const limit = LIMIT_ARG ? parseInt(LIMIT_ARG.split("=")[1], 10) : undefined
const orgId = ORG_ARG ? ORG_ARG.split("=")[1] : undefined

async function main() {
  console.log("=== Knowledge Document Embedding Seed ===")
  console.log(
    `Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "LIVE (will update DB)"}`
  )
  if (limit) console.log(`Limit: ${limit} documents`)
  if (orgId) console.log(`Organization: ${orgId}`)

  const where: Record<string, unknown> = {}
  if (orgId) {
    where.organizationId = orgId
  }

  const total = await prisma.docsKnowledgeDocument.count({ where })
  console.log(`\nFound ${total} documents to process`)

  if (total === 0) {
    console.log("No documents found. Exiting.")
    return
  }

  if (DRY_RUN) {
    const docs = await prisma.docsKnowledgeDocument.findMany({
      where,
      take: limit ?? 10,
      select: { id: true, path: true, title: true },
    })

    console.log("\nDocuments that would be processed:")
    docs.forEach((doc, i) => {
      console.log(`  ${i + 1}. ${doc.path} (${doc.title})`)
    })
    return
  }

  let processed = 0
  let errors = 0

  console.log("\nProcessing documents...")

  let cursor: string | undefined
  let hasMore = true

  while (hasMore) {
    const docs = await prisma.docsKnowledgeDocument.findMany({
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

        await prisma.docsKnowledgeDocument.update({
          where: { id: doc.id },
          data: { embedding },
        })

        processed++
        const pct = ((processed / total) * 100).toFixed(1)
        process.stdout.write(`\r  Progress: ${processed}/${total} (${pct}%)  `)
      } catch (err) {
        errors++
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`\n  Error [${doc.id}]: ${msg}`)
      }
    }

    cursor = docs[docs.length - 1]?.id
    hasMore = docs.length === 50
  }

  console.log(`\n\nDone!`)
  console.log(`  Processed: ${processed}`)
  console.log(`  Errors: ${errors}`)
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
