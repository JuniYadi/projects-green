import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import SupportTicketsPage from "@/app/[lang]/console/support-tickets/page"

describe("SupportTicketsPage", () => {
  it("renders support ticket heading and queue section", async () => {
    const ui = await SupportTicketsPage({
      params: Promise.resolve({ lang: "en" }),
    })
    const view = render(ui)

    expect(
      view.getByRole("heading", { name: "Support Tickets" })
    ).toBeInTheDocument()
    expect(view.getByText("Ticket Queue")).toBeInTheDocument()
    expect(view.getByRole("button", { name: "Open Ticket" })).toBeInTheDocument()
  })
})
