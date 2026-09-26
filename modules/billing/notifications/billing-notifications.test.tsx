import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test"
import type { ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

const render = async (element: ReactElement) => renderToStaticMarkup(element)
mock.module("react-email", () => ({
  render,
  Body: "body",
  Button: "a",
  Container: "div",
  Head: "head",
  Heading: "h1",
  Hr: "hr",
  Html: "html",
  Preview: "div",
  Section: "section",
  Text: "p",
}))

const mockEmails = mock(async () => [] as string[])
const mockSend = mock(async () => null)

mock.module("@/lib/platform-admin-emails", () => ({
  getPlatformAdminEmails: mockEmails,
}))
mock.module("@/lib/queue/email", () => ({ sendEmail: mockSend }))

const { BillingNoticeEmail, CustomerPaymentDecisionEmail, notifySuperAdmins } =
  await import("./billing-notifications")

const notice = {
  organizationName: "Acme",
  actorEmail: "payer@example.com",
  amount: 50000,
  currency: "IDR",
  reference: "INV-1",
  occurredAt: new Date("2026-09-26T10:00:00.000Z"),
  path: "/en/portal/billing/payments?tab=confirmations",
}

beforeEach(() => {
  mockEmails.mockClear()
  mockEmails.mockResolvedValue([])
  mockSend.mockClear()
  mockSend.mockResolvedValue(null)
})

describe("billing notices", () => {
  it("warns without sending when no platform admin exists", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {})
    try {
      await notifySuperAdmins("order_placed", notice)
      expect(warn).toHaveBeenCalled()
      expect(mockSend).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it("sends one short notice per platform user and isolates enqueue failures", async () => {
    mockEmails.mockResolvedValue(["one@example.com", "two@example.com"])
    mockSend.mockRejectedValueOnce(new Error("queue unavailable"))
    const error = spyOn(console, "error").mockImplementation(() => {})
    try {
      await notifySuperAdmins("confirmation_submitted", notice)
      expect(mockSend).toHaveBeenCalledTimes(2)
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "two@example.com",
          subject: "Payment confirmation needs review",
        })
      )
    } finally {
      error.mockRestore()
    }
  })

  it("renders both languages without customer invoice line items", async () => {
    const english = await render(
      <BillingNoticeEmail title="New order" notice={notice} />
    )
    const indonesian = await render(
      <BillingNoticeEmail title="Pesanan baru" notice={notice} locale="id" />
    )
    expect(english).toContain("Organization")
    expect(english).toContain("payer@example.com")
    expect(english).not.toContain("Billed To")
    expect(indonesian).toContain("Organisasi")
  })

  it("renders approval and rejection in English and Indonesian", async () => {
    const approved = await render(
      <CustomerPaymentDecisionEmail approved invoiceNumber="INV-1" />
    )
    const rejected = await render(
      <CustomerPaymentDecisionEmail
        approved={false}
        invoiceNumber="INV-1"
        reason="Unmatched"
        locale="id"
      />
    )
    expect(approved).toContain("Payment approved")
    expect(rejected).toContain("Pembayaran ditolak")
    expect(rejected).toContain("Unmatched")
  })
})
