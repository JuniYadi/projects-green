import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import "@testing-library/jest-dom"

import SupportTicketDetailPage from "@/app/[lang]/console/support-tickets/[ticketId]/page"

describe("SupportTicketDetailPage", () => {
  it("renders support ticket detail header", async () => {
    const ui = await SupportTicketDetailPage({
      params: Promise.resolve({ lang: "en", ticketId: "ticket_1" }),
    })
    const view = render(ui)

    expect(
      view.getByRole("heading", { name: "Support Ticket Detail" })
    ).toBeInTheDocument()
    expect(
      view.getByRole("link", { name: "Back to Support Tickets" })
    ).toHaveAttribute("href", "/en/console/support-tickets")
  })
})
