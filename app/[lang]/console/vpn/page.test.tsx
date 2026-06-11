import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mockGetVpnStatus = mock()
const mockActivateVpnSubscription = mock()

mock.module("@/lib/vpn-client", () => ({
  getVpnStatus: mockGetVpnStatus,
  activateVpnSubscription: mockActivateVpnSubscription,
}))

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en" }),
  useRouter: () => ({ push: mock() }),
}))

import ConsoleVpnPage from "./page"

beforeEach(() => {
  mockGetVpnStatus.mockReset()
  mockActivateVpnSubscription.mockReset()
})

describe("ConsoleVpnPage", () => {
  it("shows activate state when no VPN clients exist", async () => {
    mockGetVpnStatus.mockResolvedValue({ ok: true, clients: [] })

    const view = render(<ConsoleVpnPage />)

    await waitFor(() => {
      expect(view.getByText("VPN Indonesia")).toBeInTheDocument()
    })
    expect(view.getByText("Activate VPN")).toBeInTheDocument()
    expect(view.getByText(/Rp25\.000/)).toBeInTheDocument()
  })

  it("shows active state with download button when clients exist", async () => {
    mockGetVpnStatus.mockResolvedValue({
      ok: true,
      clients: [
        {
          id: "vpn_1",
          clientName: "org_org1_sub1",
          status: "ACTIVE",
          regionCode: "INDONESIA",
          currentPeriodStart: "2026-06-01T00:00:00.000Z",
          currentPeriodEnd: "2026-07-01T00:00:00.000Z",
        },
      ],
    })

    const view = render(<ConsoleVpnPage />)

    await waitFor(() => {
      expect(view.getByText("VPN Status")).toBeInTheDocument()
    })
    expect(view.getByText("Active")).toBeInTheDocument()
    expect(view.getByText("Download .ovpn")).toBeInTheDocument()
    expect(view.queryByText("Activate VPN")).not.toBeInTheDocument()
  })

  it("shows insufficient balance error with top-up link", async () => {
    mockGetVpnStatus.mockResolvedValue({ ok: true, clients: [] })
    mockActivateVpnSubscription.mockRejectedValue(
      Object.assign(new Error("Insufficient balance"), {
        error: "INSUFFICIENT_BALANCE",
        topupUrl: "/console/billing/topup",
      }),
    )
    const user = userEvent.setup()

    const view = render(<ConsoleVpnPage />)

    await waitFor(() => {
      expect(view.getByText("Activate VPN")).toBeInTheDocument()
    })
    await user.click(view.getByText("Activate VPN"))

    await waitFor(() => {
      expect(view.getByText("Insufficient balance")).toBeInTheDocument()
    })
    expect(view.getByText("Top up balance")).toBeInTheDocument()
  })
})
