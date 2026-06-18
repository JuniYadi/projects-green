import { afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"

import { RawPayloadViewer } from "./raw-payload-viewer"

afterEach(() => {
  cleanup()
  mock.restore()
})

const samplePayload = {
  type: "text",
  text: {
    body: "Hello, world!",
  },
  sender: "user_12345",
  timestamp: 1718640000,
}

describe("RawPayloadViewer", () => {
  describe("expand/collapse", () => {
    it("is collapsed by default", () => {
      const { container } = render(
        <RawPayloadViewer payload={samplePayload} />,
      )

      const details = container.querySelector("details")
      expect(details).toBeTruthy()
      expect(details!.getAttribute("open")).toBeNull()
    })

    it("expands when defaultExpanded is true", () => {
      const { container } = render(
        <RawPayloadViewer payload={samplePayload} defaultExpanded={true} />,
      )

      const details = container.querySelector("details")
      expect(details).toBeTruthy()
      expect(details!.getAttribute("open")).not.toBeNull()
    })

    it("renders collapsed state when defaultExpanded is false", () => {
      const { container } = render(
        <RawPayloadViewer payload={samplePayload} defaultExpanded={false} />,
      )

      const details = container.querySelector("details")
      expect(details).toBeTruthy()
      expect(details!.getAttribute("open")).toBeNull()
    })
  })

  describe("pretty-printed JSON", () => {
    it("renders preview text in the summary", () => {
      const { container } = render(
        <RawPayloadViewer payload={samplePayload} />,
      )

      const summary = container.querySelector("summary")
      expect(summary).toBeTruthy()
      expect(summary!.textContent).toContain('"type"')
      expect(summary!.textContent).toContain("Hello, world!")
    })

    it("renders formatted JSON inside the details content when expanded", () => {
      const { container } = render(
        <RawPayloadViewer payload={samplePayload} defaultExpanded={true} />,
      )

      // The formatted JSON is inside a <pre><code> block
      const code = container.querySelector("pre code")
      expect(code).toBeTruthy()
      expect(code!.textContent).toContain('"type": "text"')
      expect(code!.textContent).toContain('"Hello, world!"')
      // Should be pretty-printed with indentation
      expect(code!.textContent).toContain("  ")
    })
  })

  describe("copy button", () => {
    it("renders a copy button with aria-label", () => {
      const { getByRole } = render(
        <RawPayloadViewer payload={samplePayload} />,
      )

      const copyBtn = getByRole("button", {
        name: /copy payload/i,
      })
      expect(copyBtn).toBeTruthy()
    })

    it("copies formatted JSON to clipboard when clicked", async () => {
      const writeTextMock = mock(() => Promise.resolve())
      const originalClipboard = navigator.clipboard

      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: writeTextMock,
        },
      })

      try {
        const { getByRole } = render(
          <RawPayloadViewer payload={samplePayload} />,
        )

        const copyBtn = getByRole("button", {
          name: /copy payload/i,
        })
        fireEvent.click(copyBtn)

        expect(writeTextMock).toHaveBeenCalledWith(
          JSON.stringify(samplePayload, null, 2),
        )
      } finally {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: originalClipboard,
        })
      }
    })

    it("shows check icon briefly after copying", async () => {
      const writeTextMock = mock(() => Promise.resolve())
      const originalClipboard = navigator.clipboard

      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: writeTextMock,
        },
      })

      try {
        const { container, getByRole } = render(
          <RawPayloadViewer payload={samplePayload} />,
        )

        const copyBtn = getByRole("button", {
          name: /copy payload/i,
        })

        // Click to copy — triggers async state update (setCopied(true))
        fireEvent.click(copyBtn)

        // Wait for the async state update to render the CheckCircle icon
        await waitFor(() => {
          const checkIcon = container.querySelector(".text-emerald-500")
          expect(checkIcon).toBeTruthy()
        })
      } finally {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: originalClipboard,
        })
      }
    })
  })

  describe("malformed data handling", () => {
    it("handles empty payload gracefully", () => {
      const { container } = render(
        <RawPayloadViewer payload={{}} />,
      )

      const summary = container.querySelector("summary")
      expect(summary).toBeTruthy()
      expect(summary!.textContent).toContain("{}")

      // Formatted JSON should show empty object
      const code = container.querySelector("pre code")
      // When not expanded (default), code block is not visible
      // but in the dom it's inside details — it's present but hidden
      // Actually, with default collapsed, the <pre><code> is still in the DOM
      // because the component renders it unconditionally
      if (code) {
        expect(code.textContent).toBe("{}")
      }
    })

    it("handles deeply nested objects without crashing", () => {
      const deepPayload = {
        level1: {
          level2: {
            level3: {
              level4: {
                key: "value",
              },
            },
          },
        },
      }

      const { container } = render(
        <RawPayloadViewer payload={deepPayload} defaultExpanded={true} />,
      )

      const code = container.querySelector("pre code")
      expect(code).toBeTruthy()
      expect(code!.textContent).toContain("level1")
      expect(code!.textContent).toContain("level4")
      expect(code!.textContent).toContain("value")
    })

    it("handles payload with special characters", () => {
      const specialPayload = {
        message: "Hello <script>alert('xss')</script> & \"quotes\"",
        path: "/api/webhook?key=value&type=test",
      }

      const { container } = render(
        <RawPayloadViewer payload={specialPayload} defaultExpanded={true} />,
      )

      const code = container.querySelector("pre code")
      expect(code).toBeTruthy()
      // JSON.stringify escapes double quotes inside strings, so " becomes \"
      // The raw text content contains the literal backslash-escaped sequence
      expect(code!.textContent).toContain("<script>")
      expect(code!.textContent).toContain("alert")
      expect(code!.textContent).toContain('\\"quotes\\"')
    })

    it("handles payload with numeric and boolean values", () => {
      const mixedPayload = {
        count: 42,
        isActive: true,
        ratio: 3.14,
        tags: ["a", "b", "c"],
      }

      const { container } = render(
        <RawPayloadViewer payload={mixedPayload} defaultExpanded={true} />,
      )

      const code = container.querySelector("pre code")
      expect(code).toBeTruthy()
      expect(code!.textContent).toContain("42")
      expect(code!.textContent).toContain("true")
      expect(code!.textContent).toContain("3.14")
      expect(code!.textContent).toContain('"a"')
      expect(code!.textContent).toContain('"b"')
      expect(code!.textContent).toContain('"c"')
    })
  })
})
