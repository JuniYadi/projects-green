import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import AiProvidersPage from "./page"

describe("AiProvidersPage", () => {
  it("renders BYOK Provider page and default managed provider card", () => {
    const view = render(<AiProvidersPage />)
    expect(view.getByText("AI Providers (BYOK)")).toBeTruthy()
    expect(view.getByText("Tambah Provider BYOK")).toBeTruthy()
    expect(view.getByText("PFNApp Managed Intelligence (Default)")).toBeTruthy()
  })
})
