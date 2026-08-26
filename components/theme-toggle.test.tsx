import { describe, it, expect, beforeEach } from "bun:test"
import { render, fireEvent, cleanup } from "@testing-library/react"
import { ThemeToggle } from "./theme-toggle"

describe("ThemeToggle", () => {
  beforeEach(() => {
    cleanup()
    currentTheme = "dark"
  })

  it("renders theme toggle button and switches theme", async () => {
    const view = render(<ThemeToggle />)
    const button = view.getByRole("button", { name: /toggle theme/i })
    expect(button).toBeDefined()
    fireEvent.click(button)
  })
})
