import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, mock } from "bun:test"

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "id" }),
}))

import { LogInspectorDrawer } from "./log-inspector-drawer"

describe("LogInspectorDrawer", () => {
  afterEach(() => {
    cleanup()
  })

  const mockLog = {
    id: "log-abc",
    timestamp: "14:23:01",
    isoTimestamp: "2026-09-14T14:23:01.452Z",
    level: "ERROR" as const,
    source: "api-gw",
    message: "Upstream connection timeout",
    raw: {
      http: {
        method: "POST",
        status_code: 502,
      },
      duration_ms: 15002,
      kubernetes: {
        pod_name: "hermes-stellar-star-0",
      },
    },
  }

  it("renders log details and attributes table when open", () => {
    const handleOpenChange = mock()

    const { getByText, getAllByText } = render(
      <LogInspectorDrawer
        log={mockLog}
        open={true}
        onOpenChange={handleOpenChange}
      />
    )

    expect(getByText("Upstream connection timeout")).toBeTruthy()
    expect(getByText("ERROR")).toBeTruthy()
    expect(getByText("api-gw")).toBeTruthy()
    expect(getByText("http.status_code")).toBeTruthy()
    expect(getAllByText("502").length).toBeGreaterThanOrEqual(1)
    expect(getByText("duration_ms")).toBeTruthy()
    expect(getByText("15002")).toBeTruthy()
  })

  it("filters attributes when typing in search", () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <LogInspectorDrawer log={mockLog} open={true} onOpenChange={() => {}} />
    )

    const searchInput = getByPlaceholderText("Cari atribut...")
    fireEvent.change(searchInput, { target: { value: "duration" } })

    expect(getByText("duration_ms")).toBeTruthy()
    expect(queryByText("http.status_code")).toBeNull()
  })

  it("switches to raw JSON tab and displays formatted json", () => {
    const { getByRole } = render(
      <LogInspectorDrawer log={mockLog} open={true} onOpenChange={() => {}} />
    )

    const rawTab = getByRole("tab", { name: /raw json/i })
    fireEvent.keyDown(rawTab, { key: "Enter", code: "Enter" })

    const pre = document.querySelector("pre")
    expect(pre).toBeTruthy()
    expect(pre?.textContent).toContain('"duration_ms": 15002')
  })

  it("handles copy JSON and copy value gracefully", () => {
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
        <LogInspectorDrawer log={mockLog} open={true} onOpenChange={() => {}} />
      )

      const copyBtn = getByRole("button", { name: /salin json/i })
      fireEvent.click(copyBtn)

      expect(writeTextMock).toHaveBeenCalled()
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: originalClipboard,
      })
    }
  })
})
