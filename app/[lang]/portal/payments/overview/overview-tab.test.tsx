import { describe, expect, it, beforeEach } from "bun:test"
import { render, act } from "@testing-library/react"

import { OverviewTab } from "./overview-tab"

// ── Mock fetch ────────────────────────────────────────

type FetchMock = typeof globalThis.fetch

function mockPaymentFetch(overrides?: {
  gateways?: object
  bankAccounts?: object
  confirmations?: object
}): FetchMock {
  return Object.assign(
    async (_url: string | URL | Request) => {
      const urlStr = String(_url)

      if (urlStr.includes("/gateways")) {
        return new Response(
          JSON.stringify(
            overrides?.gateways ?? {
              ok: true,
              data: [
                { id: "gw-1", isActive: true },
                { id: "gw-2", isActive: true },
                { id: "gw-3", isActive: false },
              ],
            }
          ),
          { status: 200 }
        )
      }

      if (urlStr.includes("/bank-accounts")) {
        return new Response(
          JSON.stringify(
            overrides?.bankAccounts ?? {
              ok: true,
              data: [
                { id: "ba-1", isVerified: true },
                { id: "ba-2", isVerified: true },
                { id: "ba-3", isVerified: false },
              ],
            }
          ),
          { status: 200 }
        )
      }

      if (urlStr.includes("/confirmations")) {
        return new Response(
          JSON.stringify(
            overrides?.confirmations ?? {
              ok: true,
              data: [
                { id: "conf-1" },
                { id: "conf-2" },
                { id: "conf-3" },
              ],
            }
          ),
          { status: 200 }
        )
      }

      return new Response(JSON.stringify({ ok: false }), { status: 500 })
    },
    { preconnect: () => {} }
  ) as FetchMock
}

