import "@/test/register"
import { describe, expect, it, mock, afterEach, beforeEach } from "bun:test"
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

const mockLocale = { value: "en" }
mock.module("next/navigation", () => ({
  useParams: mock(() => ({ lang: mockLocale.value })),
  useRouter: mock(() => ({ push: mock(() => {}) })),
}))
mock.module("@/lib/i18n/pathname", () => ({
  localizePathname: (opts: { pathname: string; locale: string }) =>
    `/${opts.locale}${opts.pathname}`,
  resolveLocaleOrDefault: (lang: string) => lang || "en",
}))

mock.module("@/components/ui/button", () => ({
  Button: ({
    children,
    variant,
    size,
    asChild: _asChild,
    ...props
  }: {
    children: React.ReactNode
    variant?: string
    size?: string
    asChild?: boolean
  }) => (
    <button {...props} data-testid={`button-${variant}-${size}`}>
      {children}
    </button>
  ),
}))

// ─── Dynamic imports after mocks ─────────────────────────────────────

const { default: PortalApplicationsPage } = await import("./page")

beforeEach(() => {
  mockLocale.value = "en"
})

afterEach(() => {
  cleanup()
  mock.restore()
})

describe("PortalApplicationsPage", () => {
  it("renders page title and subtitle", () => {
    const { getByText } = render(<PortalApplicationsPage />)
    expect(getByText("App Hosting Admin")).toBeInTheDocument()
    expect(
      getByText(
        "Manage the infrastructure and deployment operations that power customer apps."
      )
    ).toBeInTheDocument()
  })

  it("renders cluster inventory card and templates card with links", () => {
    const { getByText } = render(<PortalApplicationsPage />)
    expect(getByText("Cluster Inventory")).toBeInTheDocument()
    expect(getByText("View Clusters")).toBeInTheDocument()
    expect(getByText("Marketplace Templates")).toBeInTheDocument()
    expect(getByText("Review Templates")).toBeInTheDocument()
  })

  it("renders deployments monitor card with link to /portal/app/deployments", () => {
    const { getByText } = render(<PortalApplicationsPage />)
    expect(getByText("Deployments Monitor")).toBeInTheDocument()
    expect(getByText("View Deployments")).toBeInTheDocument()
  })

  it("selects Indonesian overview copy from the route locale", () => {
    mockLocale.value = "id"
    const { getByText } = render(<PortalApplicationsPage />)
    expect(getByText("Admin App Hosting")).toBeInTheDocument()
    expect(
      getByText(
        "Kelola infrastruktur dan operasi deployment yang menjalankan aplikasi pelanggan."
      )
    ).toBeInTheDocument()
    expect(getByText("Tinjau Template")).toBeInTheDocument()
  })
})
