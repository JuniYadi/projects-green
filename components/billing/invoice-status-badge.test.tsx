import "@/test/register"
import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import { InvoiceStatusBadge } from "./invoice-status-badge"

describe("InvoiceStatusBadge", () => {
  it("renders OPEN status text correctly", () => {
    const view = render(<InvoiceStatusBadge status="OPEN" />)
    expect(view.getByText("Open")).toBeInTheDocument()
  })

  it("renders PAID status text correctly", () => {
    const view = render(<InvoiceStatusBadge status="PAID" />)
    expect(view.getByText("Paid")).toBeInTheDocument()
  })

  it("renders VOID status text correctly", () => {
    const view = render(<InvoiceStatusBadge status="VOID" />)
    expect(view.getByText("Void")).toBeInTheDocument()
  })

  it("applies custom className", () => {
    const view = render(
      <InvoiceStatusBadge status="PAID" className="custom-class" />
    )
    const badges = view.container.querySelectorAll(".custom-class")
    expect(badges.length).toBeGreaterThan(0)
  })
})
