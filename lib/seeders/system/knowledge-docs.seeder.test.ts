import { describe, expect, it, mock } from "bun:test"

const mockPrisma = {}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

mock.module("@/modules/docs/docs-embedding.service", () => ({
  embedDocument: mock(async () => []),
}))
describe("KnowledgeDocsSeeder", () => {
  it("defines proper system classification and metadata", async () => {
    const { KnowledgeDocsSeeder } = await import("./knowledge-docs.seeder")
    expect(KnowledgeDocsSeeder.seederName).toBe("KnowledgeDocs")
    expect(KnowledgeDocsSeeder.classification).toBe("system")
    expect(KnowledgeDocsSeeder.runOrder).toBe(15)
  })

  it("parses yaml frontmatter and locale correctly", async () => {
    const { parseKnowledgeMarkdown } = await import("./knowledge-docs.seeder")
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

  it("discovers both English and Indonesian markdown files", async () => {
    const { loadAllKnowledgeDocs } = await import("./knowledge-docs.seeder")
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
})
