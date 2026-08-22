import { describe, expect, it } from "bun:test"
import { renderToString } from "react-dom/server"
import AiProvidersPage from "./page"

describe("AiProvidersPage", () => {
  it("renders BYOK Provider page and default managed provider card", () => {
    const html = renderToString(<AiProvidersPage />)
    expect(html).toContain("AI Providers (BYOK)")
    expect(html).toContain("PFNApp Managed Intelligence (Default)")
    expect(html).toContain("Tambah Provider BYOK")
  })
})
