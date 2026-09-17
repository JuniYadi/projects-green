import { afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { DeployPromptBar } from "./deploy-prompt-bar"

describe("DeployPromptBar", () => {
  afterEach(cleanup)
  it("renders input field, send button, and quick suggestion chips", () => {
    const onSend = mock(() => {})
    const view = render(<DeployPromptBar onSend={onSend} />)

    expect(view.getByTestId("deploy-prompt-bar")).toBeTruthy()
    expect(view.getByText("Ganti port ke 8080")).toBeTruthy()
    expect(view.getByText("Kenapa Medium tier?")).toBeTruthy()
    expect(view.getByText("Deploy https://github.com/...")).toBeTruthy()
    expect(view.getByRole("button", { name: /send/i })).toBeTruthy()
  })

  it("disables send button when input is empty or when disabled prop is set", () => {
    const onSend = mock(() => {})
    const { getByRole, rerender } = render(
      <DeployPromptBar onSend={onSend} disabled={false} />
    )

    const sendBtn = getByRole("button", { name: /send/i })
    expect(sendBtn).toBeDisabled()

    rerender(<DeployPromptBar onSend={onSend} disabled={true} />)
    expect(sendBtn).toBeDisabled()
  })

  it("calls onSend when user types prompt and submits", () => {
    const onSend = mock((_msg: string) => {})
    const view = render(<DeployPromptBar onSend={onSend} />)

    const input = view.getByRole("textbox")
    fireEvent.change(input, { target: { value: "Ganti port ke 8080" } })

    const sendBtn = view.getByRole("button", { name: /send/i })
    expect(sendBtn).not.toBeDisabled()

    fireEvent.click(sendBtn)
    expect(onSend).toHaveBeenCalledWith("Ganti port ke 8080")
    expect(input).toHaveValue("")
  })

  it("calls onSend with Enter key press without shift", () => {
    const onSend = mock((_msg: string) => {})
    const view = render(<DeployPromptBar onSend={onSend} />)

    const input = view.getByRole("textbox")
    fireEvent.change(input, { target: { value: "Kenapa Medium tier?" } })
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false })

    expect(onSend).toHaveBeenCalledWith("Kenapa Medium tier?")
    expect(input).toHaveValue("")
  })

  it("triggers onSend when quick suggestion chip is clicked", () => {
    const onSend = mock((_msg: string) => {})
    const view = render(<DeployPromptBar onSend={onSend} />)

    const chip = view.getByText("Ganti port ke 8080")
    fireEvent.click(chip)

    expect(onSend).toHaveBeenCalledWith("Ganti port ke 8080")
  })
})
