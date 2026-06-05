import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
import { PayAsYouGoSelector } from "./pay-as-you-go-selector"

describe("PayAsYouGoSelector", () => {
  it("renders CPU and memory sliders with current values", () => {
    const view = render(
      <PayAsYouGoSelector
        cpu={500}
        memory={1024}
        bufferHours={24}
        onCpuChange={mock()}
        onMemoryChange={mock()}
        onBufferHoursChange={mock()}
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
        bufferHours={24}
        onCpuChange={mock()}
        onMemoryChange={mock()}
        onBufferHoursChange={mock()}
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
        bufferHours={24}
        onCpuChange={mock()}
        onMemoryChange={mock()}
        onBufferHoursChange={mock()}
      />
    )

    const sliders = view.container.querySelectorAll('[data-slot="slider"]')
    expect(sliders.length).toBe(2)
  })

  it("renders default buffer hours of 24", () => {
    const view = render(
      <PayAsYouGoSelector
        cpu={500}
        memory={1024}
        bufferHours={24}
        onCpuChange={mock()}
        onMemoryChange={mock()}
        onBufferHoursChange={mock()}
      />
    )

    const input = view.getByLabelText("Runtime buffer (hours)") as HTMLInputElement
    expect(input.value).toBe("24")
  })

  it("renders required balance when hourly cost is provided", () => {
    const view = render(
      <PayAsYouGoSelector
        cpu={500}
        memory={1024}
        bufferHours={48}
        hourlyCost={10}
        onCpuChange={mock()}
        onMemoryChange={mock()}
        onBufferHoursChange={mock()}
      />
    )

    expect(view.getByText("Required balance")).toBeInTheDocument()
    expect(view.getByText(/480/)).toBeInTheDocument()
  })

  it("does not render required balance when hourly cost is not provided", () => {
    const view = render(
      <PayAsYouGoSelector
        cpu={500}
        memory={1024}
        bufferHours={24}
        onCpuChange={mock()}
        onMemoryChange={mock()}
        onBufferHoursChange={mock()}
      />
    )

    expect(view.queryByText("Required balance")).not.toBeInTheDocument()
  })
})
