import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

const mockGetAccount = mock(async () => ({
  ok: true,
  tenantId: "tenant-1",
  currency: "IDR",
  balanceIdr: "500000",
  formattedBalance: "Rp 500.000",
  isAboveWarn: true,
  isPositive: true,
  accountAge: "1 month",
}))

mock.module("@/lib/billing-client", () => ({
  getAccount: mockGetAccount,
  getInvoice: mock(async () => ({ ok: true })),
  formatBillingMoney: (amt: number | string, curr: string) => `${curr} ${amt}`,
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      payments: {
        topup: {
          methods: {
            get: mock(async () => ({
              data: { ok: true, config: { presets: [50000] } },
            })),
          },
          post: mock(async () => ({ data: { ok: true } })),
        },
      },
    },
  },
}))

import { CompactBalanceBadge } from "./compact-balance-badge"

describe("CompactBalanceBadge", () => {
  beforeEach(() => {
    mockGetAccount.mockClear()
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders formatted balance and toggles masking with eye button", async () => {
    const view = render(<CompactBalanceBadge />)

    await waitFor(() => {
      expect(view.getByText("Rp 500.000")).toBeDefined()
    })

    const hideButton = view.getByRole("button", { name: "Hide balance" })
    fireEvent.click(hideButton)

    expect(view.getByText("IDR ••••••")).toBeDefined()
    expect(localStorage.getItem("billing_balance_masked")).toBe("true")

    const showButton = view.getByRole("button", { name: "Show balance" })
    fireEvent.click(showButton)

    expect(view.getByText("Rp 500.000")).toBeDefined()
  })

  it("opens quick topup dialog when clicking balance or lightning CTA", async () => {
    const view = render(<CompactBalanceBadge />)

    await waitFor(() => {
      expect(view.getByText("Rp 500.000")).toBeDefined()
    })

    const topupBtn = view.getByRole("button", { name: "Quick Top-Up button" })
    fireEvent.click(topupBtn)

    expect(view.getByText("Express Top Up")).toBeDefined()
  })
})
