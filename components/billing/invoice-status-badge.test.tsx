import "@/test/register"
import { describe, expect, it } from "bun:test"
import { render, screen } from "@testing-library/react"

import { InvoiceStatusBadge } from "./invoice-status-badge"

describe("InvoiceStatusBadge", () => {
  it("renders PENDING status text correctly", () => {
    render(<InvoiceStatusBadge status="PENDING" />)
    expect(screen.getByText("Pending")).toBeInTheDocument()
  })

  it("renders PAID status text correctly", () => {
    render(<InvoiceStatusBadge status="PAID" />)
    expect(screen.getByText("Paid")).toBeInTheDocument()
  })

  it("renders VOID status text correctly", () => {
    render(<InvoiceStatusBadge status="VOID" />)
    expect(screen.getByText("Void")).toBeInTheDocument()
  })

  it("applies custom className", () => {
    render(<InvoiceStatusBadge status="PAID" className="custom-class" />)
    const badge = screen.getByText("Paid")
    expect(badge.className).toContain("custom-class")
  })
})
