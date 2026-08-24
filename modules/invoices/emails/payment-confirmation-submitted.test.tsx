import { describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"

import { PaymentConfirmationSubmittedEmail } from "./payment-confirmation-submitted"

describe("PaymentConfirmationSubmittedEmail", () => {
  it("renders all payment confirmation details", () => {
    const html = renderToStaticMarkup(
      <PaymentConfirmationSubmittedEmail
        invoiceNumber="INV-2026-001"
        amount="$150.00"
        bankName="Test Bank"
        senderName="Test Sender"
        confirmationId="conf-123"
      />
    )

    expect(html).toContain("INV-2026-001")
    expect(html).toContain("$150.00")
    expect(html).toContain("Test Bank")
    expect(html).toContain("Test Sender")
    expect(html).toContain("conf-123")
  })
})
