import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { InteractiveComposer } from "./interactive-composer"

const mockOnSend = mock(async (_payload: unknown) => {})
const mockOnOpenChange = mock((_open: boolean) => {})

const devices = [
  {
    id: "device-1",
    phoneNumber: "+628111111111",
    status: "ACTIVE",
  },
  {
    id: "device-2",
    phoneNumber: "+628222222222",
    status: "INACTIVE",
  },
]

describe("InteractiveComposer", () => {
  beforeEach(() => {
    mockOnSend.mockClear()
    mockOnOpenChange.mockClear()
    mockOnSend.mockResolvedValue(undefined)
  })
  afterEach(() => {
    cleanup()
  })

  it("renders the composer fields and default reply buttons mode", () => {
    const view = render(
      <InteractiveComposer
        open
        onOpenChange={mockOnOpenChange}
        onSend={mockOnSend}
        devices={devices}
      />
    )

    expect(
      view.getByRole("heading", { name: "Send Interactive Message" })
    ).toBeInTheDocument()
    expect(view.getByText("Reply Buttons (1/3)")).toBeInTheDocument()
    expect(view.getByPlaceholderText("Message body text")).toBeInTheDocument()
    expect(view.getByPlaceholderText("Button ID")).toBeInTheDocument()
    expect(view.getByPlaceholderText("Button title")).toBeInTheDocument()
    expect(
      view.getByRole("option", { name: /\+628111111111/ })
    ).toBeInTheDocument()
  })

  it("switches between buttons, list, and CTA URL modes", async () => {
    const user = userEvent.setup()
    const view = render(<InteractiveComposer open onSend={mockOnSend} />)

    await user.click(view.getByRole("tab", { name: "List" }))
    expect(view.getByText("List Button Text")).toBeInTheDocument()
    expect(
      view.getByPlaceholderText("Section title (required if >1 section)")
    ).toBeInTheDocument()
    expect(view.queryByPlaceholderText("Button ID")).not.toBeInTheDocument()

    await user.click(view.getByRole("tab", { name: "CTA URL" }))
    expect(view.getByText("CTA URL Buttons (1/3)")).toBeInTheDocument()
    expect(view.getByPlaceholderText("Display text")).toBeInTheDocument()
    expect(view.getByPlaceholderText("https://example.com")).toBeInTheDocument()
  })

  it("shows validation errors for required body and invalid CTA URLs", async () => {
    const user = userEvent.setup()
    const view = render(<InteractiveComposer open onSend={mockOnSend} />)

    expect(view.getByText("Body text is required")).toBeInTheDocument()
    expect(view.getByRole("button", { name: "Send Buttons" })).toBeDisabled()

    await user.type(
      view.getByPlaceholderText("Message body text"),
      "Choose an option"
    )
    await user.click(view.getByRole("tab", { name: "CTA URL" }))

    await user.type(view.getByPlaceholderText("Display text"), "Open site")
    expect(view.getByRole("button", { name: "Send CTA URL" })).toBeDisabled()
  })

  it("sends a reply buttons payload with the selected device", async () => {
    const user = userEvent.setup()
    const view = render(
      <InteractiveComposer
        open
        onOpenChange={mockOnOpenChange}
        onSend={mockOnSend}
        devices={devices}
      />
    )

    await user.type(view.getByPlaceholderText("+628123456789"), "+628999999999")
    await user.type(view.getByPlaceholderText("Message body text"), "Pick one")
    await user.type(view.getByPlaceholderText("Button ID"), "confirm")
    await user.type(view.getByPlaceholderText("Button title"), "Confirm")
    await user.selectOptions(view.getByRole("combobox"), "device-1")
    await user.click(view.getByRole("button", { name: "Send Buttons" }))

    await waitFor(() => expect(mockOnSend).toHaveBeenCalledTimes(1))
    expect(mockOnSend).toHaveBeenCalledWith({
      phoneNumber: "+628999999999",
      deviceId: "device-1",
      interactive: {
        type: "button",
        body: { text: "Pick one" },
        action: {
          buttons: [
            {
              type: "reply",
              reply: { id: "confirm", title: "Confirm" },
            },
          ],
        },
      },
    })
    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })
})
