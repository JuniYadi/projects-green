import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import { DocumentationForm } from "./documentation-form"

describe("DocumentationForm", () => {
  it("renders all form fields", () => {
    const view = render(<DocumentationForm />)

    expect(view.getByLabelText("Path")).toBeInTheDocument()
    expect(view.getByLabelText("Title")).toBeInTheDocument()
    expect(view.getByLabelText("Purpose")).toBeInTheDocument()
    expect(view.getByLabelText("How To (one step per line)")).toBeInTheDocument()
    expect(view.getByLabelText("Notes (optional, one item per line)")).toBeInTheDocument()
    expect(view.getByText("Save Documentation")).toBeInTheDocument()
  })

  it("renders with default path value", () => {
    const view = render(<DocumentationForm />)

    const path = view.getByLabelText("Path") as HTMLInputElement
    expect(path.value).toBe("/console")
  })

  it("renders submit button as enabled by default", () => {
    const view = render(<DocumentationForm />)
    const button = view.getByText("Save Documentation").closest("button")
    expect(button).not.toBeDisabled()
  })

  it("renders with empty title and purpose", () => {
    const view = render(<DocumentationForm />)

    expect((view.getByLabelText("Title") as HTMLInputElement).value).toBe("")
    expect((view.getByLabelText("Purpose") as HTMLTextAreaElement).value).toBe("")
  })
})
