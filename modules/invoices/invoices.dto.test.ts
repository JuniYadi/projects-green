import { describe, expect, it } from "bun:test"

import {
  toPaymentConfirmationDTO,
  toPaymentInfoDTO,
} from "@/modules/invoices/invoices.dto"
import type { InvoiceDetailRecord } from "@/modules/invoices/invoices.repository"

const makeConfirmation = (
  overrides: Partial<
    InvoiceDetailRecord["paymentConfirmations"][number]
  > = {}
): InvoiceDetailRecord["paymentConfirmations"][number] => ({
  id: "pc_1",
  invoiceId: "inv_1",
  bankAccountId: "ba_1",
  amount: 100,
  senderName: "Alice",
  senderBankName: "BCA",
  senderAccount: "123456",
  screenshotUrl: "https://example.com/screenshot.png",
  notes: "Test payment",
  status: "PENDING",
  reviewedBy: null,
  rejectReason: null,
  reviewedAt: null,
  paymentDateTime: new Date("2026-06-01T10:00:00Z"),
  createdAt: new Date("2026-06-01T09:00:00Z"),
  updatedAt: new Date("2026-06-01T09:00:00Z"),
  bankAccount: {
    id: "ba_bca",
    bankCode: "BCA",
    bankName: "Bank Central Asia",
    accountName: "Main Account",
    currency: "IDR",
  },
  ...overrides,
})

const makeInvoice = (
  overrides: Partial<InvoiceDetailRecord> = {}
): InvoiceDetailRecord => ({
  id: "inv_1",
  billingAccountId: "ba_1",
  subscriptionId: null,
  billingRunId: null,
  invoiceNumber: "INV-2026-0001",
  periodStart: new Date("2026-05-01"),
  periodEnd: new Date("2026-05-31"),
  currency: "USD",
  status: "OPEN",
  subtotalAmount: 100,
  taxAmount: 10,
  discountAmount: 0,
  totalAmount: 110,
  issuedAt: new Date("2026-05-02"),
  dueAt: new Date("2026-05-17"),
  paidAt: null,
  type: null,
  paymentMethod: null,
  gatewayId: null,
  gateway: null,
  metadataJson: null,
  metadata: null,
  createdAt: new Date("2026-05-02"),
  updatedAt: new Date("2026-05-02"),
  paymentConfirmations: [],
  lines: [],
  ...overrides,
})

describe("toPaymentConfirmationDTO", () => {
  it("maps all fields correctly", () => {
    const confirmation = makeConfirmation()
    const dto = toPaymentConfirmationDTO(confirmation)

    expect(dto.id).toBe("pc_1")
    expect(dto.bankAccountId).toBe("ba_1")
    expect(dto.bankName).toBe("Bank Central Asia")
    expect(dto.accountName).toBe("Main Account")
    expect(dto.amount).toBe(100)
    expect(dto.currency).toBe("IDR")
    expect(dto.senderName).toBe("Alice")
    expect(dto.senderBankName).toBe("BCA")
    expect(dto.senderAccount).toBe("123456")
    expect(dto.screenshotUrl).toBe("https://example.com/screenshot.png")
    expect(dto.notes).toBe("Test payment")
    expect(dto.status).toBe("PENDING")
    expect(dto.rejectReason).toBeNull()
    expect(dto.reviewedAt).toBeNull()
    expect(dto.paymentDateTime).toBe("2026-06-01T10:00:00.000Z")
    expect(dto.createdAt).toBe("2026-06-01T09:00:00.000Z")
  })

  it("maps APPROVED status correctly", () => {
    const dto = toPaymentConfirmationDTO(
      makeConfirmation({
        status: "APPROVED",
        reviewedAt: new Date("2026-06-01T11:00:00Z"),
      })
    )
    expect(dto.status).toBe("APPROVED")
    expect(dto.reviewedAt).toBe("2026-06-01T11:00:00.000Z")
  })

  it("maps REJECTED status correctly", () => {
    const dto = toPaymentConfirmationDTO(
      makeConfirmation({
        status: "REJECTED",
        rejectReason: "Invalid amount",
        reviewedAt: new Date("2026-06-01T11:00:00Z"),
      })
    )
    expect(dto.status).toBe("REJECTED")
    expect(dto.rejectReason).toBe("Invalid amount")
  })

  it("normalizes unknown status to PENDING", () => {
    const dto = toPaymentConfirmationDTO(
      makeConfirmation({ status: "UNKNOWN_STATUS" })
    )
    expect(dto.status).toBe("PENDING")
  })

  it("handles null sender fields", () => {
    const dto = toPaymentConfirmationDTO(
      makeConfirmation({
        senderName: null,
        senderBankName: null,
        senderAccount: null,
        screenshotUrl: null,
        notes: null,
      })
    )
    expect(dto.senderName).toBeNull()
    expect(dto.senderBankName).toBeNull()
    expect(dto.screenshotUrl).toBeNull()
    expect(dto.notes).toBeNull()
  })
})

