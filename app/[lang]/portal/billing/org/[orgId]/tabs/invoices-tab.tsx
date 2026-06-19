"use client"

import { useEffect, useState } from "react"
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

type InvoicesTabProps = {
  orgId: string
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

export function InvoicesTab({ orgId }: InvoicesTabProps) {
  const router = useRouter()
  const [invoices, setInvoices] = useState<AdminInvoiceListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    getAdminInvoices({ organizationId: orgId })
      .then((res) => setInvoices(res.invoices))
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [orgId])

  async function handleStatusChange(
    invoiceId: string,
    targetStatus: "ISSUED" | "CANCELLED"
  ) {
    setActionLoading(invoiceId)
    try {
      const { data } = await eden.api.billing.admin
        .invoices[invoiceId]
        .patch({ status: targetStatus } as never)

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
      const message =
        err instanceof Error ? err.message : "Action failed"
      toast.error(message)
    } finally {
      setActionLoading(null)
    }
  }

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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">
                  Invoice #
                </th>
                <th className="px-4 py-3 text-left font-medium">Issued</th>
                <th className="px-4 py-3 text-left font-medium">Due</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No invoices found for this organization.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3 font-medium">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(
                        invoice.issuedAt ?? invoice.createdAt
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(invoice.dueAt)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(invoice.totalAmountIdr)}
                    </td>
                    <td className="px-4 py-3">
                      <InvoiceStatusBadge status={invoice.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {invoice.status === "DRAFT" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={actionLoading === invoice.id}
                            onClick={() =>
                              handleStatusChange(invoice.id, "ISSUED")
                            }
                          >
                            {actionLoading === invoice.id
                              ? "..."
                              : "Issue"}
                          </Button>
                        )}
                        {(invoice.status === "DRAFT" ||
                          invoice.status === "ISSUED") && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={actionLoading === invoice.id}
                            onClick={() =>
                              handleStatusChange(invoice.id, "CANCELLED")
                            }
                          >
                            {actionLoading === invoice.id
                              ? "..."
                              : "Cancel"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
