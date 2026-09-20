import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import HomePage from "./page"
import HomeLayout from "./layout"

describe("HomePage and HomeLayout", () => {
  it("renders HomePage with main element", () => {
    const { container } = render(<HomePage />)
    expect(container.querySelector("main")).toBeInTheDocument()
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
