import { describe, expect, it } from "bun:test"
import { renderToString } from "react-dom/server"
import AiKnowledgePage from "./page"

describe("AiKnowledgePage", () => {
  it("renders Knowledge Base & Storage Capacity Meter", () => {
    const html = renderToString(<AiKnowledgePage />)
    expect(html).toContain("Knowledge Base &amp; Dokumen Toko")
    expect(html).toContain("Kapasitas Storage Halaman PDF")
    expect(html).toContain("Unggah Dokumen PDF/DOCX")
  })
})
