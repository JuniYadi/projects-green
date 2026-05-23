import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import "@testing-library/jest-dom"

import ConsoleAppLayout from "@/app/[lang]/console/app/layout"

describe("ConsoleAppLayout", () => {
  it("renders app routes in a shared full-width layout shell", () => {
    const view = render(
      <ConsoleAppLayout>
        <div>App Content</div>
      </ConsoleAppLayout>
    )

    const main = view.getByRole("main")
    expect(main.className).toContain("w-full")
    expect(main.className).toContain("p-6")
    expect(main.className).not.toContain("max-w")
    expect(main).toHaveTextContent("App Content")
  })
})
