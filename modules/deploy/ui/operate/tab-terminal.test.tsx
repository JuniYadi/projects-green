import { afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render, waitFor } from "@testing-library/react"
import { TabTerminal, TerminalLoading } from "./tab-terminal"

afterEach(cleanup)

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "id" }),
}))

mock.module("@/modules/deploy/ui/stack-terminal", () => ({
  StackTerminal: () => <div data-testid="stack-terminal">MockedTerminal</div>,
}))

describe("TerminalLoading", () => {
  it("renders Indonesian loading text when isId is explicitly true", () => {
    const view = render(<TerminalLoading isId={true} />)
    expect(view.getByText("Memuat sesi terminal...")).toBeDefined()
  })

  it("renders English loading text when isId is explicitly false", () => {
    const view = render(<TerminalLoading isId={false} />)
    expect(view.getByText("Loading terminal session...")).toBeDefined()
  })

  it("falls back to useParams detection when isId is not provided", () => {
    const view = render(<TerminalLoading />)
    expect(view.getByText("Memuat sesi terminal...")).toBeDefined()
  })
})

describe("TabTerminal", () => {
  it("renders Indonesian description when locale is id", async () => {
    const view = render(<TabTerminal stackId="stk-1" locale="id" />)
    expect(
      view.getByText(/Shell langsung di dalam container aplikasi kamu/)
    ).toBeDefined()
    await waitFor(() => {
      expect(view.getByTestId("stack-terminal")).toBeDefined()
    })
  })

  it("renders English description when locale is en", async () => {
    const view = render(<TabTerminal stackId="stk-1" locale="en" />)
    expect(
      view.getByText(/A shell inside your application container/)
    ).toBeDefined()
    await waitFor(() => {
      expect(view.getByTestId("stack-terminal")).toBeDefined()
    })
  })
})
