import "@/test/register"
import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import { InvoiceStatusBadge } from "./invoice-status-badge"

describe("InvoiceStatusBadge", () => {
  it("renders PENDING status with yellow styling", () => {
    const { getByText } = render(<InvoiceStatusBadge status="PENDING" />)

    const badge = getByText("Pending")
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain("yellow")
  })

  it("renders PAID status with green styling", () => {
    const { getByText } = render(<InvoiceStatusBadge status="PAID" />)

    const badge = getByText("Paid")
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain("green")
  })

  it("renders VOID status with red styling", () => {
    const { getByText } = render(<InvoiceStatusBadge status="VOID" />)

    const badge = getByText("Void")
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain("red")
  })

  it("applies custom className", () => {
    const { getByText } = render(
      <InvoiceStatusBadge status="PAID" className="custom-class" />
    )

    const badge = getByText("Paid")
    expect(badge.className).toContain("custom-class")
  })
})
