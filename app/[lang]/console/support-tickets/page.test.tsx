import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import SupportTicketsPage from "@/app/[lang]/console/support-tickets/page"

describe("SupportTicketsPage", () => {
  it("renders support ticket table tools and records", async () => {
    const ui = await SupportTicketsPage({
      params: Promise.resolve({ lang: "en" }),
    })
    const view = render(ui)

    expect(view.getByRole("heading", { name: "Support Tickets" })).toBeTruthy()
    expect(view.getByText("Ticket Queue")).toBeTruthy()
    expect(view.getByRole("button", { name: "Ticket ID" })).toBeTruthy()
    expect(
      view.getByLabelText("Filter by Ticket ID or Title...")
    ).toBeTruthy()
    expect(view.getByText("Domain verification pending")).toBeTruthy()
    expect(view.getByText("TCK-2018")).toBeTruthy()
    expect(view.getByText("High")).toBeTruthy()
  })
})
