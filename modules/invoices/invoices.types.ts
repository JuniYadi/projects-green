export type InvoiceFlowId = "view" | "download" | "payment" | "cancel_request"

export type InvoiceScreenScenario = "loading" | "success" | "failure" | "empty"

export type InvoiceStatus =
  | "draft"
  | "pending"
  | "paid"
  | "overdue"
  | "cancel_requested"
  | "canceled"

export type InvoiceCurrency = "USD"

export type InvoiceListItem = {
  id: string
  invoiceNumber: string
  issuedAt: string
  dueAt: string
  totalAmount: number
  currency: InvoiceCurrency
  status: InvoiceStatus
}

export type InvoiceLineItem = {
  id: string
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export type InvoiceDetail = InvoiceListItem & {
  customerName: string
  customerEmail: string
  notes: string
  subtotalAmount: number
  taxAmount: number
  lineItems: InvoiceLineItem[]
}

export type InvoiceDownloadData = {
  availableFormats: Array<"pdf">
  defaultFormat: "pdf"
  invoice: InvoiceListItem
}

export type InvoicePaymentMethod = {
  id: string
  label: string
  type: "card" | "bank_transfer"
  last4: string | null
}

export type InvoicePaymentData = {
  invoice: InvoiceListItem
  balanceDueAmount: number
  paymentMethods: InvoicePaymentMethod[]
  defaultMethodId: string | null
}

export type InvoiceCancelRequestData = {
  invoice: InvoiceListItem
  canRequestCancel: boolean
  requestReasons: string[]
  existingRequestNote: string | null
}

type InvoiceScreenBase<TFlow extends InvoiceFlowId> = {
  flow: TFlow
  title: string
  description: string
}

export type InvoiceScreenLoadingState<TFlow extends InvoiceFlowId> =
  InvoiceScreenBase<TFlow> & {
    scenario: "loading"
  }

export type InvoiceScreenSuccessState<
  TFlow extends InvoiceFlowId,
  TData,
> = InvoiceScreenBase<TFlow> & {
  scenario: "success"
  data: TData
}

export type InvoiceScreenEmptyState<TFlow extends InvoiceFlowId> =
  InvoiceScreenBase<TFlow> & {
    scenario: "empty"
    message: string
  }

export type InvoiceScreenFailureState<TFlow extends InvoiceFlowId> =
  InvoiceScreenBase<TFlow> & {
    scenario: "failure"
    code: string
    message: string
    retryable: boolean
  }

export type InvoiceScreenState<TFlow extends InvoiceFlowId, TData> =
  | InvoiceScreenLoadingState<TFlow>
  | InvoiceScreenSuccessState<TFlow, TData>
  | InvoiceScreenEmptyState<TFlow>
  | InvoiceScreenFailureState<TFlow>

export type InvoiceFlowDataMap = {
  view: InvoiceDetail
  download: InvoiceDownloadData
  payment: InvoicePaymentData
  cancel_request: InvoiceCancelRequestData
}

export type InvoiceFlowScenarioRegistry = {
  [K in InvoiceFlowId]: Record<
    InvoiceScreenScenario,
    InvoiceScreenState<K, InvoiceFlowDataMap[K]>
  >
}
