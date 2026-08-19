import { beforeEach, describe, expect, it, mock, type Mock } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// ── Mocks — must be declared before module imports ────────────────────────

const docsKnowledgeDocumentFindFirst = mock(async () => null as unknown)
const docsKnowledgeDocumentCreate = mock(
  async (args: { data: unknown }) => args.data
)
const docsKnowledgeDocumentUpdate = mock(
  async (args: { data: unknown }) => args.data
)

// embedDocument is in a module on the ignore list — mock it so the seeder
// can run without a real embedding API.
const embedDocumentMock: Mock<() => Promise<number[]>> = mock(async () => [
  0.1, 0.2, 0.3,
])

mock.module("@/lib/prisma", () => ({
  prisma: {
    docsKnowledgeDocument: {
      findFirst: docsKnowledgeDocumentFindFirst,
      create: docsKnowledgeDocumentCreate,
      update: docsKnowledgeDocumentUpdate,
    },
  },
}))

mock.module("@/modules/docs/docs-embedding.service", () => ({
  embedDocument: embedDocumentMock,
}))

// Dynamic import is required here: mock.module() must intercept the prisma
// and embedding dependencies BEFORE the seeder module is evaluated.
// This is the standard Bun mock pattern for modules with side-effect imports.
const { KnowledgeDocsSeeder, loadAllKnowledgeDocs, parseKnowledgeMarkdown } =
  await import("./knowledge-docs.seeder")

// ── Helpers ───────────────────────────────────────────────────────────────

function resetMocks() {
  docsKnowledgeDocumentFindFirst.mockClear()
  docsKnowledgeDocumentCreate.mockClear()
  docsKnowledgeDocumentUpdate.mockClear()
  embedDocumentMock.mockClear()
  docsKnowledgeDocumentFindFirst.mockResolvedValue(null)
  embedDocumentMock.mockResolvedValue([0.1, 0.2, 0.3])
}

function makeRaw(
  overrides: Record<string, unknown> = {},
  body = "# Content\nsome text"
) {
  const fm: Record<string, unknown> = {
    path: "/test/doc",
    locale: "en",
    title: "Test Doc",
    purpose: "Testing",
    category: "Testing",
    howTo: ["Step 1", "Step 2"],
    notes: ["Note 1"],
    ...overrides,
  }
  const lines = Object.entries(fm)
    .filter(([, v]) => v !== undefined)
    .flatMap(([k, v]) => {
      if (Array.isArray(v)) {
        return [`${k}:`, ...(v as string[]).map((i) => `  - "${i}"`)]
      }
      return [`${k}: ${String(v)}`]
    })
    .join("\n")
  return `---\n${lines}\n---\n${body}`
}

// ── parseKnowledgeMarkdown ────────────────────────────────────────────────

