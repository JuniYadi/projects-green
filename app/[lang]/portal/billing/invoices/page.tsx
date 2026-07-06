import { Suspense } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge"
import {
  getAdminInvoices,
  type AdminInvoiceListItem,
} from "@/lib/billing-client"

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function formatCurrency(amount: string): string {
  return `Rp ${Number(amount).toLocaleString("id-ID")}`
}

async function InvoicesList() {
  const { invoices } = await getAdminInvoices()

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No invoices found.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Invoice List ({invoices.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {invoices.map((invoice: AdminInvoiceListItem) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
            >
              <div className="space-y-1">
                <Link
                  href={`/portal/billing/invoices/${invoice.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {invoice.invoiceNumber}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {invoice.organizationId?.slice(0, 8)}... •{" "}
                  {formatDate(invoice.issuedAt ?? invoice.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {formatCurrency(invoice.totalAmountIdr)}
                </span>
                <InvoiceStatusBadge status={invoice.status} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default async function InvoicesPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header>
        <h1 className="text-2xl font-bold">All Invoices</h1>
        <p className="text-muted-foreground">
          Platform-wide invoice management
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96" />}>
        <InvoicesList />
      </Suspense>
    </main>
  )
}
