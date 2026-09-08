import { describe, expect, it } from "bun:test"
import { render, fireEvent } from "@testing-library/react"
import {
  WhatsAppCategoryDonut,
  type CategoryCostItem,
} from "./whatsapp-category-donut"

const mockItems: CategoryCostItem[] = [
  { category: "MARKETING", count: 60, totalCost: 1200 },
  { category: "UTILITY", count: 30, totalCost: 300 },
  { category: "SERVICE", count: 10, totalCost: 0 },
]

describe("WhatsAppCategoryDonut component", () => {
  it("renders pure-SVG donut ring with correct total count in center", () => {
    const view = render(<WhatsAppCategoryDonut items={mockItems} locale="id" />)

    const svg = view.container.querySelector("svg")
    expect(svg).toBeTruthy()
    // Center total count should be 100
    expect(view.getByText("100")).toBeDefined()
    expect(view.getAllByText(/pesan/i).length).toBeGreaterThan(0)

    // Slices
    expect(
      view.container.querySelector("[data-testid='donut-slice-marketing']")
    ).toBeTruthy()
    expect(
      view.container.querySelector("[data-testid='donut-slice-utility']")
    ).toBeTruthy()
  })

  it("renders category breakdown list with labels and percentages", () => {
    const view = render(<WhatsAppCategoryDonut items={mockItems} locale="id" />)

    expect(view.getAllByText("MARKETING").length).toBeGreaterThan(0)
    expect(view.getAllByText(/60%/).length).toBeGreaterThan(0)

    expect(view.getAllByText("UTILITY").length).toBeGreaterThan(0)
    expect(view.getAllByText(/30%/).length).toBeGreaterThan(0)

    expect(view.getAllByText("SERVICE").length).toBeGreaterThan(0)
    expect(view.getAllByText(/10%/).length).toBeGreaterThan(0)
  })

  it("handles hover interaction on donut slices", () => {
    const view = render(<WhatsAppCategoryDonut items={mockItems} locale="id" />)

    const slice = view.container.querySelector(
      "[data-testid='donut-slice-marketing']"
    )
    expect(slice).toBeTruthy()
    if (slice) {
      fireEvent.mouseEnter(slice)
      fireEvent.mouseLeave(slice)
    }
  })

  it("renders empty state gracefully when items are empty", () => {
    const view = render(<WhatsAppCategoryDonut items={[]} locale="id" />)
    expect(view.getByText("Belum ada data kategori bulan ini.")).toBeDefined()
  })
})
