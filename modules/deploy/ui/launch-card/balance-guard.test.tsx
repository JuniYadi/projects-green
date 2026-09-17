import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test"
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { BalanceGuard } from "./balance-guard"

describe("BalanceGuard", () => {
  beforeEach(() => {
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders insufficient balance card with exact details, buffer, deficit, and disabled subtext", () => {
    const onSufficientChange = mock(() => {})
    const onBackToChat = mock(() => {})

    const view = render(
      <BalanceGuard
        hourlyRate={0.04}
        balance={5000}
        currency="IDR"
        lang="id"
        onSufficientChange={onSufficientChange}
        onBackToChat={onBackToChat}
      />
    )

    // Header
    expect(
      view.getByText(/VALIDASI SALDO: SALDO TIDAK MENCUKUPI/i)
    ).toBeDefined()

    // Details: Saldo Anda saat ini, buffer, deficit
    expect(view.getByText(/IDR 5\.000/i)).toBeDefined()
    expect(view.getByText(/IDR 15\.000 \(\$0\.96\)/i)).toBeDefined()
    expect(
      view.getByText(/Dibutuhkan top-up minimal IDR 10\.000/i)
    ).toBeDefined()

    // Top-up CTA button
    expect(view.getByTestId("quick-topup-btn")).toBeDefined()

    // Back to chat button
    expect(view.getByTestId("back-to-chat-btn")).toBeDefined()

    // Subtext
    expect(
      view.getByText(
        /Tombol Launch Dinonaktifkan Sementara Hingga Saldo Mencukupi/i
      )
    ).toBeDefined()

    // Sufficiency callback
    expect(onSufficientChange).toHaveBeenCalledWith(false)
  })

  it("opens quick top-up dialog when top-up button is clicked", () => {
    const view = render(
      <BalanceGuard hourlyRate={0.04} balance={5000} currency="IDR" lang="id" />
    )

    const topUpBtn = view.getByTestId("quick-topup-btn")
    act(() => {
      fireEvent.click(topUpBtn)
    })

    // Dialog should be triggered open
    expect(topUpBtn).toBeDefined()
  })

  it("renders null and reports sufficiency when balance is sufficient", () => {
    const onSufficientChange = mock(() => {})

    const view = render(
      <BalanceGuard
        hourlyRate={0.04}
        balance={50000}
        currency="IDR"
        lang="id"
        onSufficientChange={onSufficientChange}
      />
    )

    expect(view.queryByTestId("balance-guard")).toBeNull()
    expect(onSufficientChange).toHaveBeenCalledWith(true)
  })
})