describe("OverviewTab", () => {
  beforeEach(() => {
    globalThis.fetch = mockPaymentFetch() as FetchMock
  })

  describe("stat cards render correct counts from .data property", () => {
    it("renders totalGateways count from .data array (3 items)", async () => {
      let view: ReturnType<typeof render>

      // Render inside act() so React state updates are flushed synchronously
      await act(async () => {
        view = render(<OverviewTab />)
      })

      // All assertions use view-bound queries (container-scoped), not screen
      expect(view!.getByText("Payment Gateways")).toBeInTheDocument()

      // The bold number in the gateway card should be 3
      const gatewayCard = view!
        .getByText("Payment Gateways")
        .closest(".group\\/card")
      expect(gatewayCard).not.toBeNull()
      const boldNumbers =
        gatewayCard!.querySelectorAll(".text-2xl.font-bold")
      expect(boldNumbers.length).toBe(1)
      expect(boldNumbers[0].textContent).toBe("3")
    })

    it("filters active gateways (status=active) correctly", async () => {
      let view: ReturnType<typeof render>

      await act(async () => {
        view = render(<OverviewTab />)
      })

      expect(view!.getByText("Payment Gateways")).toBeInTheDocument()
      // Should show "2 active" because 2 of 3 gateways have status=active
      expect(view!.getByText("2 active")).toBeInTheDocument()
    })

    it("renders totalBankAccounts count from .data array (3 items)", async () => {
      let view: ReturnType<typeof render>

      await act(async () => {
        view = render(<OverviewTab />)
      })

      expect(view!.getByText("Bank Accounts")).toBeInTheDocument()

      const bankCard = view!
        .getByText("Bank Accounts")
        .closest(".group\\/card")
      const boldNumbers = bankCard!.querySelectorAll(".text-2xl.font-bold")
      expect(boldNumbers.length).toBe(1)
      expect(boldNumbers[0].textContent).toBe("3")
    })

    it("filters verified bank accounts (isVerified=true) correctly", async () => {
      let view: ReturnType<typeof render>

      await act(async () => {
        view = render(<OverviewTab />)
      })

      expect(view!.getByText("Bank Accounts")).toBeInTheDocument()
      // Should show "2 verified" because 2 of 3 accounts are verified
      expect(view!.getByText("2 verified")).toBeInTheDocument()
    })

    it("renders pendingConfirmations count from .data array (3 items)", async () => {
      let view: ReturnType<typeof render>

      await act(async () => {
        view = render(<OverviewTab />)
      })

      // Two elements match: stat card title + list card title
      const confirmElements =
        view!.getAllByText("Pending Confirmations")
      expect(confirmElements.length).toBeGreaterThanOrEqual(1)

      // The stat card title uses text-sm class (the list card uses text-base)
      const statTitle = confirmElements.find(
        (el) => el.classList.contains("text-sm")
      )
      expect(statTitle).toBeDefined()
      const confirmCard = statTitle!.closest(".group\\/card")
      const boldNumbers =
        confirmCard!.querySelectorAll(".text-2xl.font-bold")
      expect(boldNumbers.length).toBe(1)
      expect(boldNumbers[0].textContent).toBe("3")
    })

    it("shows awaiting review subtitle for confirmations card", async () => {
      let view: ReturnType<typeof render>

      await act(async () => {
        view = render(<OverviewTab />)
      })

      // Two elements match: stat card title + list card title
      expect(
        view!.getAllByText("Pending Confirmations").length
      ).toBeGreaterThanOrEqual(1)
      expect(view!.getByText("Awaiting review")).toBeInTheDocument()
    })
  })

  describe("edge cases — all zero counts", () => {
    it("renders 0 when endpoints return empty data", async () => {
      globalThis.fetch = mockPaymentFetch({
        gateways: { ok: true, data: [] },
        bankAccounts: { ok: true, data: [] },
        confirmations: { ok: true, data: [] },
      }) as FetchMock

      let view: ReturnType<typeof render>

      await act(async () => {
        view = render(<OverviewTab />)
      })

      expect(view!.getByText("Payment Gateways")).toBeInTheDocument()
      // All three cards should show 0
      const zeros = view!.getAllByText("0")
      expect(zeros.length).toBeGreaterThanOrEqual(3)
    })

    it("renders 0 when fetch returns ok=false", async () => {
      globalThis.fetch = mockPaymentFetch({
        gateways: { ok: false },
        bankAccounts: { ok: false },
        confirmations: { ok: false },
      }) as FetchMock

      let view: ReturnType<typeof render>

      await act(async () => {
        view = render(<OverviewTab />)
      })

      expect(view!.getByText("Payment Gateways")).toBeInTheDocument()
      const zeros = view!.getAllByText("0")
      expect(zeros.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe("filtered counts work correctly", () => {
    it("active gateway count excludes inactive/suspended gateways", async () => {
      globalThis.fetch = mockPaymentFetch({
        gateways: {
          ok: true,
          data: [
            { id: "gw-1", isActive: true },
            { id: "gw-2", isActive: false },
            { id: "gw-3", isActive: false },
            { id: "gw-4", isActive: false },
          ],
        },
        bankAccounts: { ok: true, data: [] },
        confirmations: { ok: true, data: [] },
      }) as FetchMock

      let view: ReturnType<typeof render>

      await act(async () => {
        view = render(<OverviewTab />)
      })

      expect(view!.getByText("Payment Gateways")).toBeInTheDocument()
      // Only 1 active gateway out of 4
      expect(view!.getByText("1 active")).toBeInTheDocument()
    })

    it("verified bank account count excludes unverified accounts", async () => {
      globalThis.fetch = mockPaymentFetch({
        gateways: { ok: true, data: [] },
        bankAccounts: {
          ok: true,
          data: [
            { id: "ba-1", isVerified: true },
            { id: "ba-2", isVerified: false },
            { id: "ba-3", isVerified: true },
            { id: "ba-4", isVerified: false },
          ],
        },
        confirmations: { ok: true, data: [] },
      }) as FetchMock

      let view: ReturnType<typeof render>

      await act(async () => {
        view = render(<OverviewTab />)
      })

      expect(view!.getByText("Bank Accounts")).toBeInTheDocument()
      // 2 verified accounts out of 4
      expect(view!.getByText("2 verified")).toBeInTheDocument()
    })
  })
})
