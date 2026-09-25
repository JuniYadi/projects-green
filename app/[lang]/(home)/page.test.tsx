import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
const mockGetHomeOffer = mock(async () => ({
  kind: "standard" as const,
  monthlyPriceIdr: "29000",
}))
mock.module("./home-offer", () => ({ getHomeOffer: mockGetHomeOffer }))
mock.module("next/server", () => ({ connection: mock(async () => {}) }))

const { default: HomePage } = await import("./page")
import HomeLayout from "./layout"

describe("HomePage and HomeLayout", () => {
  it("renders HomePage with main element", async () => {
    const { container } = render(await HomePage())
    expect(container.querySelector("main")).toBeInTheDocument()
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
