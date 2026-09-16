import { describe, expect, it, mock } from "bun:test"
import { renderToString } from "react-dom/server"

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      console: {
        ai: {
          knowledge: {
            get: mock(() =>
              Promise.resolve({
                data: {
                  ok: true,
                  data: [],
                },
              })
            ),
            upload: {
              post: mock(() =>
                Promise.resolve({
                  data: {
                    ok: true,
                    data: { id: "doc-new", status: "QUEUED" },
                  },
                })
              ),
            },
          },
        },
      },
    },
  },
}))

mock.module("@/modules/storage/ui/storage-dropzone", () => ({
  StorageDropzone: () => (
    <div data-testid="storage-dropzone">Storage Dropzone Mock</div>
  ),
}))

import AiKnowledgePage from "./page-client"

describe("AiKnowledgePage Client Component", () => {
  it("renders page header and trigger button", () => {
    const html = renderToString(<AiKnowledgePage />)
    expect(html).toContain("Knowledge Base &amp; Dokumen Toko")
    expect(html).toContain("Unggah Dokumen PDF/DOCX")
    expect(html).toContain("Kelola katalog produk, daftar harga, dan SOP")
  })
})
