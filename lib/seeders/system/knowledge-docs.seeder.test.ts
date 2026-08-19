import { describe, expect, it } from "bun:test"
import {
  KnowledgeDocsSeeder,
  loadAllKnowledgeDocs,
  parseKnowledgeMarkdown,
} from "./knowledge-docs.seeder"

describe("KnowledgeDocsSeeder", () => {
  it("defines proper system classification and metadata", () => {
    expect(KnowledgeDocsSeeder.seederName).toBe("KnowledgeDocs")
    expect(KnowledgeDocsSeeder.classification).toBe("system")
    expect(KnowledgeDocsSeeder.runOrder).toBe(15)
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

  it("discovers both English and Indonesian markdown files", () => {
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
