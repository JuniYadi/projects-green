import { describe, expect, it, mock, afterEach } from "bun:test"
import { cleanup, fireEvent, render, act } from "@testing-library/react"
import React, { createRef } from "react"
import { MarkdownEditor } from "@/components/ui/markdown-editor"

describe("MarkdownEditor", () => {
  afterEach(() => {
    cleanup()
  })

  it("preserves typed text when switching between write and preview tabs", async () => {
    const ref = createRef<HTMLTextAreaElement>()
    const view = render(<MarkdownEditor ref={ref} placeholder="Write something" />)

    const textarea = view.getByPlaceholderText("Write something") as HTMLTextAreaElement

    // Type text into the editor
    await act(async () => {
      fireEvent.change(textarea, { target: { value: "Hello World markdown" } })
    })
    expect(textarea.value).toBe("Hello World markdown")

    // Switch to Preview tab
    const previewButton = view.getByRole("button", { name: "Preview" })
    await act(async () => {
      fireEvent.click(previewButton)
    })

    // Verify textarea is hidden but still present in DOM and holds correct value
    expect(textarea).toBeInTheDocument()
    expect(textarea.value).toBe("Hello World markdown")
    expect(textarea.parentElement?.className).toContain("hidden")

    // Switch back to Write tab
    const writeButton = view.getByRole("button", { name: "Write" })
    await act(async () => {
      fireEvent.click(writeButton)
    })

    // Verify textarea is visible again and holds the same value
    expect(textarea.parentElement?.className).not.toContain("hidden")
    expect(textarea.value).toBe("Hello World markdown")
  })
})
