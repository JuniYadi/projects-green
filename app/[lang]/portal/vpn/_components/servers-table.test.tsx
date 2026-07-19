/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock } from "bun:test"
import { render, waitFor, fireEvent } from "@testing-library/react"
import type {
  VpnServerItem,
  VpnRegionItem,
  VpnSshKeyItem,
  ScanResult,
} from "./vpn-admin-client"

// ── Mock data factories ────────────────────────────────────────────────────────

function makeRegion(overrides: Partial<VpnRegionItem> = {}): VpnRegionItem {
  return {
    id: "region-sg",
    name: "Singapore",
    slug: "sg",
    countryCode: "SG",
    isActive: true,
    serverCount: 1,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function makeSshKey(overrides: Partial<VpnSshKeyItem> = {}): VpnSshKeyItem {
  return {
    id: "key-1",
    name: "deploy-key",
    fingerprint: "SHA256:abc123",
    usedByServerNames: ["SG-Primary"],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function makeServer(overrides: Partial<VpnServerItem> = {}): VpnServerItem {
  return {
    id: "srv-1",
    name: "SG-Primary",
    hostname: "sg-primary.example.com",
    ipAddress: "10.0.0.1",
    sshPort: 22,
    sshUser: "ubuntu",
    isActive: true,
    health: "HEALTHY",
    latitude: 1.3521,
    longitude: 103.8198,
    region: {
      id: "region-sg",
      name: "Singapore",
      slug: "sg",
      countryCode: "SG",
    },
    sshKey: { id: "key-1", name: "deploy-key", fingerprint: "SHA256:abc123" },
    protocols: {
      openVpn: { enabled: true, port: 1194 },
      wireGuard: { enabled: true, port: 51820 },
      proxy: { enabled: false, port: null },
    },
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    status: "completed",
    startedAt: "2024-01-01T00:00:00.000Z",
    completedAt: "2024-01-01T00:00:30.000Z",
    results: [],
    summary: { total: 4, passed: 4, failed: 0, errors: 0, skipped: 0 },
    ...overrides,
  }
}

// ── Module-level mocks (hoisted by Bun) ───────────────────────────────────────

const mockListVpnServers = mock<
  (..._args: any[]) => Promise<{
    data: VpnServerItem[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }>
>(async () => ({
  data: [],
  pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
}))
const mockListVpnRegions = mock<
  (..._args: any[]) => Promise<{
    data: VpnRegionItem[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }>
>(async () => ({
  data: [],
  pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
}))
const mockListVpnSshKeys = mock<
  (..._args: any[]) => Promise<{
    data: VpnSshKeyItem[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }>
>(async () => ({
  data: [],
  pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
}))
const mockDeleteVpnServer = mock<
  (..._args: any[]) => Promise<{ data: { id: string } }>
>(async () => ({ data: { id: "srv-1" } }))
const mockTestVpnServer = mock<
  (..._args: any[]) => Promise<{ data: ScanResult }>
>(async () => ({ data: makeScanResult() }))

mock.module("./vpn-admin-client", () => ({
  listVpnServers: mockListVpnServers,
  listVpnRegions: mockListVpnRegions,
  listVpnSshKeys: mockListVpnSshKeys,
  deleteVpnServer: mockDeleteVpnServer,
  testVpnServer: mockTestVpnServer,
}))

mock.module("./server-form", () => ({
  ServerForm: () => <div data-testid="server-form" />,
}))

mock.module("./connection-test-modal", () => ({
  ConnectionTestModal: () => <div data-testid="connection-test-modal" />,
}))

// ── Import component under test ────────────────────────────────────────────────

const { ServersTable } = await import("./servers-table")

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeServerSuccess = (data: VpnServerItem[]) => ({
  data,
  pagination: { page: 1, limit: 25, total: data.length, totalPages: 1 },
})

const makeRegionSuccess = (data: VpnRegionItem[]) => ({
  data,
  pagination: { page: 1, limit: 25, total: data.length, totalPages: 1 },
})

const makeSshKeySuccess = (data: VpnSshKeyItem[]) => ({
  data,
  pagination: { page: 1, limit: 25, total: data.length, totalPages: 1 },
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ServersTable", () => {
  it("renders server name, region, hostname, protocols, health, and active badge", async () => {
    mockListVpnServers.mockResolvedValue(makeServerSuccess([makeServer()]))
    mockListVpnRegions.mockResolvedValue(makeRegionSuccess([makeRegion()]))
    mockListVpnSshKeys.mockResolvedValue(makeSshKeySuccess([makeSshKey()]))

    const view = render(<ServersTable />)

    await waitFor(() => expect(view.getByText("SG-Primary")).toBeTruthy())
    expect(view.getByText("SG — Singapore")).toBeTruthy()
    expect(view.getByText("sg-primary.example.com")).toBeTruthy()
    expect(view.getByText("10.0.0.1")).toBeTruthy()

    // Protocols: OVPN enabled on 1194, WG enabled on 51820, proxy disabled
    expect(view.getByText(/1194/)).toBeTruthy()
    expect(view.getByText(/51820/)).toBeTruthy()
    expect(view.getByText("❌")).toBeTruthy() // proxy disabled

    // Health — the health column cell has title="HEALTHY"
    const healthCell = view.container.querySelector('[title="HEALTHY"]')
    expect(healthCell?.textContent).toBe("✅")

    // Active badge — Badge uses text-xs; "Add Server" button uses text-sm, so this is unique
    const badge = view.container.querySelector(
      '[class*="text-xs"][class*="bg-primary"]'
    )
    expect(badge?.textContent).toBe("Active")
  })

  it("renders View, Test, Duplicate, Edit, and Delete action buttons", async () => {
    mockListVpnServers.mockResolvedValue(makeServerSuccess([makeServer()]))
    mockListVpnRegions.mockResolvedValue(makeRegionSuccess([makeRegion()]))
    mockListVpnSshKeys.mockResolvedValue(makeSshKeySuccess([makeSshKey()]))

    const view = render(<ServersTable />)

    await waitFor(() => expect(view.getByText("SG-Primary")).toBeTruthy())

    const buttons = view.getAllByRole("button")
    const labels = buttons.map((b) => b.getAttribute("aria-label") ?? "")

    // View button uses asChild so aria-label is on the child <a> — scan all [aria-label]
    const allAriaLabels = Array.from(
      view.container.querySelectorAll("[aria-label]")
    ).map((el) => el.getAttribute("aria-label") ?? "")

    expect(allAriaLabels).toContainEqual(
      expect.stringContaining("View details")
    )
    expect(labels).toContainEqual(expect.stringContaining("Test connection"))
    expect(labels).toContainEqual(expect.stringContaining("Duplicate"))
    expect(labels).toContainEqual(expect.stringContaining("Edit"))
    expect(labels).toContainEqual(expect.stringContaining("Delete"))
  })

  it("does not render Duplicate button when server is inactive", async () => {
    mockListVpnServers.mockResolvedValue(
      makeServerSuccess([makeServer({ isActive: false })])
    )
    mockListVpnRegions.mockResolvedValue(makeRegionSuccess([makeRegion()]))
    mockListVpnSshKeys.mockResolvedValue(makeSshKeySuccess([makeSshKey()]))

    const view = render(<ServersTable />)

    await waitFor(() => expect(view.getByText("Inactive")).toBeTruthy())

    const buttons = view.getAllByRole("button")
    const labels = buttons.map((b) => b.getAttribute("aria-label") ?? "")
    expect(labels.some((l) => l.includes("Duplicate"))).toBe(false)
  })

  it("truncates the hostname cell with the truncate className", async () => {
    mockListVpnServers.mockResolvedValue(
      makeServerSuccess([
        makeServer({ hostname: "a-very-long-hostname.example.com" }),
      ])
    )
    mockListVpnRegions.mockResolvedValue(makeRegionSuccess([makeRegion()]))
    mockListVpnSshKeys.mockResolvedValue(makeSshKeySuccess([makeSshKey()]))

    const view = render(<ServersTable />)

    await waitFor(() =>
      expect(view.getByText("a-very-long-hostname.example.com")).toBeTruthy()
    )

    // The hostname TableCell has className containing "truncate"
    const hostCell = view
      .getByText("a-very-long-hostname.example.com")
      .closest('[class*="truncate"]')
    expect(hostCell).toBeTruthy()
  })

  it("wraps the table in an overflow-x-auto ancestor for horizontal scroll", async () => {
    mockListVpnServers.mockResolvedValue(makeServerSuccess([makeServer()]))
    mockListVpnRegions.mockResolvedValue(makeRegionSuccess([makeRegion()]))
    mockListVpnSshKeys.mockResolvedValue(makeSshKeySuccess([makeSshKey()]))

    const view = render(<ServersTable />)

    await waitFor(() => expect(view.getByText("SG-Primary")).toBeTruthy())

    // The table is wrapped in a div with overflow-x-auto
    const scrollContainer = view.container.querySelector(
      '[class*="overflow-x-auto"]'
    )
    expect(scrollContainer).toBeTruthy()
    // The <table> element must be inside the scroll container
    const table = scrollContainer?.querySelector("table")
    expect(table).toBeTruthy()
  })

  it("calls deleteVpnServer when the Delete button is confirmed", async () => {
    mockListVpnServers.mockResolvedValue(makeServerSuccess([makeServer()]))
    mockListVpnRegions.mockResolvedValue(makeRegionSuccess([makeRegion()]))
    mockListVpnSshKeys.mockResolvedValue(makeSshKeySuccess([makeSshKey()]))

    // Stub window.confirm to return true
    const confirmSpy = mock(() => true) as unknown as typeof window.confirm
    const originalConfirm = window.confirm
    ;(window as any).confirm = confirmSpy

    const view = render(<ServersTable />)
    await waitFor(() => expect(view.getByText("SG-Primary")).toBeTruthy())

    const deleteBtn = view
      .getAllByRole("button")
      .find((b) => b.getAttribute("aria-label")?.includes("Delete"))
    fireEvent.click(deleteBtn!)

    await waitFor(() => expect(mockDeleteVpnServer).toHaveBeenCalledTimes(1))
    expect(mockDeleteVpnServer).toHaveBeenCalledWith("srv-1")

    // Restore
    ;(window as any).confirm = originalConfirm
  })
})
