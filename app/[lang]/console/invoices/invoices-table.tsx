"use client"

import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import {
  formatInvoiceCurrency,
  formatInvoiceDate,
  INVOICE_STATUS_FILTER_OPTIONS,
} from "@/modules/invoices/invoices.helpers"
import { INVOICE_LIST_ROWS } from "@/modules/invoices/invoices.mock"
import type { InvoiceListItem } from "@/modules/invoices/invoices.types"
import { InvoiceStatusPill } from "@/modules/invoices/ui/invoice-status-pill"

const invoiceColumns: ColumnDef<InvoiceListItem>[] = [
  {
    accessorKey: "invoiceNumber",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Invoice ID" />
    ),
    cell: ({ row }) => (
      <span className="font-medium text-foreground">
        {row.original.invoiceNumber}
      </span>
    ),
  },
  {
    accessorKey: "issuedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => formatInvoiceDate(row.original.issuedAt),
    sortingFn: "datetime",
  },
  {
    accessorKey: "totalAmount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" />
    ),
    cell: ({ row }) =>
      formatInvoiceCurrency(row.original.totalAmount, row.original.currency),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => <InvoiceStatusPill status={row.original.status} />,
  },
]

export function InvoicesTable() {
  return (
    <DataTable
      columns={invoiceColumns}
      data={INVOICE_LIST_ROWS}
      searchPlaceholder="Filter by Invoice ID..."
      searchableColumns={["invoiceNumber"]}
      facetFilters={[
        {
          columnId: "status",
          label: "Status",
          allLabel: "All status",
          options: INVOICE_STATUS_FILTER_OPTIONS,
        },
      ]}
      initialSorting={[{ id: "issuedAt", desc: true }]}
      emptyMessage="No invoices match your filters."
    />
  )
}
