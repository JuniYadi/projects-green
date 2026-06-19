import { describe, expect, it, beforeEach, mock } from "bun:test"
import { render, fireEvent, act } from "@testing-library/react"
import { MarkdownEditor } from "./markdown-editor"

// Mock global fetch
const mockFetch =
  mock<(url: string, options?: RequestInit) => Promise<Response>>()
beforeEach(() => {
  mockFetch.mockReset()
  // Default successful response
  mockFetch.mockResolvedValue(
    new Response(JSON.stringify({ ok: true, html: "<p>Preview content</p>" }), {
      headers: { "content-type": "application/json" },
    })
  )
  global.fetch = mockFetch as unknown as typeof global.fetch
})

describe("MarkdownEditor", () => {
  it("renders the Write tab active by default", () => {
    const view = render(<MarkdownEditor />)
    const writeTab = view.getByText("Write")
    const previewTab = view.getByText("Preview")
    expect(writeTab).toBeTruthy()
    expect(previewTab).toBeTruthy()
    // Write tab should be visually active
    expect(writeTab.className).toContain("bg-white/[0.08]")
  })

  it("renders a textarea element", () => {
    const view = render(<MarkdownEditor />)
    const textarea = view.getByRole("textbox")
    expect(textarea).toBeTruthy()
    expect(textarea.tagName).toBe("TEXTAREA")
  })

  it("renders formatting toolbar buttons in Write mode", () => {
    const view = render(<MarkdownEditor />)
    expect(view.getByTitle("Bold")).toBeTruthy()
    expect(view.getByTitle("Italic")).toBeTruthy()
    expect(view.getByTitle("Code")).toBeTruthy()
    expect(view.getByTitle("Link")).toBeTruthy()
    expect(view.getByTitle("Bullet List")).toBeTruthy()
  })

  it("does not render formatting toolbar in Preview mode", async () => {
    const view = render(<MarkdownEditor />)
    // Click Preview tab
    await act(async () => {
      fireEvent.click(view.getByText("Preview"))
      await new Promise((r) => setTimeout(r, 0))
    })

    // Toolbar buttons should not be visible
    expect(view.queryByTitle("Bold")).toBeNull()
    expect(view.queryByTitle("Italic")).toBeNull()
    expect(view.queryByTitle("Code")).toBeNull()
    expect(view.queryByTitle("Link")).toBeNull()
    expect(view.queryByTitle("Bullet List")).toBeNull()
  })

  it("applies placeholder to textarea", () => {
    const view = render(<MarkdownEditor placeholder="Enter markdown..." />)
    expect(view.getByPlaceholderText("Enter markdown...")).toBeTruthy()
  })

  it("applies defaultValue to textarea", () => {
    const view = render(<MarkdownEditor defaultValue="Hello **world**" />)
    const textarea = view.getByRole("textbox") as HTMLTextAreaElement
    expect(textarea.value).toBe("Hello **world**")
  })

  it("disables textarea when disabled prop is true", () => {
    const view = render(<MarkdownEditor disabled />)
    const textarea = view.getByRole("textbox") as HTMLTextAreaElement
    expect(textarea.disabled).toBe(true)
  })

  it("renders with custom id on textarea", () => {
    const view = render(<MarkdownEditor id="my-editor" />)
    const textarea = view.getByRole("textbox") as HTMLTextAreaElement
    expect(textarea.id).toBe("my-editor")
  })

  it("renders with custom rows", () => {
    const view = render(<MarkdownEditor rows={10} />)
    const textarea = view.getByRole("textbox") as HTMLTextAreaElement
    // In happy-dom, rows is a string attribute
    expect(textarea.getAttribute("rows")).toBe("10")
  })

  it("applies custom className to textarea", () => {
    const view = render(<MarkdownEditor className="custom-editor-class" />)
    const textarea = view.getByRole("textbox")
    expect(textarea.className).toContain("custom-editor-class")
  })

  it("has displayName set", () => {
    expect(MarkdownEditor.displayName).toBe("MarkdownEditor")
  })
})

