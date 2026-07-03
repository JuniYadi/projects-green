/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock, afterEach } from "bun:test"
import { render, fireEvent, waitFor, act, cleanup } from "@testing-library/react"
import type {
  PairingGenerateResponse,
  PairingStatusResponse,
} from "@/lib/vpn-mobile-client"

// ── Mock factories ─────────────────────────────────────────────────────────────

function makeSubscription(id: string, packageName: string) {
  return { id, packageName }
}

// ── Module-level mocks (hoisted by Bun) ─────────────────────────────────────

const mockGeneratePairingToken = mock<
  (subscriptionId: string) => Promise<PairingGenerateResponse>
>(
  async () =>
    ({
      pairingToken: "token-abc123",
      expiresAt: "2099-12-31T23:59:59.000Z",
      qrPayload: "test-payload",
    }) as PairingGenerateResponse,
)

const mockGetPairingStatus = mock<
  (token: string) => Promise<PairingStatusResponse>
>(
  async () =>
    ({
      status: "valid",
    }) as PairingStatusResponse,
)

const mockQrToDataURL = mock<(text: string, opts?: object) => Promise<string>>(
  async () =>
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
)

// ── Global interval swap ─────────────────────────────────────────────────────
// Replace the runtime's setInterval/clearInterval globals before the component
// is imported, so the component captures our mocks instead of the real functions.
const intervalRegistry: Array<{ fn: () => void; ms: number }> = []

const mockSetInterval = mock<(handler: any, ms?: number) => number>((fn, ms) => {
  intervalRegistry.push({ fn: fn as () => void, ms: ms ?? 1000 })
  return intervalRegistry.length
})

const mockClearInterval = mock<(id: number) => void>(() => {})
;(globalThis.setInterval as any) = mockSetInterval
;(globalThis.clearInterval as any) = mockClearInterval

mock.module("@/lib/vpn-mobile-client", () => ({
  generatePairingToken: mockGeneratePairingToken,
  getPairingStatus: mockGetPairingStatus,
}))

mock.module("qrcode", () => ({
  default: { toDataURL: mockQrToDataURL },
}))

mock.module("node:timers", () => ({
  setInterval: mockSetInterval,
  clearInterval: mockClearInterval,
  setTimeout: () => 0,
  clearTimeout: () => {},
}))

// ── Import component under test ───────────────────────────────────────────────

const { VpnPairingQrModal } = await import("./vpn-pairing-qr-modal")

// ── Helpers ──────────────────────────────────────────────────────────────────

const defaultProps = {
  open: false as boolean,
  onOpenChange: (_open: boolean) => {},
  subscriptionId: "sub-1",
  subscriptionName: "VPN Basic",
}

afterEach(() => {
  cleanup()
  intervalRegistry.length = 0
})

