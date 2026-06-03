import { cn } from "@/lib/utils"

type InvoiceStatus = "OPEN" | "PENDING" | "PAID" | "VOID"

type InvoiceStatusBadgeProps = {
  status: InvoiceStatus
  className?: string
}

const statusStyles: Record<InvoiceStatus, string> = {
  OPEN:
    "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  PENDING:
    "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  PAID:
    "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400",
  VOID: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
}

const statusLabels: Record<InvoiceStatus, string> = {
  OPEN: "Open",
  PENDING: "Pending",
  PAID: "Paid",
  VOID: "Void",
}

export function InvoiceStatusBadge({ status, className }: InvoiceStatusBadgeProps) {
  const normalized = status.toUpperCase() as InvoiceStatus
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        statusStyles[normalized] ?? statusStyles.OPEN,
        className
      )}
    >
      {statusLabels[normalized] ?? normalized}
    </span>
  )
}
