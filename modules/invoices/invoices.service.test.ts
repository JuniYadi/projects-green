import { describe, expect, it } from "bun:test"

import {
  createInvoiceService,
  InvoiceCancelNotAllowedError,
  InvoiceNotFoundError,
} from "@/modules/invoices/invoices.service"

const baseInvoice = {
  id: "inv_1",
  billingAccountId: "ba_1",
  subscriptionId: null,
  billingRunId: null,
  invoiceNumber: "INV-2026-0001",
  periodStart: new Date("2026-05-01T00:00:00.000Z"),
  periodEnd: new Date("2026-05-31T23:59:59.000Z"),
  currency: "USD",
  status: "OPEN" as const,
  subtotalAmount: 100,
  taxAmount: 10,
  discountAmount: 0,
  totalAmount: 110,
  issuedAt: new Date("2026-05-02T00:00:00.000Z"),
  dueAt: new Date("2026-05-17T00:00:00.000Z"),
  paidAt: null,
  metadataJson: null,
  createdAt: new Date("2026-05-02T00:00:00.000Z"),
  updatedAt: new Date("2026-05-02T00:00:00.000Z"),
}

const detailRecord = {
  ...baseInvoice,
  lines: [
    {
      id: "line_1",
      invoiceId: "inv_1",
      lineType: "SUBSCRIPTION" as const,
      description: "Pro plan",
      quantity: 1,
      unitPrice: 100,
      amount: 100,
      currency: "USD",
      periodStart: null,
      periodEnd: null,
      metadataJson: null,
      createdAt: new Date("2026-05-02T00:00:00.000Z"),
      updatedAt: new Date("2026-05-02T00:00:00.000Z"),
    },
  ],
}

describe("invoice service", () => {
  it("maps list and detail records to UI contracts", async () => {
    const service = createInvoiceService({
      repository: {
        listByOrganization: async () => [baseInvoice],
        findByIdForOrganization: async () => detailRecord,
        updateStatusByIdForOrganization: async () => undefined,
      },
    })

    const list = await service.listInvoices({
      organizationId: "org_1",
      query: {},
    })

    expect(list).toEqual([
      {
        id: "inv_1",
        invoiceNumber: "INV-2026-0001",
        issuedAt: "2026-05-02T00:00:00.000Z",
        dueAt: "2026-05-17T00:00:00.000Z",
        totalAmount: 110,
        currency: "USD",
        status: "open",
      },
    ])

    const detail = await service.getInvoiceDetail({
      organizationId: "org_1",
      invoiceId: "inv_1",
    })

    expect(detail.invoiceNumber).toBe("INV-2026-0001")
    expect(detail.status).toBe("open")
    expect(detail.lineItems[0]?.description).toBe("Pro plan")
  })

  it("rejects cancellation for paid and canceled invoices", async () => {
    const paidRecord = {
      ...detailRecord,
      status: "PAID" as const,
    }

    const service = createInvoiceService({
      repository: {
        listByOrganization: async () => [],
        findByIdForOrganization: async () => paidRecord,
        updateStatusByIdForOrganization: async () => undefined,
      },
    })

    expect(
      service.cancelInvoice({ organizationId: "org_1", invoiceId: "inv_1" })
    ).rejects.toBeInstanceOf(InvoiceCancelNotAllowedError)
  })

  it("throws not found when invoice does not exist", async () => {
    const service = createInvoiceService({
      repository: {
        listByOrganization: async () => [],
        findByIdForOrganization: async () => null,
        updateStatusByIdForOrganization: async () => undefined,
      },
    })

    expect(
      service.getInvoiceDetail({ organizationId: "org_1", invoiceId: "missing" })
    ).rejects.toBeInstanceOf(InvoiceNotFoundError)
  })
})
