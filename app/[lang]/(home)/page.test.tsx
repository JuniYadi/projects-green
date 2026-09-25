import { describe, expect, it, mock } from "bun:test"
import { fireEvent, render } from "@testing-library/react"
const mockGetHomeOffer = mock(async () => ({
  monthlyPriceIdr: "29000",
}))
mock.module("./home-offer", () => ({ getHomeOffer: mockGetHomeOffer }))
mock.module("next/server", () => ({ connection: mock(async () => {}) }))

const { default: HomePage } = await import("./page")
import HomeLayout from "./layout"

describe("HomePage and HomeLayout", () => {
  it("renders HomePage with main element", async () => {
    const { container, getByRole, getByText } = render(await HomePage())
    expect(container.querySelector("main")).toBeInTheDocument()
    expect(
      getByRole("heading", { name: /Close your laptop/ })
    ).toBeInTheDocument()
    expect(getByRole("button", { name: "Logs" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    fireEvent.click(getByRole("button", { name: "Next feature" }))
    expect(getByRole("button", { name: "Metrics" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    fireEvent.click(getByRole("button", { name: "HTTP Traffic" }))
    expect(getByRole("button", { name: "HTTP Traffic" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(getByText("Top pages")).toBeInTheDocument()
    expect(mockGetHomeOffer).toHaveBeenCalled()
  })

  it("renders HomeLayout wrapper", () => {
    const { getByText } = render(
      <HomeLayout>
        <div>Content</div>
      </HomeLayout>
    )
    expect(getByText("Content")).toBeInTheDocument()
  })
})
