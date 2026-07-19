import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"

import {
  InvoicePaymentSection,
  PaymentConfirmationList,
  PaymentMethodGatewayCard,
} from "@/modules/invoices/ui/invoice-payment-section"
import type {
  PaymentConfirmationDTO,
  PaymentInfoDTO,
  PaymentTimelineEvent,
} from "@/modules/invoices/invoices.types"

const basePayment: PaymentInfoDTO = {
  method: "VA",
  gateway: { id: "gw_1", name: "Duitku", type: "payment_gateway" },
  reference: {
    vaNumber: "1234567890",
    paymentUrl: null,
    gatewayReference: null,
  },
  confirmations: [],
  timeline: [],
}

const baseConfirmation: PaymentConfirmationDTO = {
  id: "pc_1",
  bankAccountId: "ba_1",
  bankName: "BCA",
  accountName: "Main",
  amount: 100000,
  currency: "IDR",
  senderName: "Alice",
  senderBankName: "BCA",
  senderAccount: "123",
  screenshotUrl: null,
  notes: null,
  status: "PENDING",
  rejectReason: null,
  reviewedAt: null,
  paymentDateTime: "2026-06-01T10:00:00.000Z",
  createdAt: "2026-06-01T09:00:00.000Z",
}

describe("PaymentMethodGatewayCard", () => {
  it("renders payment method and gateway", () => {
    const view = render(<PaymentMethodGatewayCard payment={basePayment} />)

    expect(view.getByText("Virtual Account (VA)")).toBeTruthy()
    expect(view.getByText("Duitku")).toBeTruthy()
  })

  it("renders VA number reference", () => {
    const view = render(<PaymentMethodGatewayCard payment={basePayment} />)
    expect(view.getByText("1234567890")).toBeTruthy()
  })

  it("renders payment URL reference", () => {
    const payment: PaymentInfoDTO = {
      ...basePayment,
      reference: {
        vaNumber: null,
        paymentUrl: "https://pay.example.com/123",
        gatewayReference: null,
      },
    }
    const view = render(<PaymentMethodGatewayCard payment={payment} />)
    expect(view.getByText("Open Payment Page")).toBeTruthy()
  })

  it("renders gateway reference", () => {
    const payment: PaymentInfoDTO = {
      ...basePayment,
      reference: {
        vaNumber: null,
        paymentUrl: null,
        gatewayReference: "GW-456",
      },
    }
    const view = render(<PaymentMethodGatewayCard payment={payment} />)
    expect(view.getByText("GW-456")).toBeTruthy()
  })

  it("renders without gateway when null", () => {
    const payment: PaymentInfoDTO = {
      ...basePayment,
      gateway: null,
    }
    const view = render(<PaymentMethodGatewayCard payment={payment} />)
    expect(view.queryByText("Duitku")).toBeNull()
  })

  it("renders without reference when null", () => {
    const payment: PaymentInfoDTO = {
      ...basePayment,
      reference: null,
    }
    const view = render(<PaymentMethodGatewayCard payment={payment} />)
    expect(view.queryByText("Payment Reference")).toBeNull()
  })

  it("renders null method as dash", () => {
    const payment: PaymentInfoDTO = {
      ...basePayment,
      method: null,
    }
    const view = render(<PaymentMethodGatewayCard payment={payment} />)
    expect(view.getByText("—")).toBeTruthy()
  })

  it("renders unknown method as its raw value", () => {
    const payment: PaymentInfoDTO = {
      ...basePayment,
      method: "CRYPTO",
    }
    const view = render(<PaymentMethodGatewayCard payment={payment} />)
    expect(view.getByText("CRYPTO")).toBeTruthy()
  })

  it("renders all known payment methods", () => {
    const methods = ["VA", "QRIS", "MANUAL_BANK", "CASH", "CHEQUE", "OTHER"]
    for (const method of methods) {
      const payment: PaymentInfoDTO = { ...basePayment, method }
      const view = render(<PaymentMethodGatewayCard payment={payment} />)
      expect(view.getByText("Payment Method & Gateway")).toBeTruthy()
      view.unmount()
    }
  })
})

