import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import type { TerminalTargetDTO } from "@/modules/deploy/terminal-target.dto"

const mockFocus = mock()

mock.module("@xterm/xterm", () => ({
  Terminal: class {
    cols = 80
    rows = 24
    loadAddon() {}
    open() {}
    focus = mockFocus
    write() {}
    writeln() {}
    dispose() {}
    onData() {}
  },
}))

mock.module("@xterm/addon-fit", () => ({
  FitAddon: class {
    fit() {}
  },
}))

class FakeWebSocket {
  static OPEN = 1
  static instances: FakeWebSocket[] = []
  readyState = 0
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  url: string

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send() {}
  close() {}
}

const { StackTerminal } = await import("./stack-terminal")

const target = (pod: string, label: string): TerminalTargetDTO => ({
  pod,
  label,
  ready: true,
  containers: ["app"],
  defaultContainer: "app",
})

const renderWithTargets = (targets: TerminalTargetDTO[]) => {
  const view = render(<StackTerminal stackId="stk_1" locale="en" />)
  act(() => {
    FakeWebSocket.instances[0]?.onmessage?.({
      data: JSON.stringify({
        type: "targets",
        targets,
        selected: { pod: targets[0]?.pod, container: "app" },
      }),
    })
  })
  return view
}

describe("StackTerminal", () => {
  const originalWebSocket = globalThis.WebSocket

  beforeEach(() => {
    FakeWebSocket.instances = []
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket
  })

  afterEach(() => {
    cleanup()
    globalThis.WebSocket = originalWebSocket
  })

  it("shows a friendly label and no picker for one replica", () => {
    const { queryByRole, getByText } = renderWithTargets([
      target("api-7d9f8-abcde", "Replica 1"),
    ])

    expect(queryByRole("combobox")).toBeNull()
    expect(getByText("Replica 1 · Ready")).toBeDefined()
    expect(document.body.textContent).not.toContain("api-7d9f8-abcde")
    // The first connect lets the gateway choose the replica.
    expect(FakeWebSocket.instances[0]?.url).not.toContain("pod=")
  })

  it("offers a picker when the app has more than one replica", () => {
    const { getByRole } = renderWithTargets([
      target("api-7d9f8-abcde", "Replica 1"),
      target("api-7d9f8-fghij", "Replica 2"),
    ])

    expect(getByRole("combobox")).toBeDefined()
  })

  it("focuses terminal when terminal region is clicked", () => {
    mockFocus.mockClear()
    const { getByRole } = renderWithTargets([
      target("api-7d9f8-abcde", "Replica 1"),
    ])

    const terminalCanvas = getByRole("region", { name: "Terminal console" })
    fireEvent.click(terminalCanvas)
    expect(mockFocus).toHaveBeenCalled()
  })

  it("calls onPopOut when pop out button is clicked", () => {
    const handlePopOut = mock()
    const { getByTitle } = render(
      <StackTerminal stackId="stk_1" locale="en" onPopOut={handlePopOut} />
    )
    const button = getByTitle("Open in standalone window")
    fireEvent.click(button)
    expect(handlePopOut).toHaveBeenCalledTimes(1)
  })

  it("calls onMinimize and onClose when buttons are clicked", () => {
    const handleMinimize = mock()
    const handleClose = mock()
    const { getByTitle } = render(
      <StackTerminal
        stackId="stk_1"
        locale="en"
        onMinimize={handleMinimize}
        onClose={handleClose}
      />
    )
    fireEvent.click(getByTitle("Minimize"))
    expect(handleMinimize).toHaveBeenCalledTimes(1)

    fireEvent.click(getByTitle("Close session"))
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it("renders clear button and quick command shortcut chips", () => {
    const { getByTitle, getByText } = render(
      <StackTerminal stackId="stk_1" locale="en" />
    )
    expect(getByTitle("Clear terminal screen")).toBeDefined()
    expect(getByText("Quick commands:")).toBeDefined()
    expect(getByText("ls -la")).toBeDefined()
    expect(getByText("env")).toBeDefined()
  })
})
