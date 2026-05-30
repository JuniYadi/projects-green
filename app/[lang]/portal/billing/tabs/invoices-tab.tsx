"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { type ColumnDef } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge"
import { DataTable } from "@/components/data-table"
import { getInvoices } from "@/lib/billing-client"
import type { InvoiceListItem } from "@/lib/billing-client"
import { ArrowRightIcon } from "@phosphor-icons/react"

type InvoicesTabProps = {
  lang: string
}

function formatCurrency(amountIdr: string, currency: string): string {
  const amount = Number.parseFloat(amountIdr)
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: currency || "IDR",
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A"

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(dateStr))
}

function InvoiceNumberCell({
  invoiceNumber,
  id,
  lang,
}: {
  invoiceNumber: string
  id: string
  lang: string
}) {
  return (
    <Link
      href={`/${lang}/portal/invoices/${id}`}
      className="font-medium hover:underline"
    >
      {invoiceNumber}
    </Link>
  )
}

export function InvoicesTab({ lang }: InvoicesTabProps) {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [periodFilter, setPeriodFilter] = useState("")

  useEffect(() => {
    async function loadInvoices() {
      try {
        const response = await getInvoices()
        setInvoices(response.invoices)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load invoices")
      } finally {
        setIsLoading(false)
      }
    }

    loadInvoices()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          {error}
        </CardContent>
      </Card>
    )
  }

  const filteredInvoices = invoices.filter((invoice) => {
    if (statusFilter !== "ALL" && invoice.status !== statusFilter) {
      return false
    }
    if (periodFilter && invoice.issuedAt && !invoice.issuedAt.startsWith(periodFilter)) {
      return false
    }
    return true
  })

  const columns: ColumnDef<InvoiceListItem, unknown>[] = [
    {
      accessorKey: "invoiceNumber",
      header: "Invoice #",
      cell: ({ row }) => (
        <InvoiceNumberCell
          invoiceNumber={row.original.invoiceNumber}
          id={row.original.id}
          lang={lang}
        />
      ),
    },
    {
      accessorKey: "issuedAt",
      header: "Period",
      cell: ({ row }) => {
        const issued = formatDate(row.original.issuedAt)
        const due = formatDate(row.original.dueAt)
        return (
          <span className="text-muted-foreground">
            {issued} - {due}
          </span>
        )
      },
    },
    {
      accessorKey: "totalAmountIdr",
      header: "Amount",
      cell: ({ row }) => (
        <span className="font-medium">
          {formatCurrency(row.original.totalAmountIdr, row.original.currency)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <InvoiceStatusBadge
          status={row.original.status as "PENDING" | "PAID" | "VOID"}
        />
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button asChild size="sm" variant="ghost">
          <Link href={`/${lang}/portal/invoices/${row.original.id}`}>
            View
            <ArrowRightIcon className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="ALL">All</TabsTrigger>
            <TabsTrigger value="DRAFT">Draft</TabsTrigger>
            <TabsTrigger value="OPEN">Open</TabsTrigger>
            <TabsTrigger value="PAID">Paid</TabsTrigger>
            <TabsTrigger value="VOID">Void</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          type="month"
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          className="w-auto"
        />
      </div>
      <DataTable
        columns={columns}
        data={filteredInvoices}
        searchableColumns={["invoiceNumber"]}
        searchPlaceholder="Search invoices..."
        emptyMessage="No invoices found."
      />
    </div>
  )
}