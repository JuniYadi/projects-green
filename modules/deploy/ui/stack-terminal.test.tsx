import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { act, cleanup, render } from "@testing-library/react"
import type { TerminalTargetDTO } from "@/modules/deploy/terminal-target.dto"

mock.module("@xterm/xterm", () => ({
  Terminal: class {
    cols = 80
    rows = 24
    loadAddon() {}
    open() {}
    focus() {}
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
})
