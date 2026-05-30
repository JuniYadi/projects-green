import "@/test/register"
import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import { InvoiceStatusBadge } from "./invoice-status-badge"

describe("InvoiceStatusBadge", () => {
  it("renders PENDING status text correctly", () => {
    const view = render(<InvoiceStatusBadge status="PENDING" />)
    expect(view.getByText("Pending")).toBeInTheDocument()
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
    const view = render(<InvoiceStatusBadge status="PAID" className="custom-class" />)
    const badge = view.getByText("Paid")
    expect(badge.className).toContain("custom-class")
  })
})
