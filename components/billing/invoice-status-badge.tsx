import { cn } from "@/lib/utils"

type InvoiceStatusBadgeProps = {
  status: string
  className?: string
}

const statusStyles: Record<string, string> = {
  CANCELLED:
    "border-gray-500/20 bg-gray-500/10 text-gray-600 dark:text-gray-400",
  DRAFT: "border-muted-foreground/20 bg-muted text-muted-foreground",
  ISSUED: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  OPEN: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  OVERDUE: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
  PAID: "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400",
  PENDING:
    "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  UNCOLLECTIBLE:
    "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
  VOID: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
}

const statusLabels: Record<string, string> = {
  CANCELLED: "Cancelled",
  DRAFT: "Draft",
  ISSUED: "Issued",
  OPEN: "Open",
  OVERDUE: "Overdue",
  PAID: "Paid",
  PENDING: "Pending",
  UNCOLLECTIBLE: "Uncollectible",
  VOID: "Void",
}

export function InvoiceStatusBadge({
  status,
  className,
}: InvoiceStatusBadgeProps) {
  const normalized = status.toUpperCase()
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