describe("toPaymentInfoDTO", () => {
  it("returns null when no payment data exists", () => {
    const invoice = makeInvoice()
    expect(toPaymentInfoDTO(invoice)).toBeNull()
  })

  it("returns DTO when paymentMethod is set", () => {
    const invoice = makeInvoice({ paymentMethod: "MANUAL_BANK" })
    const dto = toPaymentInfoDTO(invoice)

    expect(dto).not.toBeNull()
    expect(dto?.method).toBe("MANUAL_BANK")
    expect(dto?.gateway).toBeNull()
    expect(dto?.confirmations).toEqual([])
    expect(dto?.reference).toBeNull()
  })

  it("returns DTO when gateway is present", () => {
    const invoice = makeInvoice({
      gateway: { id: "gw_1", name: "Duitku", type: "payment_gateway" },
    })
    const dto = toPaymentInfoDTO(invoice)

    expect(dto?.gateway).toEqual({
      id: "gw_1",
      name: "Duitku",
      type: "payment_gateway",
    })
  })

  it("returns DTO when confirmations exist", () => {
    const invoice = makeInvoice({
      paymentConfirmations: [makeConfirmation()],
    })
    const dto = toPaymentInfoDTO(invoice)

    expect(dto?.confirmations).toHaveLength(1)
    expect(dto?.confirmations[0]?.id).toBe("pc_1")
  })

  it("builds payment reference from metadata with vaNumber", () => {
    const invoice = makeInvoice({
      paymentMethod: "VA",
      metadata: { vaNumber: "1234567890" },
    })
    const dto = toPaymentInfoDTO(invoice)

    expect(dto?.reference).toEqual({
      vaNumber: "1234567890",
      paymentUrl: null,
      gatewayReference: null,
    })
  })

  it("builds payment reference from metadata with paymentUrl", () => {
    const invoice = makeInvoice({
      paymentMethod: "QRIS",
      metadata: { paymentUrl: "https://pay.example.com/123" },
    })
    const dto = toPaymentInfoDTO(invoice)

    expect(dto?.reference?.paymentUrl).toBe("https://pay.example.com/123")
  })

  it("builds payment reference from metadata with duitkuReference", () => {
    const invoice = makeInvoice({
      paymentMethod: "VA",
      metadata: { duitkuReference: "DK-123" },
    })
    const dto = toPaymentInfoDTO(invoice)

    expect(dto?.reference?.gatewayReference).toBe("DK-123")
  })

  it("builds payment reference from metadata with gatewayReference", () => {
    const invoice = makeInvoice({
      paymentMethod: "VA",
      metadata: { gatewayReference: "GW-456" },
    })
    const dto = toPaymentInfoDTO(invoice)

    expect(dto?.reference?.gatewayReference).toBe("GW-456")
  })

  it("returns null reference when metadata has no relevant keys", () => {
    const invoice = makeInvoice({
      paymentMethod: "VA",
      metadata: { unrelated: "data" },
    })
    const dto = toPaymentInfoDTO(invoice)

    expect(dto?.reference).toBeNull()
  })

  it("returns null reference when metadata is null", () => {
    const invoice = makeInvoice({
      paymentMethod: "VA",
      metadata: null,
    })
    const dto = toPaymentInfoDTO(invoice)

    expect(dto?.reference).toBeNull()
  })

  it("builds timeline with issued event", () => {
    const invoice = makeInvoice({
      issuedAt: new Date("2026-05-02T00:00:00Z"),
      paymentMethod: "VA",
    })
    const dto = toPaymentInfoDTO(invoice)

    expect(dto?.timeline).toHaveLength(1)
    expect(dto?.timeline[0]?.type).toBe("issued")
    expect(dto?.timeline[0]?.label).toBe("Invoice issued")
  })

  it("builds timeline with payment_submitted event", () => {
    const invoice = makeInvoice({
      issuedAt: new Date("2026-05-02T00:00:00Z"),
      paymentMethod: "VA",
      paymentConfirmations: [makeConfirmation()],
    })
    const dto = toPaymentInfoDTO(invoice)

    expect(dto?.timeline).toHaveLength(2)
    expect(dto?.timeline[1]?.type).toBe("payment_submitted")
  })

  it("builds timeline with payment_approved event", () => {
    const invoice = makeInvoice({
      issuedAt: new Date("2026-05-02T00:00:00Z"),
      paymentMethod: "VA",
      paymentConfirmations: [
        makeConfirmation({
          status: "APPROVED",
          reviewedAt: new Date("2026-06-02T00:00:00Z"),
        }),
      ],
    })
    const dto = toPaymentInfoDTO(invoice)

    const approvedEvent = dto?.timeline.find(
      (e) => e.type === "payment_approved"
    )
    expect(approvedEvent).toBeDefined()
    expect(approvedEvent?.label).toBe("Payment approved")
  })

  it("builds timeline with payment_rejected event", () => {
    const invoice = makeInvoice({
      issuedAt: new Date("2026-05-02T00:00:00Z"),
      paymentMethod: "VA",
      paymentConfirmations: [
        makeConfirmation({
          status: "REJECTED",
          reviewedAt: new Date("2026-06-02T00:00:00Z"),
        }),
      ],
    })
    const dto = toPaymentInfoDTO(invoice)

    const rejectedEvent = dto?.timeline.find(
      (e) => e.type === "payment_rejected"
    )
    expect(rejectedEvent).toBeDefined()
    expect(rejectedEvent?.label).toBe("Payment rejected")
  })

  it("builds timeline with paid event", () => {
    const invoice = makeInvoice({
      issuedAt: new Date("2026-05-02T00:00:00Z"),
      paidAt: new Date("2026-06-03T00:00:00Z"),
      paymentMethod: "VA",
    })
    const dto = toPaymentInfoDTO(invoice)

    const paidEvent = dto?.timeline.find((e) => e.type === "paid")
    expect(paidEvent).toBeDefined()
    expect(paidEvent?.label).toBe("Invoice paid")
  })

  it("skips issued event when issuedAt is null", () => {
    const invoice = makeInvoice({
      issuedAt: null,
      paymentMethod: "VA",
    })
    const dto = toPaymentInfoDTO(invoice)

    expect(dto?.timeline).toHaveLength(0)
  })

  it("skips reviewed event when reviewedAt is null", () => {
    const invoice = makeInvoice({
      issuedAt: new Date("2026-05-02T00:00:00Z"),
      paymentMethod: "VA",
      paymentConfirmations: [
        makeConfirmation({ status: "PENDING", reviewedAt: null }),
      ],
    })
    const dto = toPaymentInfoDTO(invoice)

    expect(
      dto?.timeline.filter(
        (e) =>
          e.type === "payment_approved" || e.type === "payment_rejected"
      )
    ).toHaveLength(0)
  })
})
