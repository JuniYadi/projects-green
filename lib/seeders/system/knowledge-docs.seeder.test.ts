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

  it("parses yaml frontmatter and markdown body correctly", () => {
    const raw = `---
path: /test/feature
title: Test Feature
category: Testing
purpose: Testing markdown parser
howTo:
  - Step 1
  - Step 2
notes:
  - Note 1
---

# Test Feature
This is body content with ![Image](/kb-assets/test.png).
`
    const parsed = parseKnowledgeMarkdown(raw)
    expect(parsed).not.toBeNull()
    expect(parsed?.path).toBe("/test/feature")
    expect(parsed?.title).toBe("Test Feature")
    expect(parsed?.category).toBe("Testing")
    expect(parsed?.howTo).toEqual(["Step 1", "Step 2"])
    expect(parsed?.notes).toEqual(["Note 1"])
    expect(parsed?.markdown).toContain("This is body content")
  })

  it("discovers markdown files from content/knowledge-base", () => {
    const docs = loadAllKnowledgeDocs()
    expect(docs.length).toBeGreaterThan(0)
    const apiKeyDoc = docs.find((d) => d.path === "/whatsapp/api-keys")
    expect(apiKeyDoc).toBeDefined()
    expect(apiKeyDoc?.category).toBe("WhatsApp")
    expect(apiKeyDoc?.markdown).toContain(
      "/kb-assets/whatsapp/api-keys/01-initial-empty-state.png"
    )
  })
})
