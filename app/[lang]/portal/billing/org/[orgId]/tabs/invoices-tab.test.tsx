import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, waitFor } from "@testing-library/react"

const mockGetAdminInvoices = mock<
  (params?: {
    organizationId?: string
    page?: number
    limit?: number
  }) => Promise<{
    ok: true
    invoices: Array<{
      id: string
      invoiceNumber: string
      organizationId: string
      status: string
      totalAmountIdr: string
      currency: string
      issuedAt: string | null
      dueAt: string | null
      createdAt: string
    }>
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }>
>(async () => {
  throw new Error("not configured")
})

mock.module("@/lib/billing-client", () => ({
  getAdminInvoices: mockGetAdminInvoices,
}))

mock.module("next/navigation", () => ({
  useRouter: () => ({ replace: mock(), push: mock(), refresh: mock() }),
  useSearchParams: () => ({ toString: () => "" }),
  useParams: () => ({ lang: "en" }),
}))

const { InvoicesTab } = await import("./invoices-tab")

describe("InvoicesTab currency formatting", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  it("renders per-invoice USD formatted amount and no Rp prefix for USD invoices", async () => {
    mockGetAdminInvoices.mockResolvedValueOnce({
      ok: true,
      invoices: [
        {
          id: "inv-1",
          invoiceNumber: "INV-001",
          organizationId: "org_usd",
          status: "ISSUED",
          totalAmountIdr: "42.75",
          currency: "USD",
          issuedAt: "2024-01-01T00:00:00.000Z",
          dueAt: "2024-01-15T00:00:00.000Z",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    })

    const view = render(<InvoicesTab orgId="org_usd" />)

    await waitFor(() => expect(view.getByText("INV-001")).toBeTruthy())
    expect(view.getByText("USD 42.75")).toBeTruthy()
    expect(view.container.innerHTML).not.toContain("Rp 42")
  })

  it("renders seeded invoices with currency and skips the fetch", () => {
    const view = render(
      <InvoicesTab
        orgId="org_usd"
        recentInvoices={[
          {
            id: "inv-seed",
            invoiceNumber: "INV-SEED",
            status: "ISSUED",
            totalAmountIdr: "12.34",
            currency: "USD",
            createdAt: "2024-01-01T00:00:00.000Z",
          },
        ]}
      />
    )

    expect(view.getByText("INV-SEED")).toBeTruthy()
    expect(view.getByText("USD 12.34")).toBeTruthy()
    expect(mockGetAdminInvoices).not.toHaveBeenCalled()
    expect(view.container.innerHTML).not.toContain("undefined")
  })
})
