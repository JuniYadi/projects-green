"use client"

import Link from "next/link"
import { useMemo } from "react"
import { type ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge"
import type { InvoiceListItem } from "@/lib/billing-client"
import { InvoiceDownloadPdfAction } from "@/modules/invoices/ui/invoice-download-pdf-action"

type InvoiceTableProps = {
  emptyMessage?: string
  invoices: InvoiceListItem[]
  lang: string
  tableId?: string
}

const INVOICE_STATUS_FILTERS = [
  { label: "Draft", value: "DRAFT" },
  { label: "Issued", value: "ISSUED" },
  { label: "Open", value: "OPEN" },
  { label: "Paid", value: "PAID" },
  { label: "Overdue", value: "OVERDUE" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "Void", value: "VOID" },
  { label: "Uncollectible", value: "UNCOLLECTIBLE" },
]

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

export function InvoiceTable({
  emptyMessage = "No invoices match your filters.",
  invoices,
  lang,
  tableId,
}: InvoiceTableProps) {
  const columns = useMemo<ColumnDef<InvoiceListItem, unknown>[]>(
    () => [
      {
        accessorKey: "invoiceNumber",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Invoice #" />
        ),
        cell: ({ row }) => (
          <InvoiceNumberCell
            invoiceNumber={row.original.invoiceNumber}
            id={row.original.id}
            lang={lang}
          />
        ),
      },
      {
        id: "issuedAt",
        accessorFn: (row) => row.issuedAt ?? row.createdAt ?? null,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Issued Date" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(
              row.original.issuedAt ?? row.original.createdAt ?? null
            )}
          </span>
        ),
        sortingFn: "datetime",
      },
      {
        id: "dueAt",
        accessorFn: (row) => row.dueAt ?? row.dueDate ?? null,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Due Date" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(row.original.dueAt ?? row.original.dueDate ?? null)}
          </span>
        ),
        sortingFn: "datetime",
      },
      {
        accessorKey: "totalAmountIdr",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Amount" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">
            {formatCurrency(row.original.totalAmountIdr, row.original.currency)}
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
        id: "pdf",
        enableHiding: false,
        header: () => <span>PDF</span>,
        cell: ({ row }) => (
          <InvoiceDownloadPdfAction
            invoiceId={row.original.id}
            invoiceNumber={row.original.invoiceNumber}
          />
        ),
      },
    ],
    [lang]
  )

  return (
    <DataTable
      tableId={tableId}
      columns={columns}
      data={invoices}
      defaultColumnVisibility={{
        dueAt: false,
      }}
      searchableColumns={["invoiceNumber"]}
      searchPlaceholder="Search invoices..."
      facetFilters={[
        {
          columnId: "status",
          label: "Status",
          allLabel: "All status",
          options: INVOICE_STATUS_FILTERS,
        },
      ]}
      initialSorting={[{ id: "issuedAt", desc: true }]}
      emptyMessage={emptyMessage}
    />
  )
}
