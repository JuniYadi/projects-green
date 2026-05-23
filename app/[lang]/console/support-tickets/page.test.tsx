import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import { act } from "react"

import SupportTicketsPage from "@/app/[lang]/console/support-tickets/page"

describe("SupportTicketsPage", () => {
  it("renders support ticket heading and queue section", async () => {
    const ui = await SupportTicketsPage({
      params: Promise.resolve({ lang: "en" }),
    })

    let view!: ReturnType<typeof render>

    await act(async () => {
      view = render(ui)
    })

    expect(
      view.getByRole("heading", { name: "Support Tickets" })
    ).toBeInTheDocument()
    expect(view.getByText("Ticket Queue")).toBeInTheDocument()
  })
})
