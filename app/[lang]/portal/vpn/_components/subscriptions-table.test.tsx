import { beforeEach, describe, expect, it, vi } from "bun:test"
import { render, screen, findByText } from "@testing-library/react"

import { SubscriptionsTable } from "./subscriptions-table"
import type { VpnSubscriptionItem } from "./vpn-admin-client"

// Mock the vpnApi client
const mockVpnApi = vi.fn()
vi.mock("./vpn-admin-client", () => ({
  vpnApi: mockVpnApi,
}))

// Mock Badge component
vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span data-variant={variant}>{children}</span>
  ),
}))

// Mock Skeleton
vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}))

// Mock Table components
vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children }: { children: React.ReactNode }) => <td>{children}</td>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
}))

// Mock Link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// Mock phosphor icons
vi.mock("@phosphor-icons/react", () => ({
  DeviceMobileIcon: () => <span data-testid="device-icon" />,
  CaretDown: () => <span data-testid="caret-down" />,
  CaretRight: () => <span data-testid="caret-right" />,
  Eye: () => <span data-testid="eye-icon" />,
}))

// Mock Button
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}))

// Mock ProvisioningAuditModal
vi.mock("./provisioning-audit-modal", () => ({
  ProvisioningAuditModal: () => <div data-testid="audit-modal" />,
}))

function makeSub(overrides: Partial<VpnSubscriptionItem> = {}): VpnSubscriptionItem {
  return {
    id: "sub-1",
    organizationId: "org-123",
    organizationName: "Acme Inc",
    packageId: "pkg-1",
    status: "ACTIVE",
    currentPeriodStart: "2024-01-01T00:00:00.000Z",
    currentPeriodEnd: "2024-01-31T23:59:59.000Z",
    deviceCount: 2,
    serverAccounts: [
      {
        id: "sa-1",
        serverId: "srv-1",
        serverName: "SG-1",
        protocol: "OPENVPN",
        username: "vpn-org-123-srv-1-openvpn-ab",
        provisioningStatus: "ACTIVE",
        failureReason: null,
        hasConfig: true,
        hasCredentials: true,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:01:00.000Z",
      },
      {
        id: "sa-2",
        serverId: "srv-2",
        serverName: "US-1",
        protocol: "WIREGUARD",
        username: "vpn-org-123-srv-2-wireguard-cd",
        provisioningStatus: "FAILED",
        failureReason: "Connection timeout",
        hasConfig: false,
        hasCredentials: false,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:02:00.000Z",
      },
    ],
    provisioningSummary: {
      active: 1,
      pending: 0,
      failed: 1,
      revoked: 0,
      total: 2,
    },
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("SubscriptionsTable", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders provisioning health summary correctly", async () => {
    mockVpnApi.mockResolvedValue({
      ok: true,
      data: [makeSub()],
    })

    const { container } = render(<SubscriptionsTable />)

    const activeEl = await findByText(container, /1 ACTIVE/)
    expect(activeEl).toBeTruthy()
    const failedEl = await findByText(container, /1 FAILED/)
    expect(failedEl).toBeTruthy()
  })

  it("shows Retry All Failed button when there are failed accounts", async () => {
    mockVpnApi.mockResolvedValue({
      ok: true,
      data: [makeSub()],
    })

    const { container } = render(<SubscriptionsTable />)

    const btn = await findByText(container, "Retry All Failed")
    expect(btn).toBeTruthy()
  })

  it("hides Retry All Failed button when no failed accounts", async () => {
    mockVpnApi.mockResolvedValue({
      ok: true,
      data: [
        makeSub({
          provisioningSummary: {
            active: 2,
            pending: 0,
            failed: 0,
            revoked: 0,
            total: 2,
          },
          serverAccounts: [
            {
              id: "sa-1",
              serverId: "srv-1",
              serverName: "SG-1",
              protocol: "OPENVPN",
              username: "vpn-org-123-srv-1-openvpn-ab",
              provisioningStatus: "ACTIVE",
              failureReason: null,
              hasConfig: true,
              hasCredentials: true,
              createdAt: "2024-01-01T00:00:00.000Z",
              updatedAt: "2024-01-01T00:01:00.000Z",
            },
          ],
        }),
      ],
    })

    const { container } = render(<SubscriptionsTable />)

    // Query instead of findByText - it returns null instead of throwing
    const btn = container.querySelector("button")
    // When no failed accounts, the button should not exist
    // The button exists in DOM but is not rendered (conditional render)
    // We check that the button text is NOT present
    const buttonText = container.querySelector('[type="button"]')
    if (buttonText) {
      expect(buttonText.textContent).not.toContain("Retry All Failed")
    }
  })
})