// Advance all registered interval callbacks of the given delay by `ticks` ticks.
// The outer `await act(async () => { fn() })` is required so React flushes any
// state updates scheduled by the interval callback (e.g. async getPairingStatus).
function tickIntervals(ms: number, ticks: number): Promise<void> {
  const intervals = intervalRegistry.filter((r) => r.ms === ms)
  return act(async () => {
    for (const { fn } of intervals) {
      for (let i = 0; i < ticks; i++) {
        await fn()
      }
    }
  }) as Promise<void>
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("VpnPairingQrModal", () => {
  describe("modal open/close", () => {
    it("does not render dialog content when open is false", () => {
      render(<VpnPairingQrModal {...defaultProps} open={false} />)
      expect(document.querySelector('[role="dialog"]')).toBeNull()
    })

    it("renders dialog heading when open is true", async () => {
      render(<VpnPairingQrModal {...defaultProps} open={true} />)
      await waitFor(() => {
        expect(document.querySelector('[role="dialog"]')).not.toBeNull()
        expect(document.body.textContent).toContain("Pair a mobile device")
      })
    })
  })

  describe("phase transitions — single subscription", () => {
    it("generates token and shows QR code on open", async () => {
      render(<VpnPairingQrModal {...defaultProps} open={true} />)

      await waitFor(() => {
        const img = document.querySelector('img[alt*="Scan with mobile app"]')
        expect(img).not.toBeNull()
        expect(img).toHaveAttribute("src")
      })

      expect(mockGeneratePairingToken).toHaveBeenCalledWith("sub-1")
    })

    it("shows error when generatePairingToken throws an Error", async () => {
      mockGeneratePairingToken.mockImplementation(async () => {
        throw new Error("Token generation failed")
      })

      render(<VpnPairingQrModal {...defaultProps} open={true} />)

      await waitFor(() => {
        expect(document.body.textContent).toContain("Token generation failed")
      })

      mockGeneratePairingToken.mockImplementation(
        async () =>
          ({
            pairingToken: "token-abc123",
            expiresAt: "2099-12-31T23:59:59.000Z",
            qrPayload: "test-payload",
          }) as PairingGenerateResponse,
      )
    })

    it("shows fallback error message for non-Error rejections", async () => {
      mockGeneratePairingToken.mockImplementation(async () => {
        throw "string rejection"
      })

      render(<VpnPairingQrModal {...defaultProps} open={true} />)

      await waitFor(() => {
        expect(document.body.textContent).toContain(
          "Failed to generate pairing code",
        )
      })

      mockGeneratePairingToken.mockImplementation(
        async () =>
          ({
            pairingToken: "token-abc123",
            expiresAt: "2099-12-31T23:59:59.000Z",
            qrPayload: "test-payload",
          }) as PairingGenerateResponse,
      )
    })
  })

  describe("multi-subscription selection", () => {
    const multiSubProps = {
      ...defaultProps,
      open: true as boolean,
      subscriptionId: "sub-default",
      availableSubscriptions: [
        makeSubscription("sub-1", "VPN Basic"),
        makeSubscription("sub-2", "VPN Pro"),
        makeSubscription("sub-3", "VPN Enterprise"),
      ],
    }

    it("shows selecting phase and disabled Continue when opened with multiple subscriptions", async () => {
      render(<VpnPairingQrModal {...multiSubProps} />)

      await waitFor(() => {
        expect(document.body.textContent).toContain(
          "Select the subscription you want to pair a device to",
        )
      })

      const continueBtn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent === "Continue",
      )
      expect(continueBtn).not.toBeUndefined()
      expect(continueBtn).toBeDisabled()
    })

    it("enables Continue after selecting a subscription", async () => {
      render(<VpnPairingQrModal {...multiSubProps} />)

      await waitFor(() => {
        expect(document.body.textContent).toContain(
          "Select the subscription you want to pair a device to",
        )
      })

      const trigger = document.querySelector("[role='combobox']")
      expect(trigger).not.toBeNull()
      fireEvent.click(trigger!)

      await waitFor(() => {
        expect(document.querySelector("[role='listbox']")).not.toBeNull()
      })

      const proItem = Array.from(
        document.querySelectorAll("[role='option']"),
      ).find((opt) => opt.textContent === "VPN Pro")
      expect(proItem).not.toBeNull()
      fireEvent.click(proItem!)

      await waitFor(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          (b) => b.textContent === "Continue",
        )
        expect(btn).not.toBeDisabled()
      })
    })

    it("calls generatePairingToken with selected subscription on Continue", async () => {
      render(<VpnPairingQrModal {...multiSubProps} />)

      await waitFor(() => {
        expect(document.body.textContent).toContain(
          "Select the subscription you want to pair a device to",
        )
      })

      const trigger = document.querySelector("[role='combobox']")!
      fireEvent.click(trigger)

      await waitFor(() => {
        expect(document.querySelector("[role='listbox']")).not.toBeNull()
      })

      const entItem = Array.from(
        document.querySelectorAll("[role='option']"),
      ).find((opt) => opt.textContent === "VPN Enterprise")
      expect(entItem).not.toBeNull()
      fireEvent.click(entItem!)

      await waitFor(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          (b) => b.textContent === "Continue",
        )
        expect(btn).not.toBeDisabled()
      })

      const continueBtn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent === "Continue",
      )!
      fireEvent.click(continueBtn)

      await waitFor(() => {
        expect(mockGeneratePairingToken).toHaveBeenCalledWith("sub-3")
      })
    })
  })

  describe("countdown timer", () => {
    it("renders initial countdown formatted as 5:00", async () => {
      render(<VpnPairingQrModal {...defaultProps} open={true} />)

      await waitFor(() => {
        expect(
          document.querySelector('img[alt*="Scan with mobile app"]'),
        ).not.toBeNull()
      })

      expect(document.body.textContent).toMatch(/5:00/)
    })

    it("decrements countdown every second", async () => {
      render(<VpnPairingQrModal {...defaultProps} open={true} />)

      await waitFor(() => {
        expect(
          document.querySelector('img[alt*="Scan with mobile app"]'),
        ).not.toBeNull()
      })

      // Advance 5 seconds
      await tickIntervals(1000, 5)

      expect(document.body.textContent).toMatch(/4:55/)
    })

    it("transitions to expired phase when countdown reaches 0", async () => {
      render(<VpnPairingQrModal {...defaultProps} open={true} />)

      await waitFor(() => {
        expect(
          document.querySelector('img[alt*="Scan with mobile app"]'),
        ).not.toBeNull()
      })

      // Advance 300 seconds to trigger expiry
      await tickIntervals(1000, 300)

      expect(document.body.textContent).toContain("Code expired")
      expect(document.body.textContent).toContain("This code has expired")
    })

    it("shows Regenerate button in expired phase", async () => {
      render(<VpnPairingQrModal {...defaultProps} open={true} />)

      await waitFor(() => {
        expect(
          document.querySelector('img[alt*="Scan with mobile app"]'),
        ).not.toBeNull()
      })

      await tickIntervals(1000, 300)

      const regenerateBtn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent === "Regenerate",
      )
      expect(regenerateBtn).not.toBeUndefined()
    })
  })

  describe("polling for claimed status", () => {
    it("transitions to claimed when polling returns claimed status", async () => {
      mockGetPairingStatus.mockImplementation(
        async (): Promise<PairingStatusResponse> => ({
          status: "claimed",
          claimedAt: "2099-12-31T12:00:00.000Z",
        }),
      )

      render(<VpnPairingQrModal {...defaultProps} open={true} />)

      await waitFor(() => {
        expect(
          document.querySelector('img[alt*="Scan with mobile app"]'),
        ).not.toBeNull()
      })

      await tickIntervals(3000, 1)

      expect(document.body.textContent).toContain("Device paired successfully")

      mockGetPairingStatus.mockImplementation(
        async () => ({ status: "valid" }) as PairingStatusResponse,
      )
    })

    it("calls onPaired when polling returns claimed status", async () => {
      const onPaired = mock<() => void>(() => {})

      mockGetPairingStatus.mockImplementation(
        async (): Promise<PairingStatusResponse> => ({
          status: "claimed",
        }),
      )

      render(
        <VpnPairingQrModal
          {...defaultProps}
          open={true}
          onPaired={onPaired}
        />,
      )

      await waitFor(() => {
        expect(
          document.querySelector('img[alt*="Scan with mobile app"]'),
        ).not.toBeNull()
      })

      await tickIntervals(3000, 1)

      expect(onPaired).toHaveBeenCalled()

      mockGetPairingStatus.mockImplementation(
        async () => ({ status: "valid" }) as PairingStatusResponse,
      )
    })

    it("transitions to error when polling returns error status", async () => {
      mockGetPairingStatus.mockImplementation(
        async (): Promise<PairingStatusResponse> => ({
          status: "error",
          message: "Server error during polling",
        }),
      )

      render(<VpnPairingQrModal {...defaultProps} open={true} />)

      await waitFor(() => {
        expect(
          document.querySelector('img[alt*="Scan with mobile app"]'),
        ).not.toBeNull()
      })

      await tickIntervals(3000, 1)

      expect(document.body.textContent).toContain(
        "Server error during polling",
      )

      mockGetPairingStatus.mockImplementation(
        async () => ({ status: "valid" }) as PairingStatusResponse,
      )
    })

    it("shows Regenerate button after polling error", async () => {
      mockGetPairingStatus.mockImplementation(
        async (): Promise<PairingStatusResponse> => ({
          status: "error",
          message: "Polling error",
        }),
      )

      render(<VpnPairingQrModal {...defaultProps} open={true} />)

      await waitFor(() => {
        expect(
          document.querySelector('img[alt*="Scan with mobile app"]'),
        ).not.toBeNull()
      })

      await tickIntervals(3000, 1)

      const regenerateBtn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent === "Regenerate",
      )
      expect(regenerateBtn).not.toBeUndefined()

      mockGetPairingStatus.mockImplementation(
        async () => ({ status: "valid" }) as PairingStatusResponse,
      )
    })

    it("clears intervals and resets state when modal closes", async () => {
      render(<VpnPairingQrModal {...defaultProps} open={true} />)

      await waitFor(() => {
        expect(
          document.querySelector('img[alt*="Scan with mobile app"]'),
        ).not.toBeNull()
      })

      const clearedIds: number[] = []
      mockClearInterval.mockImplementation((id: number) => {
        clearedIds.push(id)
      })

      cleanup()

      expect(document.body.textContent).not.toContain("Pair a mobile device")
      // Both polling and countdown intervals should be cleared on close
      expect(clearedIds.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe("regenerate flow", () => {
    it("calls generatePairingToken again when Regenerate is clicked after expiry", async () => {
      render(<VpnPairingQrModal {...defaultProps} open={true} />)

      await waitFor(() => {
        expect(
          document.querySelector('img[alt*="Scan with mobile app"]'),
        ).not.toBeNull()
      })

      // Expire the code
      await tickIntervals(1000, 300)

      expect(document.body.textContent).toContain("This code has expired")

      // Override mock to track a fresh call
      mockGeneratePairingToken.mockImplementation(
        async () =>
          ({
            pairingToken: "new-token-xyz",
            expiresAt: "2099-12-31T23:59:59.000Z",
            qrPayload: "new-payload",
          }) as PairingGenerateResponse,
      )

      const regenerateBtn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent === "Regenerate",
      )!
      fireEvent.click(regenerateBtn)

      await waitFor(() => {
        expect(mockGeneratePairingToken).toHaveBeenCalled()
      })

      // Restore default
      mockGeneratePairingToken.mockImplementation(
        async () =>
          ({
            pairingToken: "token-abc123",
            expiresAt: "2099-12-31T23:59:59.000Z",
            qrPayload: "test-payload",
          }) as PairingGenerateResponse,
      )
    })
  })
})
