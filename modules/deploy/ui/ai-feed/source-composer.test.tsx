import { describe, expect, it, mock } from "bun:test"
import { render, fireEvent } from "@testing-library/react"
import { SourceComposer } from "./source-composer"

describe("SourceComposer", () => {
  it("renders input and submit button", () => {
    const view = render(<SourceComposer onSubmit={() => {}} />)
    expect(
      view.getByPlaceholderText("Paste a GitHub repository URL to deploy…")
    ).toBeTruthy()
    expect(
      view.getByRole("button", { name: "Submit repository URL" })
    ).toBeTruthy()
  })

  it("does not submit empty input", () => {
    const onSubmit = mock(() => {})
    const view = render(<SourceComposer onSubmit={onSubmit} />)
    const button = view.getByRole("button", { name: "Submit repository URL" })

    fireEvent.click(button)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
