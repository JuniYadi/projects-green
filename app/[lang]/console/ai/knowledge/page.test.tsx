import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import AiKnowledgePage from "./page"

describe("AiKnowledgePage", () => {
  it("renders Knowledge Base & Storage Capacity Meter", () => {
    const view = render(<AiKnowledgePage />)
    expect(view.getByText("Knowledge Base & Dokumen Toko")).toBeTruthy()
    expect(view.getByText("Kapasitas Storage Halaman PDF")).toBeTruthy()
    expect(view.getByText("Unggah Dokumen PDF/DOCX")).toBeTruthy()
  })
})
