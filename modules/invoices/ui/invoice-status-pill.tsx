import { cn } from "@/lib/utils"
import {
  getInvoiceStatusLabel,
  getInvoiceStatusToneClass,
} from "@/modules/invoices/invoices.helpers"
import type { InvoiceStatus } from "@/modules/invoices/invoices.types"

type InvoiceStatusPillProps = {
  status: InvoiceStatus
  className?: string
}

export function InvoiceStatusPill({ status, className }: InvoiceStatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        getInvoiceStatusToneClass(status),
        className
      )}
    >
      {getInvoiceStatusLabel(status)}
    </span>
  )
}
