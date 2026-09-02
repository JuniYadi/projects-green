import "@/test/register"
import { cleanup, fireEvent, render, within } from "@testing-library/react"
import { afterEach, describe, expect, it, mock } from "bun:test"
import { ConversationSummaryPill, SmartComposerBar } from "./whatsapp-inbox"

afterEach(() => cleanup())

describe("WhatsApp inbox Agent P in-situ components", () => {
  it("renders a collapsible conversation summary", () => {
    const view = render(
      <ConversationSummaryPill summary="Customer needs help with their order." />
    )

    const queries = within(view.container)
    expect(queries.getByText("Conversation summary")).toBeInTheDocument()
    expect(
      queries.getByText("Customer needs help with their order.")
    ).toBeInTheDocument()
    fireEvent.click(
      queries.getByRole("button", { name: /conversation summary/i })
    )
    expect(
      queries.queryByText("Customer needs help with their order.")
    ).not.toBeInTheDocument()
  })

  it("turns a suggested reply into an editable draft without sending", () => {
    const onSelect = mock((_suggestion: string) => {})
    const view = render(
      <SmartComposerBar
        suggestions={[
          "Thanks for reaching out!",
          "We will check this for you.",
        ]}
        onSelect={onSelect}
      />
    )

    const queries = within(view.container)
    fireEvent.click(
      queries.getByRole("button", { name: "Thanks for reaching out!" })
    )
    expect(onSelect).toHaveBeenCalledWith("Thanks for reaching out!")
    expect(
      queries.queryByRole("button", { name: /^send$/i })
    ).not.toBeInTheDocument()
  })
})