describe("MarkdownEditor - toolbar formatting", () => {
  it("inserts bold syntax around selected text", () => {
    const view = render(<MarkdownEditor />)
    const textarea = view.getByRole("textbox") as HTMLTextAreaElement

    // Set value and selection
    textarea.value = "hello world"
    textarea.setSelectionRange(0, 5) // select "hello"

    fireEvent.click(view.getByTitle("Bold"))

    expect(textarea.value).toBe("**hello** world")
    // Selection should be inside the bold markers (after the "**" prefix)
    expect(textarea.selectionStart).toBe(2)
    expect(textarea.selectionEnd).toBe(7)
  })

  it("inserts bold syntax with placeholder when no text is selected", () => {
    const view = render(<MarkdownEditor />)
    const textarea = view.getByRole("textbox") as HTMLTextAreaElement

    textarea.value = ""
    textarea.setSelectionRange(0, 0)

    fireEvent.click(view.getByTitle("Bold"))

    expect(textarea.value).toBe("**bold text**")
  })

  it("inserts italic syntax around selected text", () => {
    const view = render(<MarkdownEditor />)
    const textarea = view.getByRole("textbox") as HTMLTextAreaElement

    textarea.value = "hello world"
    textarea.setSelectionRange(0, 5)

    fireEvent.click(view.getByTitle("Italic"))

    expect(textarea.value).toBe("*hello* world")
  })

  it("inserts inline code syntax around selected text", () => {
    const view = render(<MarkdownEditor />)
    const textarea = view.getByRole("textbox") as HTMLTextAreaElement

    textarea.value = "hello world"
    textarea.setSelectionRange(0, 5)

    fireEvent.click(view.getByTitle("Code"))

    expect(textarea.value).toBe("`hello` world")
  })

  it("inserts code block syntax for multiline selected text", () => {
    const view = render(<MarkdownEditor />)
    const textarea = view.getByRole("textbox") as HTMLTextAreaElement

    textarea.value = "line1\nline2"
    textarea.setSelectionRange(0, 12) // select all

    fireEvent.click(view.getByTitle("Code"))

    expect(textarea.value).toContain("```")
    expect(textarea.value).toContain("line1\nline2")
  })

  it("inserts link syntax around selected text", () => {
    const view = render(<MarkdownEditor />)
    const textarea = view.getByRole("textbox") as HTMLTextAreaElement

    textarea.value = "click here"
    textarea.setSelectionRange(0, 10)

    fireEvent.click(view.getByTitle("Link"))

    expect(textarea.value).toBe("[click here](https://)")
  })

  it("inserts list syntax", () => {
    const view = render(<MarkdownEditor />)
    const textarea = view.getByRole("textbox") as HTMLTextAreaElement

    textarea.value = ""
    textarea.setSelectionRange(0, 0)

    fireEvent.click(view.getByTitle("Bullet List"))

    expect(textarea.value).toBe("\n- list item")
  })

  it("dispatches input event after toolbar action", () => {
    const view = render(<MarkdownEditor />)
    const textarea = view.getByRole("textbox") as HTMLTextAreaElement
    let inputEventFired = false
    textarea.addEventListener("input", () => {
      inputEventFired = true
    })

    textarea.value = "hello"
    textarea.setSelectionRange(0, 5)
    fireEvent.click(view.getByTitle("Bold"))

    expect(inputEventFired).toBe(true)
  })

  it("does not crash when toolbar button clicked", () => {
    const view = render(<MarkdownEditor />)
    // Just verify buttons exist and are clickable
    expect(() => {
      fireEvent.click(view.getByTitle("Bold"))
    }).not.toThrow()
  })
})