describe("parseKnowledgeMarkdown", () => {
  it("returns null when there is no frontmatter delimiter", () => {
    expect(parseKnowledgeMarkdown("just plain text")).toBeNull()
  })

  it("returns null when required field path is missing", () => {
    const raw = makeRaw({ path: undefined })
    expect(parseKnowledgeMarkdown(raw)).toBeNull()
  })

  it("returns null when required field title is missing", () => {
    const raw = makeRaw({ title: undefined })
    expect(parseKnowledgeMarkdown(raw)).toBeNull()
  })

  it("returns null when required field purpose is missing", () => {
    const raw = makeRaw({ purpose: undefined })
    expect(parseKnowledgeMarkdown(raw)).toBeNull()
  })

  it("uses inferredLocale when locale is not in frontmatter", () => {
    const raw = makeRaw({ locale: undefined })
    const parsed = parseKnowledgeMarkdown(raw, "id")
    expect(parsed?.locale).toBe("id")
  })

  it("uses frontmatter locale over inferredLocale", () => {
    const raw = makeRaw({ locale: "id" })
    const parsed = parseKnowledgeMarkdown(raw, "en")
    expect(parsed?.locale).toBe("id")
  })

  it("defaults inferredLocale to 'en' when not supplied", () => {
    const raw = makeRaw({ locale: undefined })
    const parsed = parseKnowledgeMarkdown(raw)
    expect(parsed?.locale).toBe("en")
  })

  it("defaults category to 'General' when absent", () => {
    const raw = makeRaw({ category: undefined })
    const parsed = parseKnowledgeMarkdown(raw)
    expect(parsed?.category).toBe("General")
  })

  it("defaults howTo to [] when absent", () => {
    const raw = makeRaw({ howTo: undefined })
    const parsed = parseKnowledgeMarkdown(raw)
    expect(parsed?.howTo).toEqual([])
  })

  it("defaults notes to [] when absent", () => {
    const raw = makeRaw({ notes: undefined })
    const parsed = parseKnowledgeMarkdown(raw)
    expect(parsed?.notes).toEqual([])
  })

  it("trims the markdown body", () => {
    const raw = makeRaw({}, "\n\n# Heading\n\n")
    const parsed = parseKnowledgeMarkdown(raw)
    expect(parsed?.markdown.startsWith("\n")).toBe(false)
    expect(parsed?.markdown.endsWith("\n")).toBe(false)
  })

  it("parses yaml frontmatter and locale correctly", () => {
    const raw = `---
path: /test/feature
locale: id
title: Fitur Pengujian
category: Testing
purpose: Menguji parser markdown
howTo:
  - "Langkah 1"
  - "Langkah 2"
notes:
  - "Catatan 1"
---

# Fitur Pengujian
Konten dokumen dalam Bahasa Indonesia.
`
    const parsed = parseKnowledgeMarkdown(raw, "en")
    expect(parsed).not.toBeNull()
    expect(parsed?.path).toBe("/test/feature")
    expect(parsed?.locale).toBe("id")
    expect(parsed?.title).toBe("Fitur Pengujian")
    expect(parsed?.category).toBe("Testing")
    expect(parsed?.howTo).toEqual(["Langkah 1", "Langkah 2"])
    expect(parsed?.notes).toEqual(["Catatan 1"])
    expect(parsed?.markdown).toContain("Konten dokumen dalam Bahasa Indonesia")
  })
})

// ── loadAllKnowledgeDocs ──────────────────────────────────────────────────

