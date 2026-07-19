import { describe, expect, it, beforeEach, mock } from "bun:test"
import { render, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { MobileDeviceEntry } from "@/lib/vpn-mobile-client"
import { VpnDevicesList } from "./vpn-devices-list"

function makeDevice(
  overrides: Partial<MobileDeviceEntry> = {}
): MobileDeviceEntry {
  return {
    id: "dev-1",
    deviceName: "Test iPhone",
    platform: "ios",
    osVersion: "18.2.1",
    subscriptionId: "sub-1",
    subscriptionName: null,
    subscriptionStatus: null,
    status: "ACTIVE",
    pairedVia: "SSO",
    lastSeenAt: "2026-06-16T12:00:00.000Z",
    pairedAt: "2026-06-14T00:00:00.000Z",
    revokedAt: null,
    revokedReason: null,
    ...overrides,
  }
}

const onRevoke = mock(() => {})

beforeEach(() => {
  onRevoke.mockClear()
  localStorage.clear()
})

describe("VpnDevicesList", () => {
  it("renders status badges with the correct variants", () => {
    const devices = [
      makeDevice({ id: "d1", status: "ACTIVE" }),
      makeDevice({ id: "d2", status: "SUSPENDED" }),
      makeDevice({ id: "d3", status: "REVOKED" }),
    ]
    const view = render(
      <VpnDevicesList
        devices={devices}
        onRevoke={onRevoke}
        revoking={null}
        defaultStatusFilter="all"
      />
    )

    expect(within(view.container).getByText("ACTIVE")).toHaveClass("bg-primary")
    expect(within(view.container).getByText("SUSPENDED")).toHaveClass(
      "bg-secondary"
    )
    expect(within(view.container).getByText("REVOKED")).toHaveClass(
      "bg-destructive"
    )
  })

  it("shows Revoke for ACTIVE and SUSPENDED rows and hides it for REVOKED rows", () => {
    const devices = [
      makeDevice({ id: "d1", status: "ACTIVE", deviceName: "Active Phone" }),
      makeDevice({
        id: "d2",
        status: "SUSPENDED",
        deviceName: "Suspended Phone",
      }),
      makeDevice({ id: "d3", status: "REVOKED", deviceName: "Revoked Phone" }),
    ]
    const view = render(
      <VpnDevicesList
        devices={devices}
        onRevoke={onRevoke}
        revoking={null}
        defaultStatusFilter="all"
      />
    )

    expect(
      within(view.container).getAllByRole("button", { name: "Revoke" }).length
    ).toBe(2)
    expect(
      within(view.container).queryByRole("button", { name: /Revoked Phone/ })
    ).toBeNull()
  })

  it("filters rows by the global search input", async () => {
    const devices = [
      makeDevice({ id: "d1", deviceName: "iPhone 15" }),
      makeDevice({
        id: "d2",
        deviceName: "Pixel 8",
        platform: "android",
      }),
    ]
    const view = render(
      <VpnDevicesList devices={devices} onRevoke={onRevoke} revoking={null} />
    )

    const input = within(view.container).getByPlaceholderText(
      "Search devices..."
    )
    await userEvent.type(input, "iPhone")

    await waitFor(() => {
      const rows = within(view.container).getAllByRole("row")
      // header row + one data row
      expect(rows.length).toBe(2)
      expect(within(view.container).getByText("iPhone 15")).toBeTruthy()
      expect(within(view.container).queryByText("Pixel 8")).toBeNull()
    })
  })

  it("filters rows by the status facet filter", async () => {
    const devices = [
      makeDevice({ id: "d1", status: "ACTIVE", deviceName: "Active Phone" }),
      makeDevice({
        id: "d2",
        status: "SUSPENDED",
        deviceName: "Suspended Phone",
      }),
      makeDevice({ id: "d3", status: "REVOKED", deviceName: "Revoked Phone" }),
    ]
    const view = render(
      <VpnDevicesList
        devices={devices}
        onRevoke={onRevoke}
        revoking={null}
        defaultStatusFilter="all"
      />
    )

    const statusSelect = within(view.container).getByRole("combobox")
    await userEvent.click(statusSelect)
    await userEvent.click(view.getByRole("option", { name: "Active" }))

    await waitFor(() => {
      const rows = within(view.container).getAllByRole("row")
      expect(rows.length).toBe(2)
      expect(within(view.container).getByText("Active Phone")).toBeTruthy()
      expect(within(view.container).queryByText("Suspended Phone")).toBeNull()
      expect(within(view.container).queryByText("Revoked Phone")).toBeNull()
    })

    await userEvent.click(statusSelect)
    await userEvent.click(view.getByRole("option", { name: "Revoked" }))

    await waitFor(() => {
      const rows = within(view.container).getAllByRole("row")
      expect(rows.length).toBe(2)
      expect(within(view.container).getByText("Revoked Phone")).toBeTruthy()
      expect(within(view.container).queryByText("Active Phone")).toBeNull()
      expect(within(view.container).queryByText("Suspended Phone")).toBeNull()
    })
  })
})
