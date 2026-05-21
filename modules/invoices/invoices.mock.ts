import type {
  InvoiceFlowId,
  InvoiceFlowScenarioRegistry,
  InvoiceListItem,
} from "@/modules/invoices/invoices.types"

export const INVOICE_LIST_ROWS: InvoiceListItem[] = [
  {
    id: "invoice_43",
    invoiceNumber: "INV-2026-0043",
    issuedAt: "2026-05-03",
    dueAt: "2026-05-17",
    totalAmount: 129,
    currency: "USD",
    status: "paid",
  },
  {
    id: "invoice_42",
    invoiceNumber: "INV-2026-0042",
    issuedAt: "2026-04-03",
    dueAt: "2026-04-17",
    totalAmount: 129,
    currency: "USD",
    status: "paid",
  },
  {
    id: "invoice_41",
    invoiceNumber: "INV-2026-0041",
    issuedAt: "2026-03-03",
    dueAt: "2026-03-17",
    totalAmount: 149,
    currency: "USD",
    status: "pending",
  },
  {
    id: "invoice_40",
    invoiceNumber: "INV-2026-0040",
    issuedAt: "2026-02-03",
    dueAt: "2026-02-17",
    totalAmount: 179,
    currency: "USD",
    status: "overdue",
  },
  {
    id: "invoice_39",
    invoiceNumber: "INV-2026-0039",
    issuedAt: "2026-01-03",
    dueAt: "2026-01-17",
    totalAmount: 179,
    currency: "USD",
    status: "cancel_requested",
  },
]

const DEFAULT_INVOICE = INVOICE_LIST_ROWS[2]

export const INVOICE_FLOW_STATE_REGISTRY: InvoiceFlowScenarioRegistry = {
  view: {
    loading: {
      flow: "view",
      scenario: "loading",
      title: "Invoice detail",
      description: "Preparing detailed invoice summary.",
    },
    success: {
      flow: "view",
      scenario: "success",
      title: "Invoice detail",
      description: "Detailed invoice summary ready.",
      data: {
        ...DEFAULT_INVOICE,
        customerName: "Acme Corporation",
        customerEmail: "billing@acme.example",
        notes: "Thank you for your business.",
        subtotalAmount: 130,
        taxAmount: 19,
        lineItems: [
          {
            id: "line_1",
            description: "Platform Pro Plan",
            quantity: 1,
            unitPrice: 99,
            lineTotal: 99,
          },
          {
            id: "line_2",
            description: "Additional teammate seats",
            quantity: 5,
            unitPrice: 10,
            lineTotal: 50,
          },
        ],
      },
    },
    failure: {
      flow: "view",
      scenario: "failure",
      title: "Invoice detail",
      description: "Unable to prepare invoice details.",
      code: "INVOICE_DETAIL_UNAVAILABLE",
      message: "Invoice detail is temporarily unavailable.",
      retryable: true,
    },
    empty: {
      flow: "view",
      scenario: "empty",
      title: "Invoice detail",
      description: "No detail data found for this invoice.",
      message: "No invoice detail is available yet.",
    },
  },
  download: {
    loading: {
      flow: "download",
      scenario: "loading",
      title: "Invoice download",
      description: "Checking available invoice file formats.",
    },
    success: {
      flow: "download",
      scenario: "success",
      title: "Invoice download",
      description: "Invoice download options ready.",
      data: {
        invoice: DEFAULT_INVOICE,
        availableFormats: ["pdf"],
        defaultFormat: "pdf",
      },
    },
    failure: {
      flow: "download",
      scenario: "failure",
      title: "Invoice download",
      description: "Unable to load download options.",
      code: "INVOICE_DOWNLOAD_CONFIG_FAILED",
      message: "Download configuration could not be prepared.",
      retryable: true,
    },
    empty: {
      flow: "download",
      scenario: "empty",
      title: "Invoice download",
      description: "No download options exist yet.",
      message: "No downloadable files are currently available.",
    },
  },
  payment: {
    loading: {
      flow: "payment",
      scenario: "loading",
      title: "Invoice payment",
      description: "Preparing payment method options.",
    },
    success: {
      flow: "payment",
      scenario: "success",
      title: "Invoice payment",
      description: "Payment options ready for selection.",
      data: {
        invoice: DEFAULT_INVOICE,
        balanceDueAmount: 149,
        paymentMethods: [
          {
            id: "pm_visa_4242",
            label: "Visa ending in 4242",
            type: "card",
            last4: "4242",
          },
          {
            id: "pm_bank_9124",
            label: "Bank transfer ending in 9124",
            type: "bank_transfer",
            last4: "9124",
          },
        ],
        defaultMethodId: "pm_visa_4242",
      },
    },
    failure: {
      flow: "payment",
      scenario: "failure",
      title: "Invoice payment",
      description: "Unable to prepare payment options.",
      code: "INVOICE_PAYMENT_OPTIONS_FAILED",
      message: "Payment options could not be loaded.",
      retryable: true,
    },
    empty: {
      flow: "payment",
      scenario: "empty",
      title: "Invoice payment",
      description: "No outstanding balance exists for this invoice.",
      message: "This invoice has no pending balance.",
    },
  },
  cancel_request: {
    loading: {
      flow: "cancel_request",
      scenario: "loading",
      title: "Cancel request",
      description: "Checking eligibility for invoice cancellation.",
    },
    success: {
      flow: "cancel_request",
      scenario: "success",
      title: "Cancel request",
      description: "Cancellation request form is ready.",
      data: {
        invoice: DEFAULT_INVOICE,
        canRequestCancel: true,
        requestReasons: [
          "Duplicate invoice",
          "Incorrect billing amount",
          "Service was not used",
        ],
        existingRequestNote: null,
      },
    },
    failure: {
      flow: "cancel_request",
      scenario: "failure",
      title: "Cancel request",
      description: "Unable to load cancellation request options.",
      code: "INVOICE_CANCEL_REQUEST_FAILED",
      message: "Cancellation request options are unavailable right now.",
      retryable: true,
    },
    empty: {
      flow: "cancel_request",
      scenario: "empty",
      title: "Cancel request",
      description: "No cancellation action is needed.",
      message: "No cancellation request can be created for this invoice.",
    },
  },
}

export const INVOICE_INTEGRATION_TODOS: Record<InvoiceFlowId, string[]> = {
  // TODO(invoice-integration): Replace mock data with invoice detail API payload.
  view: [
    "Bind to invoice detail API response and error schema.",
    "Map backend line-item currency precision to UI formatter.",
  ],
  // TODO(invoice-integration): Replace static download formats with server capability.
  download: [
    "Connect to signed URL creation endpoint for PDF files.",
    "Wire audit logging when a download starts.",
  ],
  // TODO(invoice-integration): Replace mock payment options with payment gateway intent.
  payment: [
    "Create payment intent and return gateway client secret.",
    "Track payment method availability by tenant policy.",
  ],
  // TODO(invoice-integration): Replace static reasons with mutation contract.
  cancel_request: [
    "Submit cancellation request mutation with reason payload.",
    "Read existing cancellation request status from backend.",
  ],
}
