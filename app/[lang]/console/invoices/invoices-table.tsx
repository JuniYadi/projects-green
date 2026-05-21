"use client"

import type { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"

import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  formatInvoiceCurrency,
  formatInvoiceDate,
  INVOICE_STATUS_FILTER_OPTIONS,
} from "@/modules/invoices/invoices.helpers"
import { INVOICE_LIST_ROWS } from "@/modules/invoices/invoices.mock"
import type { InvoiceListItem } from "@/modules/invoices/invoices.types"
import { InvoiceStatusPill } from "@/modules/invoices/ui/invoice-status-pill"

const getInvoiceColumns = (lang: string): ColumnDef<InvoiceListItem>[] => {
  const locale = resolveLocaleOrDefault(lang)

  return [
    {
      accessorKey: "invoiceNumber",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Invoice ID" />
      ),
      cell: ({ row }) => {
        const invoicePath = localizePathname({
          pathname: `/console/invoices/${row.original.id}`,
          locale,
        })

        return (
          <Link
            href={invoicePath}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {row.original.invoiceNumber}
          </Link>
        )
      },
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
}

type InvoicesTableProps = {
  lang: string
}

export function InvoicesTable({ lang }: InvoicesTableProps) {
  const invoiceColumns = getInvoiceColumns(lang)

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
