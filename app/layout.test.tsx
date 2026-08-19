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
})
