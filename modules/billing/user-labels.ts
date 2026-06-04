/**
 * User-friendly labels for balance transactions.
 * Internal ledger terms (CREDIT/DEBIT) must not leak into normal user UI.
 *
 * Usage:
 *   const { sign, label } = formatBalanceTransaction(entry)
 *   // Render: <span class={tone === "success" ? "text-green-600" : "text-red-600"}>{sign} {label}</span>
 */

export type BalanceTransactionEntry = {
  adjustmentType: string
  metadataJson?: Record<string, unknown> | null
  amount?: string | number
}

export type FormattedBalanceTransaction = {
  sign: "+" | "−"
  tone: "success" | "danger"
  label: string
}

const SOURCE_LABELS: Record<string, string> = {
  TOPUP: "Top-up successful",
  APP_HOSTING: "App Hosting usage charge",
  WHATSAPP: "WhatsApp overage charge",
  VPN: "VPN monthly payment",
  PACKAGE: "Monthly package payment",
  // ADJUSTMENT handled by fallback with added/deducted suffix
}

/**
 * Map a balance transaction entry to user-facing display values.
 * Never exposes raw CREDIT/DEBIT or internal metadata to customers.
 */
export function formatBalanceTransaction(
  entry: BalanceTransactionEntry,
): FormattedBalanceTransaction {
  const source =
    entry.metadataJson &&
    typeof entry.metadataJson === "object" &&
    !Array.isArray(entry.metadataJson) &&
    "source" in entry.metadataJson
      ? String((entry.metadataJson as Record<string, unknown>).source)
      : "ADJUSTMENT"

  const isCredit = entry.adjustmentType === "CREDIT"

  return {
    sign: isCredit ? "+" : "−",
    tone: isCredit ? "success" : "danger",
    label: SOURCE_LABELS[source] ?? (isCredit ? "Balance adjustment added" : "Balance adjustment deducted"),
  }
}

/**
 * Payment method label for user display.
 */
export function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return "-"
  switch (method) {
    case "VA":
      return "Virtual Account"
    case "QRIS":
      return "QRIS"
    case "MANUAL_BANK":
      return "Manual Bank"
    default:
      return method
  }
}
