import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

describe("DeployPage", () => {
  it("renders AI deployment assistant feed", async () => {
    const deployPageModule =
      await import("@/app/[lang]/console/app/deploy/page")
    const view = render(<deployPageModule.default />)

    expect(view.getByText("AI deployment assistant")).toBeTruthy()
    expect(
      view.getByPlaceholderText("Paste a GitHub repository URL to deploy…")
    ).toBeTruthy()
  })
})
