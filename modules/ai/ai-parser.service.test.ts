import { describe, expect, it } from "bun:test"

import {
  inspectPdfPageCount,
  cleanDocumentMarkdown,
  chunkMarkdownHierarchically,
  parseDocumentContent,
} from "./ai-parser.service"

describe("aiParserService", () => {
  it("inspects PDF buffer and extracts page count from /Count or /Page markers", () => {
    const mockPdfBuffer = Buffer.from(
      "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 12 >>\nendobj\n%%EOF"
    )

    const count = inspectPdfPageCount(mockPdfBuffer)
    expect(count).toBe(12)
  })

  it("cleans and normalizes redundant newlines in markdown", () => {
    const dirty = "Header\r\n\r\n\r\n\r\nParagraph 1\r\n\r\n\r\nParagraph 2"
    const cleaned = cleanDocumentMarkdown(dirty)

    expect(cleaned).toBe("Header\n\nParagraph 1\n\nParagraph 2")
  })

  it("splits document hierarchically preserving heading parent sections", () => {
    const markdown = [
      "# Bab 1: Panduan Retur",
      "Barang yang rusak dapat dikembalikan dalam waktu 7 hari kerja.",
      "Pastikan menyertakan nota pembelian dan video unboxing.",
      "",
      "## Syarat dan Ketentuan",
      "1. Segel tidak rusak.",
      "2. Ongkos kirim ditanggung pembeli kecuali kesalahan toko.",
    ].join("\n")

    const chunks = chunkMarkdownHierarchically(markdown)

    expect(chunks.length).toBeGreaterThanOrEqual(2)
    expect(chunks[0]?.parentSection).toBe("Bab 1: Panduan Retur")
    expect(chunks[0]?.content).toContain("Panduan Retur")
    expect(chunks[1]?.parentSection).toBe("Syarat dan Ketentuan")
    expect(chunks[1]?.content).toContain("Segel tidak rusak")
  })

  it("parses full document content and returns pageCount and chunks", () => {
    const mockContent =
      "# Daftar Harga Produk\n\n- Produk A: Rp 50.000\n- Produk B: Rp 100.000"
    const buffer = Buffer.from(mockContent)

    const result = parseDocumentContent(buffer, "katalog-toko.md", mockContent)

    expect(result.title).toBe("katalog-toko")
    expect(result.pageCount).toBe(1)
    expect(result.chunks.length).toBe(1)
    expect(result.chunks[0]?.content).toContain("Produk A: Rp 50.000")
  })
})
