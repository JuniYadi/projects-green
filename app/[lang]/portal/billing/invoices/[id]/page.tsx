import { notFound } from "next/navigation"
import { getInvoice } from "@/lib/billing-client"
import { InvoiceActions } from "@/components/billing/admin/invoice-actions"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface InvoiceDetailPageProps {
  params: Promise<{ id: string; lang: string }>
}

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const { id } = await params

  const invoiceResponse = await getInvoice(id)

  if (!invoiceResponse?.ok) {
    notFound()
  }

  const invoice = invoiceResponse.invoice

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(parseInt(amount, 10))
  }

  function formatDate(date: string | null) {
    if (!date) return "N/A"
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(date))
  }

  function formatPeriodDate(date: string) {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(date))
  }

  const status = invoice.status.toLowerCase() as "draft" | "open" | "paid" | "void" | "uncollectible"

  return (
    <div className="container py-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight">Invoice {invoice.invoiceNumber}</h1>
            <p className="text-sm text-muted-foreground">Issued {formatDate(invoice.issuedAt)}</p>
          </div>
          <InvoiceActions
            invoiceId={invoice.id}
            invoiceStatus={invoice.status as "DRAFT" | "OPEN" | "PAID" | "VOID" | "UNCOLLECTIBLE"}
            createdAt={invoice.issuedAt || new Date().toISOString()}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(invoice.totalAmountIdr)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={status === "paid" ? "default" : "secondary"}>
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1).toLowerCase()}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Billing Period</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base font-bold">
                {formatPeriodDate(invoice.periodStart)} — {formatPeriodDate(invoice.periodEnd)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Due Date</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatDate(invoice.dueAt)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Description</th>
                    <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Qty</th>
                    <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Unit Price</th>
                    <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((line, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="py-3 text-sm">{line.description}</td>
                      <td className="py-3 text-right text-sm">{line.quantity}</td>
                      <td className="py-3 text-right text-sm">{formatCurrency(line.unitPriceIdr)}</td>
                      <td className="py-3 text-right text-sm font-medium">{formatCurrency(line.amountIdr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
