"use client"

import Link from "next/link"
import { useMemo } from "react"
import { type ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table"
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge"
import type { InvoiceListItem } from "@/lib/billing-client"

type InvoiceTableProps = {
  invoices: InvoiceListItem[]
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
      href={`/${lang}/console/billing/invoices/${id}`}
      className="font-medium hover:underline"
    >
      {invoiceNumber}
    </Link>
  )
}

export function InvoiceTable({ invoices, lang }: InvoiceTableProps) {
  const columns = useMemo<ColumnDef<InvoiceListItem, unknown>[]>(
    () => [
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
    ],
    [lang]
  )

  return (
    <DataTable
      columns={columns}
      data={invoices}
      searchableColumns={["invoiceNumber"]}
      searchPlaceholder="Search invoices..."
      emptyMessage="No invoices found."
    />
  )
}
