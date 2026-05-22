import type {
  InvoiceListSortBy,
  InvoiceSortDirection,
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
  open: {
    label: "Open",
    toneClassName:
      "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  },
  paid: {
    label: "Paid",
    toneClassName:
      "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400",
  },
  canceled: {
    label: "Canceled",
    toneClassName:
      "border-zinc-500/20 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  },
  uncollectible: {
    label: "Uncollectible",
    toneClassName:
      "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
  },
}

export const INVOICE_STATUS_FILTER_OPTIONS = (
  Object.entries(INVOICE_STATUS_META) as Array<
    [InvoiceStatus, InvoiceStatusMeta]
  >
).map(([value, meta]) => ({ value, label: meta.label }))

export const DEFAULT_INVOICE_SORT: {
  sortBy: InvoiceListSortBy
  sortDir: InvoiceSortDirection
} = {
  sortBy: "issuedAt",
  sortDir: "desc",
}

export const getInvoiceStatusLabel = (status: InvoiceStatus): string => {
  return INVOICE_STATUS_META[status].label
}

export const getInvoiceStatusToneClass = (status: InvoiceStatus): string => {
  return INVOICE_STATUS_META[status].toneClassName
}

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

export const formatInvoiceDate = (
  value: string | null,
  locale = DEFAULT_LOCALE
) => {
  if (!value) {
    return "-"
  }

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
