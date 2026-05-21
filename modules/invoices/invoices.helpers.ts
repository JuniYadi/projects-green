import type {
  InvoiceFlowDataMap,
  InvoiceFlowId,
  InvoiceFlowScenarioRegistry,
  InvoiceScreenScenario,
  InvoiceScreenState,
  InvoiceStatus,
} from "@/modules/invoices/invoices.types"

type InvoiceStatusMeta = {
  label: string
  toneClassName: string
}

const DEFAULT_LOCALE = "en-US"

export const INVOICE_STATUS_META: Record<InvoiceStatus, InvoiceStatusMeta> = {
  draft: {
    label: "Draft",
    toneClassName: "border-slate-500/20 bg-slate-500/10 text-slate-600",
  },
  pending: {
    label: "Pending",
    toneClassName:
      "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  },
  paid: {
    label: "Paid",
    toneClassName:
      "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400",
  },
  overdue: {
    label: "Overdue",
    toneClassName:
      "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
  },
  cancel_requested: {
    label: "Cancel Requested",
    toneClassName:
      "border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  canceled: {
    label: "Canceled",
    toneClassName:
      "border-zinc-500/20 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  },
}

export const INVOICE_FLOW_LABELS: Record<InvoiceFlowId, string> = {
  view: "View",
  download: "Download",
  payment: "Payment",
  cancel_request: "Cancel Request",
}

export const INVOICE_FLOW_OPTIONS = (
  Object.entries(INVOICE_FLOW_LABELS) as Array<[InvoiceFlowId, string]>
).map(([value, label]) => ({ value, label }))

export const INVOICE_SCREEN_SCENARIO_OPTIONS: Array<{
  value: InvoiceScreenScenario
  label: string
}> = [
  { value: "loading", label: "Loading" },
  { value: "success", label: "Success" },
  { value: "failure", label: "Failure" },
  { value: "empty", label: "Empty" },
]

export const isInvoiceScreenScenario = (
  value: string
): value is InvoiceScreenScenario => {
  return INVOICE_SCREEN_SCENARIO_OPTIONS.some(
    (scenarioOption) => scenarioOption.value === value
  )
}

export const INVOICE_STATUS_FILTER_OPTIONS = (
  Object.entries(INVOICE_STATUS_META) as Array<
    [InvoiceStatus, InvoiceStatusMeta]
  >
).map(([value, meta]) => ({ value, label: meta.label }))

export const formatInvoiceCurrency = (
  amount: number,
  currency = "USD",
  locale = DEFAULT_LOCALE
) => {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount)
}

export const formatInvoiceDate = (value: string, locale = DEFAULT_LOCALE) => {
  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/
  let date: Date

  if (dateOnlyPattern.test(value)) {
    const [year, month, day] = value.split("-").map(Number)
    date = new Date(year, month - 1, day)
  } else {
    date = new Date(value)
  }

  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export const getInvoiceStatusLabel = (status: InvoiceStatus): string => {
  return INVOICE_STATUS_META[status].label
}

export const getInvoiceStatusToneClass = (status: InvoiceStatus): string => {
  return INVOICE_STATUS_META[status].toneClassName
}

export const resolveInvoiceFlowState = <TFlow extends InvoiceFlowId>(
  registry: InvoiceFlowScenarioRegistry,
  flow: TFlow,
  scenario: InvoiceScreenScenario
): InvoiceScreenState<TFlow, InvoiceFlowDataMap[TFlow]> => {
  const flowStates = registry[flow]
  return flowStates[scenario]
}

export const isInvoiceScreenSuccessState = <TFlow extends InvoiceFlowId>(
  state: InvoiceScreenState<TFlow, InvoiceFlowDataMap[TFlow]>
): state is InvoiceScreenState<TFlow, InvoiceFlowDataMap[TFlow]> & {
  scenario: "success"
} => {
  return state.scenario === "success"
}