describe("MarkdownEditor - preview tab", () => {
  it("switches to Preview tab and fetches preview", async () => {
    const view = render(<MarkdownEditor defaultValue="# Hello" />)
    const textarea = view.getByRole("textbox") as HTMLTextAreaElement
    expect(textarea.value).toBe("# Hello")

    // Click Preview tab
    fireEvent.click(view.getByText("Preview"))

    // Should call fetch with the markdown content
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith("/api/support-tickets/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markdown: "# Hello" }),
    })

    // Wait for the response to resolve and re-render
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    // Preview HTML should be rendered
    expect(view.getByText("Preview content")).toBeTruthy()
  })

  it("shows loading skeleton when switching to preview", async () => {
    // Make fetch slow so we can see loading state
    let resolvePromise!: (value: Response) => void
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve
        })
    )

    const { container } = render(<MarkdownEditor />)

    // Switch to Preview
    fireEvent.click(container.querySelector("button")!) // first button is "Write"

    // Find Preview button and click it
    const previewBtn = container.querySelectorAll("button")[1]
    fireEvent.click(previewBtn)

    // Should show loading skeleton (pulsing divs)
    expect(container.querySelector(".animate-pulse")).toBeTruthy()

    // Resolve the fetch
    await act(async () => {
      resolvePromise(
        new Response(
          JSON.stringify({ ok: true, html: "<p>Final content</p>" }),
          { headers: { "content-type": "application/json" } }
        )
      )
      await new Promise((r) => setTimeout(r, 0))
    })

    // Loading skeleton should be gone
    expect(container.querySelector(".animate-pulse")).toBeNull()
  })

  it("shows error message when API returns ok: false", async () => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, html: "" }), {
        headers: { "content-type": "application/json" },
      })
    )

    const view = render(<MarkdownEditor />)
    fireEvent.click(view.getByText("Preview"))

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(view.getByText("Error loading preview")).toBeTruthy()
  })

  it("shows error message for non-OK response status", async () => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "RATE_LIMITED" }), {
        status: 429,
        headers: { "content-type": "application/json" },
      })
    )

    const view = render(<MarkdownEditor />)
    fireEvent.click(view.getByText("Preview"))

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(view.getByText("Error loading preview")).toBeTruthy()
  })

  it("shows error message when fetch throws", async () => {
    mockFetch.mockReset()
    mockFetch.mockRejectedValue(new Error("Network error"))

    const view = render(<MarkdownEditor />)
    fireEvent.click(view.getByText("Preview"))

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(view.getByText("Error connecting to server")).toBeTruthy()
  })

  it("shows default empty preview message when no content", async () => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, html: "" }), {
        headers: { "content-type": "application/json" },
      })
    )

    const view = render(<MarkdownEditor />)
    fireEvent.click(view.getByText("Preview"))

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(view.getByText("Nothing to preview")).toBeTruthy()
  })

  it("calls fetch with updated textarea content on switch to preview", async () => {
    const view = render(<MarkdownEditor />)
    const textarea = view.getByRole("textbox") as HTMLTextAreaElement

    // Type some content
    textarea.value = "## New Content"
    textarea.setSelectionRange(14, 14)

    // Switch to Preview
    fireEvent.click(view.getByText("Preview"))

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(mockFetch).toHaveBeenCalledWith("/api/support-tickets/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markdown: "## New Content" }),
    })
  })

  it("switches back to Write tab from Preview", async () => {
    const view = render(<MarkdownEditor />)

    // Go to Preview
    fireEvent.click(view.getByText("Preview"))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    // Go back to Write
    fireEvent.click(view.getByText("Write"))

    // Textarea should be visible again
    expect(view.getByRole("textbox")).toBeTruthy()
    // Preview tab should not have active class
    const previewTab = view.getByText("Preview")
    expect(previewTab.className).not.toContain("bg-white/[0.08]")
  })
})

describe("MarkdownEditor - ref forwarding", () => {
  it("forwards ref to the textarea element", () => {
    const ref = { current: null as HTMLTextAreaElement | null }
    render(<MarkdownEditor ref={ref} />)
    expect(ref.current).toBeTruthy()
    expect(ref.current?.tagName).toBe("TEXTAREA")
  })

  it("allows imperative focus via ref", () => {
    const ref = { current: null as HTMLTextAreaElement | null }
    render(<MarkdownEditor ref={ref} />)
    expect(() => ref.current?.focus()).not.toThrow()
  })
})

describe("MarkdownEditor - edge cases", () => {
  it("renders without crashing when no props are passed", () => {
    const { container } = render(<MarkdownEditor />)
    expect(container.querySelector("textarea")).toBeTruthy()
  })

  it("renders with disabled toolbar buttons when disabled", () => {
    const view = render(<MarkdownEditor disabled />)
    const boldBtn = view.getByTitle("Bold") as HTMLButtonElement
    expect(boldBtn.disabled).toBe(true)
  })

  it("updates tabs active state correctly when switching", () => {
    const view = render(<MarkdownEditor />)
    const writeTab = view.getByText("Write")
    const previewTab = view.getByText("Preview")

    // Initially Write is active
    expect(writeTab.className).toContain("bg-white/[0.08]")
    expect(previewTab.className).not.toContain("bg-white/[0.08]")

    // Click Preview — wrap in act to flush state updates
    act(() => {
      fireEvent.click(previewTab)
    })
    expect(writeTab.className).not.toContain("bg-white/[0.08]")
    expect(previewTab.className).toContain("bg-white/[0.08]")
  })

  it("renders preview content safely via dangerouslySetInnerHTML", async () => {
    const htmlWithHtml = "<strong>Bold text</strong><em>Italic text</em>"
    mockFetch.mockReset()
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, html: htmlWithHtml }), {
        headers: { "content-type": "application/json" },
      })
    )

    const view = render(<MarkdownEditor />)
    fireEvent.click(view.getByText("Preview"))

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(view.getByText("Bold text")).toBeTruthy()
    expect(view.getByText("Italic text")).toBeTruthy()
  })
})
