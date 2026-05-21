"use client"

import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"

type InvoiceRecord = {
  amount: number
  date: string
  invoiceId: string
  status: "Paid" | "Pending" | "Overdue"
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

const invoiceRows: InvoiceRecord[] = [
  {
    invoiceId: "INV-2026-0043",
    date: "2026-05-03",
    amount: 129,
    status: "Paid",
  },
  {
    invoiceId: "INV-2026-0042",
    date: "2026-04-03",
    amount: 129,
    status: "Paid",
  },
  {
    invoiceId: "INV-2026-0041",
    date: "2026-03-03",
    amount: 149,
    status: "Pending",
  },
  {
    invoiceId: "INV-2026-0040",
    date: "2026-02-03",
    amount: 179,
    status: "Overdue",
  },
]

const invoiceColumns: ColumnDef<InvoiceRecord>[] = [
  {
    accessorKey: "invoiceId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Invoice ID" />
    ),
    cell: ({ row }) => (
      <span className="font-medium text-foreground">{row.original.invoiceId}</span>
    ),
  },
  {
    accessorKey: "date",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) =>
      new Date(row.original.date).toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    sortingFn: "datetime",
  },
  {
    accessorKey: "amount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" />
    ),
    cell: ({ row }) => currencyFormatter.format(row.original.amount),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
  },
]

export function InvoicesTable() {
  return (
    <DataTable
      columns={invoiceColumns}
      data={invoiceRows}
      searchPlaceholder="Filter by Invoice ID..."
      searchableColumns={["invoiceId"]}
      facetFilters={[
        {
          columnId: "status",
          label: "Status",
          allLabel: "All status",
          options: [
            { label: "Paid", value: "Paid" },
            { label: "Pending", value: "Pending" },
            { label: "Overdue", value: "Overdue" },
          ],
        },
      ]}
      initialSorting={[{ id: "date", desc: true }]}
      emptyMessage="No invoices match your filters."
    />
  )
}
