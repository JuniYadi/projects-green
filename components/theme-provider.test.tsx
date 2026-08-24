import "@/test/register"
import { beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import * as React from "react"

let resolvedTheme: "light" | "dark" = "light"
const setTheme = mock((theme: string) => {
  resolvedTheme = theme as "light" | "dark"
})

const onRenderProvider = mock((_props: Record<string, unknown>) => {})

function MockNextThemesProvider({
  children,
  ...props
}: React.PropsWithChildren<Record<string, unknown>>) {
  React.useEffect(() => {
    onRenderProvider(props)
  }, [props])
  return (
    <div data-testid="mock-provider" data-props={JSON.stringify(props)}>
      {children}
    </div>
  )
}

mock.module("next-themes", () => ({
  ThemeProvider: MockNextThemesProvider,
  useTheme: () => ({ resolvedTheme, setTheme }),
}))

const { ThemeProvider } = await import("./theme-provider")

describe("ThemeProvider", () => {
  beforeEach(() => {
    cleanup()
    resolvedTheme = "light"
    setTheme.mockClear()
    onRenderProvider.mockClear()
  })
  it("passes the application's default theme behavior to next-themes", () => {
    const view = render(
      <ThemeProvider>
        <span>content</span>
      </ThemeProvider>
    )

    const el = view.getByTestId("mock-provider")
    const props = JSON.parse(el.getAttribute("data-props") || "{}")
    expect(props).toMatchObject({
      attribute: "class",
      defaultTheme: "system",
      enableSystem: true,
      disableTransitionOnChange: true,
      enableColorScheme: false,
    })
  })

  it("toggles between light and dark when d is pressed", () => {
    render(<ThemeProvider />)

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "d" }))
    expect(setTheme).toHaveBeenLastCalledWith("dark")

    resolvedTheme = "dark"
    cleanup()
    render(<ThemeProvider />)
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "D" }))
    expect(setTheme).toHaveBeenLastCalledWith("light")
  })
  it("does not toggle while typing or when a modifier or repeat is present", () => {
    const view = render(
      <ThemeProvider>
        <input aria-label="input" />
        <textarea aria-label="textarea" />
        <select aria-label="select" />
        <div aria-label="editable" contentEditable />
      </ThemeProvider>
    )

    for (const label of ["input", "textarea", "select", "editable"]) {
      view
        .getByLabelText(label)
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "d", bubbles: true })
        )
    }
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "d", ctrlKey: true })
    )
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "d", metaKey: true })
    )
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "d", altKey: true })
    )
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "d", repeat: true })
    )

    expect(setTheme).not.toHaveBeenCalled()
  })
})
