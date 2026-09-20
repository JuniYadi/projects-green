import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import HomeLayout from "./layout"

describe("HomeLayout", () => {
  it("renders children inside layout", () => {
    const { getByText } = render(
      <HomeLayout>
        <div>Test Layout Content</div>
      </HomeLayout>
    )
    expect(getByText("Test Layout Content")).toBeInTheDocument()
  })
})
