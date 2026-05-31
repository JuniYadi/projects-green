import { describe, expect, it, beforeEach } from "bun:test"
import { render } from "@testing-library/react"

// Mock fetch before any imports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).fetch = (() => {
  let jsonResponse = { ok: true, html: "<p>Preview content</p>" }
  return {
    ok: true,
    json: () => Promise.resolve(jsonResponse),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setJson: (data: any) => { jsonResponse = data },
  }
})()

import { MarkdownEditor } from "./markdown-editor"

describe("MarkdownEditor", () => {
  beforeEach(() => {
    // Reset mock behavior
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(global as any).fetch.setJson({ ok: true, html: "<p>Preview content</p>" })
  })

  it("renders with Write and Preview tabs and toolbar", () => {
    const view = render(<MarkdownEditor />)
    expect(view.getByText("Write")).toBeInTheDocument()
    expect(view.getByText("Preview")).toBeInTheDocument()
    expect(view.getByTitle("Bold")).toBeInTheDocument()
    expect(view.getByTitle("Italic")).toBeInTheDocument()
    expect(view.getByTitle("Code")).toBeInTheDocument()
    expect(view.getByTitle("Link")).toBeInTheDocument()
    expect(view.getByTitle("Bullet List")).toBeInTheDocument()
  })

  it("renders with placeholder prop", () => {
    const view = render(<MarkdownEditor placeholder="Type here..." />)
    expect(view.getByPlaceholderText("Type here...")).toBeInTheDocument()
  })

  it("renders with custom rows", () => {
    const view = render(
      <MarkdownEditor rows={10} placeholder="test" />
    )
    const textarea = view.getByPlaceholderText("test") as HTMLTextAreaElement
    expect(textarea.getAttribute("rows")).toBe("10")
  })

  it("renders with custom id", () => {
    const view = render(
      <MarkdownEditor id="my-editor" placeholder="test" />
    )
    const textarea = view.getByPlaceholderText("test") as HTMLTextAreaElement
    expect(textarea.id).toBe("my-editor")
  })

  it("renders in disabled state", () => {
    const view = render(
      <MarkdownEditor disabled placeholder="test" />
    )
    const textarea = view.getByPlaceholderText("test") as HTMLTextAreaElement
    expect(textarea.disabled).toBe(true)
  })

  it("disables toolbar buttons when disabled", () => {
    const view = render(<MarkdownEditor disabled />)
    const bold = view.getByTitle("Bold").closest("button")
    expect(bold).toBeDisabled()
  })

  it("renders with default value", () => {
    const view = render(
      <MarkdownEditor defaultValue="**hi**" placeholder="test" />
    )
    const textarea = view.getByPlaceholderText("test") as HTMLTextAreaElement
    expect(textarea.defaultValue).toBe("**hi**")
  })

  it("renders Write and Preview tab labels", () => {
    const view = render(<MarkdownEditor />)
    expect(view.getByText("Write")).toBeInTheDocument()
    expect(view.getByText("Preview")).toBeInTheDocument()
  })

  it("applies custom className to textarea", () => {
    const view = render(
      <MarkdownEditor className="my-custom" placeholder="test" />
    )
    const textarea = view.getByPlaceholderText("test") as HTMLTextAreaElement
    expect(textarea.classList.contains("my-custom")).toBe(true)
  })
})
