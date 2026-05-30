import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
import { PayAsYouGoSelector } from "./pay-as-you-go-selector"

describe("PayAsYouGoSelector", () => {
  it("renders CPU and memory sliders with current values", () => {
    const view = render(
      <PayAsYouGoSelector
        cpu={500}
        memory={1024}
        onCpuChange={mock()}
        onMemoryChange={mock()}
      />
    )

    expect(view.getByText("500m")).toBeInTheDocument()
    expect(view.getByText("1024Mi")).toBeInTheDocument()
  })

  it("renders min/max hint text", () => {
    const view = render(
      <PayAsYouGoSelector
        cpu={100}
        memory={256}
        onCpuChange={mock()}
        onMemoryChange={mock()}
      />
    )

    expect(view.getByText(/Minimum 100m, maximum 2000m/)).toBeInTheDocument()
    expect(view.getByText(/Minimum 256Mi, maximum 4096Mi/)).toBeInTheDocument()
  })

  it("renders slider with data-slot attribute", () => {
    const view = render(
      <PayAsYouGoSelector
        cpu={100}
        memory={256}
        onCpuChange={mock()}
        onMemoryChange={mock()}
      />
    )

    const sliders = view.container.querySelectorAll('[data-slot="slider"]')
    expect(sliders.length).toBe(2)
  })
})
