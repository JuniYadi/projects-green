import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge"
import { toast } from "sonner"
import {
  getAdminInvoices,
  type AdminInvoiceListItem,
} from "@/lib/billing-client"
import { eden } from "@/lib/eden"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import type { ColumnDef } from "@tanstack/react-table"

type InvoicesTabProps = {
  orgId: string
  recentInvoices?: Array<{
    id: string
    invoiceNumber: string
    status: string
    totalAmountIdr: string
    createdAt: string
  }>
}

function formatCurrency(amountIdr: string): string {
  return `Rp ${Number(amountIdr).toLocaleString("id-ID")}`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A"
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(dateStr))
}

export function InvoicesTab({ orgId, recentInvoices }: InvoicesTabProps) {
  const router = useRouter()
  const [invoices, setInvoices] = useState<AdminInvoiceListItem[]>(
    recentInvoices ? (recentInvoices as AdminInvoiceListItem[]) : []
  )
  const [isLoading, setIsLoading] = useState(
    !recentInvoices || recentInvoices.length === 0
  )
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    if (!recentInvoices || recentInvoices.length === 0) {
      getAdminInvoices({ organizationId: orgId })
        .then((res) => setInvoices(res.invoices))
        .catch((err) => setError(err.message))
        .finally(() => setIsLoading(false))
    }
  }, [orgId, recentInvoices])

  async function handleStatusChange(
    invoiceId: string,
    targetStatus: "ISSUED" | "CANCELLED"
  ) {
    setActionLoading(invoiceId)
    try {
      const { data } = await eden.api.billing.admin.invoices[invoiceId].patch({
        status: targetStatus,
      } as never)

      if (!data?.ok) {
        throw new Error(
          (data as { message?: string })?.message ||
            `Failed to ${targetStatus.toLowerCase()} invoice`
        )
      }

      toast.success(
        `Invoice ${targetStatus === "ISSUED" ? "issued" : "cancelled"} successfully`
      )
      router.refresh()

      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId ? { ...inv, status: targetStatus } : inv
        )
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action failed"
      toast.error(message)
    } finally {
      setActionLoading(null)
    }
  }
  const invoiceColumns = useMemo<ColumnDef<AdminInvoiceListItem>[]>(
    () => [
      {
        accessorKey: "invoiceNumber",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Invoice #" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.invoiceNumber}</span>
        ),
      },
      {
        accessorKey: "issuedAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Issued" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(row.original.issuedAt ?? row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: "dueAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Due" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(row.original.dueAt)}
          </span>
        ),
      },
      {
        accessorKey: "totalAmountIdr",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Amount" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">
            {formatCurrency(row.original.totalAmountIdr)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => <InvoiceStatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            {row.original.status === "DRAFT" && (
              <Button
                variant="outline"
                size="sm"
                disabled={actionLoading === row.original.id}
                onClick={() => handleStatusChange(row.original.id, "ISSUED")}
              >
                {actionLoading === row.original.id ? "..." : "Issue"}
              </Button>
            )}
            {(row.original.status === "DRAFT" ||
              row.original.status === "ISSUED") && (
              <Button
                variant="outline"
                size="sm"
                disabled={actionLoading === row.original.id}
                onClick={() => handleStatusChange(row.original.id, "CANCELLED")}
              >
                {actionLoading === row.original.id ? "..." : "Cancel"}
              </Button>
            )}
          </div>
        ),
        enableHiding: false,
      },
    ],
    [actionLoading, handleStatusChange]
  )

  if (isLoading) {
    return <Skeleton className="h-64" />
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-destructive">
          Failed to load invoices: {error}
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardContent className="p-0">
        <DataTable
          tableId="portal-billing-org-invoices"
          columns={invoiceColumns}
          data={invoices}
          searchPlaceholder="Search invoices..."
          searchableColumns={["invoiceNumber"]}
          defaultColumnVisibility={{ dueAt: false }}
        />
      </CardContent>
    </Card>
  )
}
