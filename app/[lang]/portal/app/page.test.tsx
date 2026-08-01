import { describe, expect, it, mock, afterEach } from "bun:test"
import { render, cleanup } from "@testing-library/react"
import "@testing-library/jest-dom"

// ─── Mock modules before any imports ─────────────────────────────────

mock.module("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

mock.module("@phosphor-icons/react", () => ({
  Database: (props: Record<string, unknown>) => (
    <span data-testid="icon-database" {...props} />
  ),
}))

mock.module("next/navigation", () => ({
  useParams: mock(() => ({ lang: "en" })),
}))

mock.module("@/lib/i18n/pathname", () => ({
  localizePathname: (opts: { pathname: string; locale: string }) =>
    `/en${opts.pathname}`,
  resolveLocaleOrDefault: (lang: string) => lang || "en",
}))

mock.module("@/components/ui/button", () => ({
  Button: ({
    children,
    variant,
    size,
    asChild,
    ...props
  }: {
    children?: React.ReactNode
    variant?: string
    size?: string
    asChild?: boolean
    [key: string]: unknown
  }) => (
    <button {...props} data-testid={`button-${variant}-${size}`}>
      {children}
    </button>
  ),
}))

// ─── Dynamic imports after mocks ─────────────────────────────────────

const { default: PortalApplicationsPage } = await import("./page")

afterEach(() => {
  cleanup()
  mock.restore()
})

describe("PortalApplicationsPage", () => {
  it("renders the App Hosting Admin heading", () => {
    const { getByText } = render(<PortalApplicationsPage />)
    expect(getByText("App Hosting Admin")).toBeDefined()
  })

  it("renders the Cluster Inventory heading", () => {
    const { getByText } = render(<PortalApplicationsPage />)
    expect(getByText("Cluster Inventory")).toBeDefined()
  })

  it("renders the View Clusters link", () => {
    const { getByText } = render(<PortalApplicationsPage />)
    const link = getByText("View Clusters").closest("a")
    expect(link?.getAttribute("href")).toBe("/en/portal/app/clusters")
  })

  it("does not render deployment monitoring content", () => {
    const { container } = render(<PortalApplicationsPage />)

    // No app table
    expect(container.querySelector("table")).toBeNull()

    // No Logs/Events/Metrics/Settings action links
    expect(container.querySelectorAll("a:has-text('Logs')")).toHaveLength(0)
    expect(container.querySelectorAll("a:has-text('Events')")).toHaveLength(0)
    expect(container.querySelectorAll("a:has-text('Metrics')")).toHaveLength(0)
    expect(container.querySelectorAll("a:has-text('Settings')")).toHaveLength(0)

    // No retry button
    expect(container.querySelector("button:has-text('Retry')")).toBeNull()

    // No loading state
    expect(container.querySelector(":has-text('Loading')")).toBeNull()

    // No error state
    expect(container.querySelector(":has-text('Error')")).toBeNull()

    // No empty app state
    expect(container.querySelector(":has-text('No applications')")).toBeNull()
  })
})
