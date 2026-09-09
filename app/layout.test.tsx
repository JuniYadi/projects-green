mock.module("next/font/google", () => ({
  JetBrains_Mono: () => ({ variable: "--font-heading" }),
  Space_Mono: () => ({ variable: "--font-display" }),
  Roboto: () => ({ variable: "--font-sans" }),
}))

import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
import "@testing-library/jest-dom"

mock.module("next/headers", () => ({
  cookies: mock(async () => ({
    get: () => ({ value: "en" }),
  })),
}))

mock.module("@workos-inc/authkit-nextjs/components", () => ({
  AuthKitProvider: ({ children }: { children: React.ReactNode }) => children,
}))

mock.module("@/components/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

mock.module("@/components/query-provider", () => ({
  QueryProvider: ({ children }: { children: React.ReactNode }) => children,
}))

mock.module("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
}))

mock.module("@/components/ui/sonner", () => ({
  Toaster: () => <div data-testid="toaster" />,
}))

const { default: RootLayout } = await import("@/app/layout")

describe("RootLayout", () => {
  it("renders children and Toaster component", async () => {
    const LayoutComponent = await RootLayout({
      children: <div data-testid="root-child">Test Content</div>,
    })

    const view = render(LayoutComponent)
    expect(view.getByTestId("root-child")).toHaveTextContent("Test Content")
    expect(view.getByTestId("toaster")).toBeInTheDocument()
  })

  it("renders head script that strips next.js version from window.next", async () => {
    const LayoutComponent = await RootLayout({
      children: <div>Child</div>,
    })

    const [head] = LayoutComponent.props.children as [
      React.ReactElement<{
        children: React.ReactElement<{
          dangerouslySetInnerHTML: { __html: string }
        }>
      }>,
      React.ReactElement,
    ]
    expect(head.type).toBe("head")
    const script = head.props.children
    expect(script.type).toBe("script")
    const scriptContent = script.props.dangerouslySetInnerHTML.__html
    expect(scriptContent).toContain("delete v.version")

    // Execute the script content to verify it sanitizes window.next
    const mockWindow: Record<string, unknown> = {}
    const initScript = new Function("window", scriptContent)
    initScript(mockWindow)

    // Next.js client bootstrap assignment simulation
    mockWindow.next = { version: "16.2.11", appDir: true }
    expect((mockWindow.next as Record<string, unknown>).version).toBeUndefined()
    expect((mockWindow.next as Record<string, unknown>).appDir).toBe(true)
  })
})
