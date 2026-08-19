/**
 * Knowledge Base Docs Seeder (System)
 *
 * Scans all raw Markdown files in content/knowledge-base directory,
 * extracts YAML frontmatter & markdown content, and synchronizes
 * documents and vector embeddings into Postgres table `KnowledgeDocument`.
 */

import { BaseSeeder, registerSeeder } from "@/lib/seeders"
import { embedDocument } from "@/modules/docs/docs-embedding.service"
import { createHash } from "node:crypto"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import yaml from "js-yaml"

export interface KnowledgeDocParsed {
  path: string
  title: string
  purpose: string
  category: string
  howTo: string[]
  notes: string[]
  markdown: string
}

type Frontmatter = {
  path?: string
  title?: string
  purpose?: string
  category?: string
  howTo?: string[]
  notes?: string[]
}

export function parseKnowledgeMarkdown(raw: string): KnowledgeDocParsed | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return null

  const [, frontmatterRaw, markdownBody] = match
  const meta = yaml.load(frontmatterRaw) as Frontmatter

  if (!meta || !meta.path || !meta.title || !meta.purpose) {
    return null
  }

  return {
    path: meta.path,
    title: meta.title,
    purpose: meta.purpose,
    category: meta.category || "General",
    howTo: Array.isArray(meta.howTo) ? meta.howTo : [],
    notes: Array.isArray(meta.notes) ? meta.notes : [],
    markdown: markdownBody.trim(),
  }
}

export function loadAllKnowledgeDocs(dirPath?: string): KnowledgeDocParsed[] {
  const rootDir = dirPath || join(process.cwd(), "content", "knowledge-base")
  const results: KnowledgeDocParsed[] = []

  function scan(dir: string) {
    let entries: string[] = []
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        scan(fullPath)
      } else if (entry.endsWith(".md") || entry.endsWith(".mdx")) {
        const raw = readFileSync(fullPath, "utf8")
        const parsed = parseKnowledgeMarkdown(raw)
        if (parsed) {
          results.push(parsed)
        }
      }
    }
  }

  scan(rootDir)
  return results
}

export class KnowledgeDocsSeeder extends BaseSeeder {
  static override readonly seederName = "KnowledgeDocs"
  static override readonly classification = "system" as const
  static override readonly runOrder = 15
  static override readonly description =
    "Scans content/knowledge-base/**/*.md and synchronizes knowledge base docs & vector embeddings"

  async seed(): Promise<void> {
    this.log("Scanning content/knowledge-base for markdown documentation...")
    const docs = loadAllKnowledgeDocs()

    if (docs.length === 0) {
      this.log("No markdown files found in content/knowledge-base. Skipping.")
      return
    }

    this.log(`Found ${docs.length} knowledge base document(s) to process.`)

    for (const doc of docs) {
      const contentHash = createHash("sha256")
        .update(doc.title + doc.purpose + doc.markdown)
        .digest("hex")

      const searchText = [
        doc.path,
        doc.title,
        doc.purpose,
        ...doc.howTo,
        ...doc.notes,
        doc.markdown,
      ]
        .join(" ")
        .toLowerCase()

      const existing = await this.prisma.docsKnowledgeDocument.findFirst({
        where: { path: doc.path, organizationId: null },
      })

      if (!existing) {
        this.log(`Creating knowledge doc: ${doc.path}`)
        let embedding: number[] = []
        try {
          embedding = await embedDocument({
            path: doc.path,
            title: doc.title,
            purpose: doc.purpose,
            howTo: doc.howTo,
            notes: doc.notes,
          })
        } catch {
          embedding = []
        }

        await this.prisma.docsKnowledgeDocument.create({
          data: {
            organizationId: null,
            path: doc.path,
            title: doc.title,
            purpose: doc.purpose,
            category: doc.category,
            contentMarkdown: doc.markdown,
            contentHash,
            isPublic: true,
            howTo: doc.howTo,
            notes: doc.notes,
            searchText,
            embedding,
            updatedByWorkosUserId: "system",
          },
        })
        this.trackCreated()
      } else if (existing.contentHash !== contentHash) {
        this.log(`Updating knowledge doc (content changed): ${doc.path}`)
        let embedding: number[] = []
        try {
          embedding = await embedDocument({
            path: doc.path,
            title: doc.title,
            purpose: doc.purpose,
            howTo: doc.howTo,
            notes: doc.notes,
          })
        } catch {
          embedding = existing.embedding
        }

        await this.prisma.docsKnowledgeDocument.update({
          where: { id: existing.id },
          data: {
            title: doc.title,
            purpose: doc.purpose,
            category: doc.category,
            contentMarkdown: doc.markdown,
            contentHash,
            isPublic: true,
            howTo: doc.howTo,
            notes: doc.notes,
            searchText,
            embedding,
            updatedAt: new Date(),
          },
        })
        this.trackUpdated()
      } else {
        this.log(`Skipping unchanged knowledge doc: ${doc.path}`)
        this.trackSkipped()
      }
    }
  }
}

registerSeeder(KnowledgeDocsSeeder)
