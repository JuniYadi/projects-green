import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test"
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { MonorepoDisambiguationCard } from "./monorepo-disambiguation-card"

describe("MonorepoDisambiguationCard", () => {
  beforeEach(() => {
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders header, explanatory copy, and default quick-pick chips", () => {
    const onSelectProject = mock(() => {})
    const view = render(
      <MonorepoDisambiguationCard onSelectProject={onSelectProject} />
    )

    expect(
      view.getByText(/STRUKTUR MONOREPO \/ MULTI-APP TERDETEKSI/i)
    ).toBeDefined()
    expect(
      view.getByText(
        /Saya mendeteksi repositori ini memiliki beberapa project terpisah/i
      )
    ).toBeDefined()
    expect(
      view.getByText(/1\. apps\/web \(Next\.js 15\.4 · Frontend\)/i)
    ).toBeDefined()
    expect(
      view.getByText(/2\. services\/api \(Go Gin · REST Backend\)/i)
    ).toBeDefined()
  })

  it("calls onSelectProject when a quick-pick chip is clicked", () => {
    const onSelectProject = mock(() => {})
    const view = render(
      <MonorepoDisambiguationCard onSelectProject={onSelectProject} />
    )

    const firstChip = view.getByTestId("monorepo-chip-0")
    act(() => {
      fireEvent.click(firstChip)
    })

    expect(onSelectProject).toHaveBeenCalledWith("apps/web", "Next.js 15.4")
  })

  it("calls onSelectProject when custom root path is typed and applied", () => {
    const onSelectProject = mock(() => {})
    const view = render(
      <MonorepoDisambiguationCard onSelectProject={onSelectProject} />
    )

    const customInput = view.getByTestId("monorepo-custom-input")
    act(() => {
      fireEvent.change(customInput, { target: { value: "./packages/docs" } })
    })

    const applyBtn = view.getByTestId("monorepo-apply-btn")
    act(() => {
      fireEvent.click(applyBtn)
    })

    expect(onSelectProject).toHaveBeenCalledWith("./packages/docs")
  })
})
