import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { InvoiceCancelledEmail } from "./emails/invoice-cancelled"
import { InvoiceCreatedEmail } from "./emails/invoice-created"
import { InvoiceOverdueEmail } from "./emails/invoice-overdue"
import { InvoicePaidEmail } from "./emails/invoice-paid"
import { PaymentReminderEmail } from "./emails/payment-reminder"
import { TopupReceivedAdminNotice } from "./emails/topup-received-admin-notice"

const baseProps = {
  invoiceNumber: "INV-1001",
  amount: "150.00",
  currency: "USD",
  status: "open",
  issuedAt: "2026-05-01",
  dueAt: "2026-05-15",
  periodStart: "2026-05-01",
  periodEnd: "2026-05-31",
}

const render = (el: React.ReactElement) => renderToStaticMarkup(el)

describe("invoice email links use APP_URL", () => {
  const originalAppUrl = process.env.APP_URL
  const originalNextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL

  beforeEach(() => {
    delete process.env.APP_URL
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  afterEach(() => {
    if (originalAppUrl === undefined) {
      delete process.env.APP_URL
    } else {
      process.env.APP_URL = originalAppUrl
    }
    if (originalNextPublicAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalNextPublicAppUrl
    }
  })

  const templates = [
    ["InvoiceCreatedEmail", InvoiceCreatedEmail],
    ["InvoicePaidEmail", InvoicePaidEmail],
    ["InvoiceOverdueEmail", InvoiceOverdueEmail],
    ["PaymentReminderEmail", PaymentReminderEmail],
    ["InvoiceCancelledEmail", InvoiceCancelledEmail],
  ] as const

  for (const [name, Email] of templates) {
    it(`${name} uses APP_URL for the invoice link`, () => {
      process.env.APP_URL = "https://app.example.com"
      const html = render(<Email {...baseProps} />)
      expect(html).toContain(
        "https://app.example.com/console/invoices/INV-1001"
      )
      expect(html).not.toContain("localhost")
    })
  }

  it("falls back to localhost when APP_URL is unset", () => {
    const html = render(<InvoiceCreatedEmail {...baseProps} />)
    expect(html).toContain("http://localhost:3300/console/invoices/INV-1001")
  })

  it("renders the same billed-to identity for every delivery address", () => {
    const contactCopyHtml = render(
      <InvoicePaidEmail
        {...baseProps}
        organizationName="Acme"
        billedToEmail="payer@org.com"
      />
    )
    const adminCopyHtml = render(
      <InvoicePaidEmail
        {...baseProps}
        organizationName="Acme"
        billedToEmail="payer@org.com"
      />
    )

    const billedToLine = (html: string) => {
      const match = html.match(/Billed To[\s\S]*?payer@org\.com/)
      return match?.[0]
    }

    expect(billedToLine(contactCopyHtml)).toBeDefined()
    expect(billedToLine(contactCopyHtml)).toBe(billedToLine(adminCopyHtml))
    expect(contactCopyHtml).not.toContain("admin@org.com")
    expect(adminCopyHtml).not.toContain("contact@org.com")
  })

  it("renders an admin notice without invoice details", () => {
    process.env.APP_URL = "https://app.example.com"
    const html = render(
      <TopupReceivedAdminNotice
        invoiceId="inv-123"
        organizationName="Acme"
        actorEmail="payer@org.com"
        amount="Rp50,000"
        paymentMethod="VA"
        paidAt="September 26, 2026"
        locale="id"
      />
    )
    expect(html).toContain("payer@org.com")
    expect(html).toContain("Acme")
    expect(html).toContain(
      "https://app.example.com/console/billing/invoices/inv-123"
    )
    expect(html).not.toContain("Billed To")
    expect(html).not.toContain("admin@org.com")
  })
})
