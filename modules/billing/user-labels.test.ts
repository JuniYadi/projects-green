import { describe, expect, it } from "bun:test"
import { formatBalanceTransaction, formatPaymentMethod } from "./user-labels"

describe("formatBalanceTransaction", () => {
  it("shows Top-up successful for TOPUP credit", () => {
    const result = formatBalanceTransaction({
      adjustmentType: "CREDIT",
      metadataJson: { source: "TOPUP" },
    })
    expect(result.sign).toBe("+")
    expect(result.tone).toBe("success")
    expect(result.label).toBe("Top-up successful")
  })

  it("shows App Hosting usage charge for APP_HOSTING debit", () => {
    const result = formatBalanceTransaction({
      adjustmentType: "DEBIT",
      metadataJson: { source: "APP_HOSTING" },
    })
    expect(result.sign).toBe("−")
    expect(result.tone).toBe("danger")
    expect(result.label).toBe("App Hosting usage charge")
  })

  it("shows WhatsApp overage charge for WHATSAPP debit", () => {
    const result = formatBalanceTransaction({
      adjustmentType: "DEBIT",
      metadataJson: { source: "WHATSAPP" },
    })
    expect(result.label).toBe("WhatsApp overage charge")
  })

  it("shows VPN monthly payment for VPN debit", () => {
    const result = formatBalanceTransaction({
      adjustmentType: "DEBIT",
      metadataJson: { source: "VPN" },
    })
    expect(result.label).toBe("VPN monthly payment")
  })

  it("shows generic label when source is unknown", () => {
    const result = formatBalanceTransaction({
      adjustmentType: "DEBIT",
      metadataJson: { source: "UNKNOWN" },
    })
    expect(result.label).toBe("Balance adjustment deducted")
  })

  it("handles missing metadataJson gracefully", () => {
    const result = formatBalanceTransaction({
      adjustmentType: "CREDIT",
      metadataJson: null,
    })
    expect(result.label).toBe("Balance adjustment added")
    expect(result.sign).toBe("+")
  })

  it("never exposes raw CREDIT or DEBIT in label", () => {
    const entries = [
      { adjustmentType: "CREDIT", metadataJson: { source: "TOPUP" } },
      { adjustmentType: "DEBIT", metadataJson: { source: "APP_HOSTING" } },
      { adjustmentType: "CREDIT", metadataJson: { source: "ADJUSTMENT" } },
      { adjustmentType: "DEBIT", metadataJson: { source: "WHATSAPP" } },
    ]
    for (const entry of entries) {
      const result = formatBalanceTransaction(entry)
      expect(result.label).not.toContain("CREDIT")
      expect(result.label).not.toContain("DEBIT")
    }
  })
})

describe("formatPaymentMethod", () => {
  it("formats VA", () => expect(formatPaymentMethod("VA")).toBe("Virtual Account"))
  it("formats QRIS", () => expect(formatPaymentMethod("QRIS")).toBe("QRIS"))
  it("formats MANUAL_BANK", () => expect(formatPaymentMethod("MANUAL_BANK")).toBe("Manual Bank"))
  it("returns dash for null", () => expect(formatPaymentMethod(null)).toBe("-"))
  it("returns dash for undefined", () => expect(formatPaymentMethod(undefined)).toBe("-"))
  it("passes through unknown value", () => expect(formatPaymentMethod("CRYPTO")).toBe("CRYPTO"))
})
