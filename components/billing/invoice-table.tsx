"use client"

import Link from "next/link"
import { useMemo } from "react"
import { type ColumnDef } from "@tanstack/react-table"

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { AppMessages } from "@/lib/i18n/messages/types"
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

function getInvoiceStatusFilters(
  t: AppMessages["console"]["billing"]["invoiceTable"]
) {
  return [
    { label: t.statusDraft, value: "DRAFT" },
    { label: t.statusIssued, value: "ISSUED" },
    { label: t.statusOpen, value: "OPEN" },
    { label: t.statusPaid, value: "PAID" },
    { label: t.statusOverdue, value: "OVERDUE" },
    { label: t.statusCancelled, value: "CANCELLED" },
    { label: t.statusVoid, value: "VOID" },
    { label: t.statusUncollectible, value: "UNCOLLECTIBLE" },
  ]
}
function formatCurrency(amountIdr: string, currency: string): string {
  const amount = Number.parseFloat(amountIdr)
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: currency || "IDR",
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return "N/A"

  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
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
  emptyMessage,
  invoices,
  lang,
  tableId,
}: InvoiceTableProps) {
  const locale = resolveLocaleOrDefault(lang)
  const t = getMessages(locale).console.billing.invoiceTable
  const statusFilters = getInvoiceStatusFilters(t)
  const columns = useMemo<ColumnDef<InvoiceListItem, unknown>[]>(
    () => [
      {
        accessorKey: "invoiceNumber",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.columnInvoice} />
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
          <DataTableColumnHeader column={column} title={t.columnIssuedDate} />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(
              row.original.issuedAt ?? row.original.createdAt ?? null,
              locale
            )}
          </span>
        ),
        sortingFn: "datetime",
      },
      {
        id: "dueAt",
        accessorFn: (row) => row.dueAt ?? row.dueDate ?? null,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.columnDueDate} />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(
              row.original.dueAt ?? row.original.dueDate ?? null,
              locale
            )}
          </span>
        ),
        sortingFn: "datetime",
      },
      {
        accessorKey: "totalAmountIdr",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.columnAmount} />
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
          <DataTableColumnHeader column={column} title={t.columnStatus} />
        ),
        cell: ({ row }) => (
          <InvoiceStatusBadge status={row.original.status} lang={lang} />
        ),
      },
      {
        id: "pdf",
        enableHiding: false,
        header: () => <span>{t.columnPdf}</span>,
        cell: ({ row }) => (
          <InvoiceDownloadPdfAction
            invoiceId={row.original.id}
            invoiceNumber={row.original.invoiceNumber}
          />
        ),
      },
    ],
    [lang, locale, t]
  )

  return (
    <DataTable
      tableId={tableId}
      columns={columns}
      data={invoices}
      defaultColumnVisibility={{ dueAt: false }}
      searchableColumns={["invoiceNumber"]}
      searchPlaceholder={t.searchPlaceholder}
      facetFilters={[
        {
          columnId: "status",
          label: t.columnStatus,
          allLabel: t.statusAll,
          options: statusFilters,
        },
      ]}
      initialSorting={[{ id: "issuedAt", desc: true }]}
      emptyMessage={emptyMessage ?? t.emptyMessage}
    />
  )
}
