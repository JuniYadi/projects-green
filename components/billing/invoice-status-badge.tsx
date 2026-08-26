import type { AppMessages } from "@/lib/i18n/messages/types"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { cn } from "@/lib/utils"

type InvoiceStatusBadgeProps = {
  status: string
  className?: string
  lang?: string
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

function getStatusLabel(
  status: string,
  labels: AppMessages["console"]["billing"]["invoiceTable"]
): string {
  const map: Record<string, string> = {
    CANCELLED: labels.statusCancelled,
    DRAFT: labels.statusDraft,
    ISSUED: labels.statusIssued,
    OPEN: labels.statusOpen,
    OVERDUE: labels.statusOverdue,
    PAID: labels.statusPaid,
    PENDING: labels.statusOpen,
    UNCOLLECTIBLE: labels.statusUncollectible,
    VOID: labels.statusVoid,
  }
  return map[status.toUpperCase()] ?? status.toUpperCase()
}

export function InvoiceStatusBadge({
  status,
  className,
  lang,
}: InvoiceStatusBadgeProps) {
  const locale = resolveLocaleOrDefault(lang)
  const labels = getMessages(locale).console.billing.invoiceTable
  const normalized = status.toUpperCase()

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        statusStyles[normalized] ?? statusStyles.OPEN,
        className
      )}
    >
      {getStatusLabel(status, labels)}
    </span>
  )
}
