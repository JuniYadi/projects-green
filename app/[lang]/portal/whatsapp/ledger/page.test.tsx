import "@/test/register"
import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, fireEvent, waitFor } from "@testing-library/react"

const mockLedgerList = mock(() =>
  Promise.resolve({
    ok: true,
    data: [
      {
        id: "led_1",
        organizationId: "org_1",
        waMessageId: "wamid.HBgM123",
        phoneNumber: "6281234567890",
        category: "UTILITY",
        quotaKey: "unit",
        quotaValue: 1,
        status: "CONFIRMED",
        isReverted: false,
        revertReason: null,
        revertedAt: null,
        lastStatus: "DELIVERED",
        whatsappDeviceId: "dev_1",
        createdAt: "2026-06-15T10:00:00.000Z",
        updatedAt: "2026-06-15T10:00:00.000Z",
        devicePhoneNumber: "+628111111111",
      },
      {
        id: "led_2",
        organizationId: "org_2",
        waMessageId: "wamid.HBgM456",
        phoneNumber: "6289876543210",
        category: "MARKETING",
        quotaKey: "unit",
        quotaValue: 1,
        status: "REFUNDED",
        isReverted: true,
        revertReason: "FAILED_DELIVERY",
        revertedAt: "2026-06-15T11:00:00.000Z",
        lastStatus: "FAILED",
        whatsappDeviceId: "dev_2",
        createdAt: "2026-06-15T10:30:00.000Z",
        updatedAt: "2026-06-15T11:00:00.000Z",
        devicePhoneNumber: "+628222222222",
      },
    ],
    total: 2,
    page: 1,
    limit: 20,
    totalPages: 1,
    summary: {
      totalCredits: 2,
      totalRefundedCredits: 1,
      activeCredits: 1,
    },
  })
)

mock.module("@/lib/api/whatsapp-client", () => ({
  whatsappClient: {
    usage: {
      ledger: mockLedgerList,
    },
  },
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      admin: {
        organizations: {
          get: mock(() =>
            Promise.resolve({
              data: {
                ok: true,
                organizations: [
                  { id: "org_1", name: "Acme Corp" },
                  { id: "org_2", name: "Beta LLC" },
                ],
              },
            })
          ),
        },
        devices: {
          get: mock(() =>
            Promise.resolve({
              data: {
                ok: true,
                devices: [
                  {
                    id: "dev_1",
                    phoneNumber: "+628111111111",
                    organizationId: "org_1",
                  },
                  {
                    id: "dev_2",
                    phoneNumber: "+628222222222",
                    organizationId: "org_2",
                  },
                ],
              },
            })
          ),
        },
      },
    },
  },
}))

import PortalWhatsAppLedgerPage from "./page"

describe("PortalWhatsAppLedgerPage", () => {
  beforeEach(() => {
    mockLedgerList.mockClear()
  })

  it("renders page header, summary KPI cards, and ledger rows", async () => {
    const view = render(<PortalWhatsAppLedgerPage />)

    expect(view.getByText("WhatsApp Billing & Quota Ledger")).toBeTruthy()
    expect(view.getByText("Total Deducted Units")).toBeTruthy()
    expect(view.getByText("Active Charges")).toBeTruthy()

    await waitFor(() => {
      expect(view.getByText("6281234567890")).toBeTruthy()
      expect(view.getByText("6289876543210")).toBeTruthy()
    })

    expect(view.getAllByText("Confirmed").length).toBeGreaterThanOrEqual(1)
    expect(view.getAllByText("Refunded").length).toBeGreaterThanOrEqual(1)
    expect(view.getAllByText("Acme Corp").length).toBeGreaterThanOrEqual(1)
  })

  it("filters ledger entries when organization filter is changed", async () => {
    const view = render(<PortalWhatsAppLedgerPage />)

    await waitFor(() => {
      expect(view.getAllByText("Acme Corp").length).toBeGreaterThanOrEqual(1)
    })

    const orgSelect = view.getByLabelText("Filter by organization")
    fireEvent.change(orgSelect, { target: { value: "org_1" } })

    await waitFor(() => {
      expect(mockLedgerList).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: "org_1" })
      )
    })
  })
})