describe("loadAllKnowledgeDocs", () => {
  it("discovers both English and Indonesian markdown files from real content dir", () => {
    const docs = loadAllKnowledgeDocs()
    expect(docs.length).toBeGreaterThanOrEqual(2)

    const enDoc = docs.find(
      (d) => d.path === "/whatsapp/api-keys" && d.locale === "en"
    )
    const idDoc = docs.find(
      (d) => d.path === "/whatsapp/api-keys" && d.locale === "id"
    )

    expect(enDoc).toBeDefined()
    expect(enDoc?.title).toBe("WhatsApp API Key Management & Integration Guide")

    expect(idDoc).toBeDefined()
    expect(idDoc?.title).toBe(
      "Panduan Pengelolaan & Integrasi WhatsApp API Key"
    )
  })

  it("returns empty array for nonexistent directory", () => {
    const docs = loadAllKnowledgeDocs("/nonexistent/path/that/does/not/exist")
    expect(docs).toEqual([])
  })

  it("skips files without valid frontmatter", () => {
    const dir = join(tmpdir(), `kb-test-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    try {
      writeFileSync(join(dir, "bad.md"), "no frontmatter here")
      const docs = loadAllKnowledgeDocs(dir)
      expect(docs).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("infers locale 'id' from filename like doc.id.md", () => {
    const dir = join(tmpdir(), `kb-test-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    try {
      writeFileSync(join(dir, "doc.id.md"), makeRaw({ locale: undefined }))
      const docs = loadAllKnowledgeDocs(dir)
      expect(docs[0]?.locale).toBe("id")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("infers locale 'en' for plain .md files", () => {
    const dir = join(tmpdir(), `kb-test-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    try {
      writeFileSync(join(dir, "doc.md"), makeRaw({ locale: undefined }))
      const docs = loadAllKnowledgeDocs(dir)
      expect(docs[0]?.locale).toBe("en")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("recurses into subdirectories", () => {
    const dir = join(tmpdir(), `kb-test-${Date.now()}`)
    const sub = join(dir, "sub")
    mkdirSync(sub, { recursive: true })
    try {
      writeFileSync(join(sub, "nested.md"), makeRaw())
      const docs = loadAllKnowledgeDocs(dir)
      expect(docs.length).toBe(1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

// ── KnowledgeDocsSeeder.seed() ────────────────────────────────────────────

describe("KnowledgeDocsSeeder", () => {
  it("defines proper system classification and metadata", () => {
    expect(KnowledgeDocsSeeder.seederName).toBe("KnowledgeDocs")
    expect(KnowledgeDocsSeeder.classification).toBe("system")
    expect(KnowledgeDocsSeeder.runOrder).toBe(15)
  })

  describe("seed()", () => {
    beforeEach(resetMocks)

    it("creates a new document when none exists", async () => {
      docsKnowledgeDocumentFindFirst.mockResolvedValue(null)
      const seeder = new KnowledgeDocsSeeder()
      await seeder.seed()

      expect(docsKnowledgeDocumentCreate).toHaveBeenCalled()
      const result = seeder.getResult()
      expect(result.created).toBeGreaterThan(0)
    })

    it("updates an existing document when content hash changed", async () => {
      docsKnowledgeDocumentFindFirst.mockResolvedValue({
        id: "doc-001",
        contentHash: "stale-hash-that-will-not-match",
        embedding: [0.5],
      })

      const seeder = new KnowledgeDocsSeeder()
      await seeder.seed()

      expect(docsKnowledgeDocumentUpdate).toHaveBeenCalled()
      const result = seeder.getResult()
      expect(result.updated).toBeGreaterThan(0)
    })

    it("skips all documents when content hashes are unchanged", async () => {
      // First run: create all docs and capture their hashes
      docsKnowledgeDocumentFindFirst.mockResolvedValue(null)
      const seeder1 = new KnowledgeDocsSeeder()
      await seeder1.seed()

      // Build a map of path+locale → hash from what was created
      const hashMap = new Map<string, string>()
      for (const call of docsKnowledgeDocumentCreate.mock.calls as [
        { data: { path: string; locale: string; contentHash: string } },
      ][]) {
        hashMap.set(
          `${call[0].data.path}:${call[0].data.locale}`,
          call[0].data.contentHash
        )
      }

      // Second run: return existing record with matching hash per path+locale
      resetMocks()
      docsKnowledgeDocumentFindFirst.mockImplementation(
        async (args: unknown) => {
          const { where } = args as { where: { path: string; locale: string } }
          const hash = hashMap.get(`${where.path}:${where.locale}`)
          if (!hash) return null
          return { id: "doc-001", contentHash: hash, embedding: [0.1] }
        }
      )

      const seeder2 = new KnowledgeDocsSeeder()
      await seeder2.seed()

      expect(docsKnowledgeDocumentCreate).not.toHaveBeenCalled()
      expect(docsKnowledgeDocumentUpdate).not.toHaveBeenCalled()
      const result = seeder2.getResult()
      expect(result.skipped).toBeGreaterThan(0)
    })

    it("falls back to empty embedding when embedDocument throws on create", async () => {
      embedDocumentMock.mockRejectedValueOnce(new Error("embed error"))
      docsKnowledgeDocumentFindFirst.mockResolvedValue(null)

      const seeder = new KnowledgeDocsSeeder()
      await seeder.seed()

      const [firstCreateArg] = docsKnowledgeDocumentCreate.mock.calls[0] as [
        { data: { embedding: number[] } },
      ]
      expect(firstCreateArg.data.embedding).toEqual([])
    })

    it("falls back to existing embedding when embedDocument throws on update", async () => {
      embedDocumentMock.mockRejectedValueOnce(new Error("embed error"))

      const existingEmbedding = [9.9, 8.8]
      docsKnowledgeDocumentFindFirst.mockResolvedValue({
        id: "doc-001",
        contentHash: "stale-hash",
        embedding: existingEmbedding,
      })

      const seeder = new KnowledgeDocsSeeder()
      await seeder.seed()

      const [firstUpdateArg] = docsKnowledgeDocumentUpdate.mock.calls[0] as [
        { data: { embedding: number[] } },
      ]
      expect(firstUpdateArg.data.embedding).toEqual(existingEmbedding)
    })
  })
})
