import "@/test/register"
import { describe, it, expect, beforeEach, mock } from "bun:test"
import { render, fireEvent, cleanup } from "@testing-library/react"
import * as React from "react"

let resolvedTheme = "dark"
const setTheme = mock((theme: string) => {
  resolvedTheme = theme
})

mock.module("next-themes", () => ({
  useTheme: () => ({ resolvedTheme, setTheme }),
}))

const { ThemeToggle } = await import("./theme-toggle")

describe("ThemeToggle", () => {
  beforeEach(() => {
    cleanup()
    resolvedTheme = "dark"
    setTheme.mockClear()
  })

  it("renders theme toggle button and switches to light when currently dark", () => {
    resolvedTheme = "dark"
    const view = render(<ThemeToggle />)
    const button = view.getByRole("button", { name: /toggle theme/i })
    expect(button).toBeDefined()
    fireEvent.click(button)
    expect(setTheme).toHaveBeenCalledWith("light")
  })

  it("switches to dark when currently light", () => {
    resolvedTheme = "light"
    const view = render(<ThemeToggle />)
    const button = view.getByRole("button", { name: /toggle theme/i })
    fireEvent.click(button)
    expect(setTheme).toHaveBeenCalledWith("dark")
  })
})
