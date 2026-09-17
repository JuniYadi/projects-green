import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test"
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { LowConfidenceFallbackCard } from "./low-confidence-fallback-card"

describe("LowConfidenceFallbackCard", () => {
  beforeEach(() => {
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders header with confidence percentage, detected file copy, and form inputs", () => {
    const onApplyOverrides = mock(() => {})
    const onCancel = mock(() => {})

    const view = render(
      <LowConfidenceFallbackCard
        confidence={42}
        detectedFile="JavaScript (server.js)"
        onApplyOverrides={onApplyOverrides}
        onCancel={onCancel}
      />
    )

    expect(
      view.getByText(
        /KEPASTIAN DETEKSI RENDAH \(CONFIDENCE: 42% · BUTUH BANTUAN DEVELOPER\)/i
      )
    ).toBeDefined()
    expect(
      view.getByText(/Saya mendeteksi file JavaScript \(server\.js\)/i)
    ).toBeDefined()
    expect(view.getByTestId("fallback-start-command-input")).toBeDefined()
    expect(view.getByTestId("fallback-port-input")).toBeDefined()
    expect(view.getByTestId("fallback-save-btn")).toBeDefined()
    expect(view.getByTestId("fallback-cancel-btn")).toBeDefined()
  })

  it("submits overrides when clicking Save and Generate Blueprint button", () => {
    const onApplyOverrides = mock(() => {})

    const view = render(
      <LowConfidenceFallbackCard
        confidence={42}
        initialStartCommand="node server.js"
        initialPort={3000}
        onApplyOverrides={onApplyOverrides}
      />
    )

    const cmdInput = view.getByTestId("fallback-start-command-input")
    act(() => {
      fireEvent.change(cmdInput, { target: { value: "node index.js" } })
    })

    const portInput = view.getByTestId("fallback-port-input")
    act(() => {
      fireEvent.change(portInput, { target: { value: "8080" } })
    })

    const saveBtn = view.getByTestId("fallback-save-btn")
    act(() => {
      fireEvent.click(saveBtn)
    })

    expect(onApplyOverrides).toHaveBeenCalledWith({
      runtime: "Node.js 20",
      startCommand: "node index.js",
      port: 8080,
    })
  })

  it("triggers onCancel when cancel button is clicked", () => {
    const onApplyOverrides = mock(() => {})
    const onCancel = mock(() => {})

    const view = render(
      <LowConfidenceFallbackCard
        onApplyOverrides={onApplyOverrides}
        onCancel={onCancel}
      />
    )

    const cancelBtn = view.getByTestId("fallback-cancel-btn")
    act(() => {
      fireEvent.click(cancelBtn)
    })

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