describe("PaymentConfirmationList", () => {
  it("returns null when confirmations is empty", () => {
    const view = render(
      <PaymentConfirmationList
        confirmations={[]}
        canManage={false}
        onActionComplete={mock(() => {})}
      />
    )
    expect(view.container.innerHTML).toBe("")
  })

  it("renders confirmation table rows", () => {
    const view = render(
      <PaymentConfirmationList
        confirmations={[baseConfirmation]}
        canManage={false}
        onActionComplete={mock(() => {})}
      />
    )

    expect(view.getByText("BCA")).toBeTruthy()
    expect(view.getByText("Main")).toBeTruthy()
    expect(view.getByText(/100,000/)).toBeTruthy()
    expect(view.getByText("Alice")).toBeTruthy()
    expect(view.getByText("Pending")).toBeTruthy()
  })

  it("renders Review button for PENDING confirmations when canManage", () => {
    const view = render(
      <PaymentConfirmationList
        confirmations={[baseConfirmation]}
        canManage={true}
        onActionComplete={mock(() => {})}
      />
    )

    expect(view.getByText("Review")).toBeTruthy()
  })

  it("does not render Review button when canManage is false", () => {
    const view = render(
      <PaymentConfirmationList
        confirmations={[baseConfirmation]}
        canManage={false}
        onActionComplete={mock(() => {})}
      />
    )

    expect(view.queryByText("Review")).toBeNull()
  })

  it("does not render Review button for non-PENDING confirmations", () => {
    const approved: PaymentConfirmationDTO = {
      ...baseConfirmation,
      status: "APPROVED",
    }
    const view = render(
      <PaymentConfirmationList
        confirmations={[approved]}
        canManage={true}
        onActionComplete={mock(() => {})}
      />
    )

    expect(view.queryByText("Review")).toBeNull()
    expect(view.getByText("Approved")).toBeTruthy()
  })

  it("renders Rejected status", () => {
    const rejected: PaymentConfirmationDTO = {
      ...baseConfirmation,
      status: "REJECTED",
    }
    const view = render(
      <PaymentConfirmationList
        confirmations={[rejected]}
        canManage={false}
        onActionComplete={mock(() => {})}
      />
    )

    expect(view.getByText("Rejected")).toBeTruthy()
  })

  it("renders senderName as dash when null", () => {
    const noSender: PaymentConfirmationDTO = {
      ...baseConfirmation,
      senderName: null,
    }
    const view = render(
      <PaymentConfirmationList
        confirmations={[noSender]}
        canManage={false}
        onActionComplete={mock(() => {})}
      />
    )

    expect(view.getByText("—")).toBeTruthy()
  })
})

describe("InvoicePaymentSection", () => {
  it("renders all sub-components", () => {
    const timeline: PaymentTimelineEvent[] = [
      { type: "issued", label: "Invoice issued", at: "2026-05-02T00:00:00Z" },
    ]
    const payment: PaymentInfoDTO = {
      ...basePayment,
      confirmations: [baseConfirmation],
      timeline,
    }

    const view = render(
      <InvoicePaymentSection
        payment={payment}
        canManageConfirmations={true}
        onActionComplete={mock(() => {})}
      />
    )

    expect(view.getByText("Payment Method & Gateway")).toBeTruthy()
    expect(view.getByText("Payment Confirmations (1)")).toBeTruthy()
    expect(view.getByText("Payment Timeline")).toBeTruthy()
    expect(view.getByText("Invoice issued")).toBeTruthy()
  })

  it("renders empty timeline without crashing", () => {
    const payment: PaymentInfoDTO = {
      ...basePayment,
      confirmations: [],
      timeline: [],
    }

    const view = render(
      <InvoicePaymentSection
        payment={payment}
        canManageConfirmations={false}
        onActionComplete={mock(() => {})}
      />
    )

    expect(view.getByText("Payment Method & Gateway")).toBeTruthy()
    expect(view.queryByText("Payment Timeline")).toBeNull()
  })
})
