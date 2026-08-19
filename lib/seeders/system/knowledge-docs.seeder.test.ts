import { describe, expect, it } from "bun:test"
import {
  KnowledgeDocsSeeder,
  CANONICAL_DOCUMENTS,
} from "./knowledge-docs.seeder"

describe("KnowledgeDocsSeeder", () => {
  it("defines proper system classification and metadata", () => {
    expect(KnowledgeDocsSeeder.seederName).toBe("KnowledgeDocs")
    expect(KnowledgeDocsSeeder.classification).toBe("system")
    expect(KnowledgeDocsSeeder.runOrder).toBe(15)
  })

  it("contains valid canonical documents with markdown and screenshots", () => {
    expect(CANONICAL_DOCUMENTS.length).toBeGreaterThan(0)
    const apiKeyDoc = CANONICAL_DOCUMENTS.find(
      (d) => d.path === "/whatsapp/api-keys"
    )
    expect(apiKeyDoc).toBeDefined()
    expect(apiKeyDoc?.category).toBe("WhatsApp")
    expect(apiKeyDoc?.markdown).toContain(
      "/kb-assets/whatsapp/api-keys/01-initial-empty-state.png"
    )
    expect(apiKeyDoc?.markdown).toContain(
      "/kb-assets/whatsapp/api-keys/02-key-generated-with-secret.png"
    )
  })
})
