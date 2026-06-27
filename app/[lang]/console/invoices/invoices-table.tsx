"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { eden } from "@/lib/eden"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { InvoicesTableSkeleton } from "@/modules/invoices/ui/invoices-table-skeleton"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { Button } from "@/components/ui/button"
import {
  DEFAULT_INVOICE_SORT,
  formatInvoiceCurrency,
  formatInvoiceDate,
  INVOICE_STATUS_FILTER_OPTIONS,
} from "@/modules/invoices/invoices.helpers"
import type {
  InvoiceErrorResponse,
  InvoiceListItem,
} from "@/modules/invoices/invoices.types"
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
        <DataTableColumnHeader column={column} title="Issued" />
      ),
      cell: ({ row }) => formatInvoiceDate(row.original.issuedAt, locale),
      sortingFn: "datetime",
    },
    {
      accessorKey: "dueAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Due" />
      ),
      cell: ({ row }) => formatInvoiceDate(row.original.dueAt, locale),
      sortingFn: "datetime",
    },
    {
      accessorKey: "totalAmount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      cell: ({ row }) =>
        formatInvoiceCurrency(
          row.original.totalAmount,
          row.original.currency,
          locale
        ),
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

type InvoiceListRequestState =
  | {
      status: "loading"
    }
  | {
      status: "success"
      data: InvoiceListItem[]
    }
  | {
      status: "error"
      message: string
    }

const getErrorMessage = (payload: InvoiceErrorResponse | null) => {
  if (payload?.message) {
    return payload.message
  }

  return "Unable to load invoices right now."
}

export function InvoicesTable({ lang }: InvoicesTableProps) {
  // ponytail: locale unused but kept for i18n expansion readiness
  void resolveLocaleOrDefault(lang)
  const [state, setState] = useState<InvoiceListRequestState>({
    status: "loading",
  })

  const invoiceColumns = useMemo(() => getInvoiceColumns(lang), [lang])

  const fetchInvoices = useCallback(async (signal?: AbortSignal) => {
    try {
      const { data: payload } = await eden.api.invoices.get({
        $query: {
          sortBy: DEFAULT_INVOICE_SORT.sortBy,
          sortDir: DEFAULT_INVOICE_SORT.sortDir,
        },
        $fetch: { signal },
      })

      if (!payload || payload.ok !== true) {
        setState({
          status: "error",
          message: getErrorMessage(payload as InvoiceErrorResponse | null),
        })
        return
      }

      setState({ status: "success", data: payload.invoices })
    } catch (error) {
      if (signal?.aborted) {
        return
      }

      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load invoices right now.",
      })
    }
  }, [])

  const loadInvoices = async () => {
    setState({ status: "loading" })
    await fetchInvoices()
  }

  useEffect(() => {
    const controller = new AbortController()

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchInvoices(controller.signal)

    return () => {
      controller.abort()
    }
  }, [fetchInvoices])

  if (state.status === "loading") {
    return <InvoicesTableSkeleton />
  }

  if (state.status === "error") {
    return (
      <div className="grid gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm">
        <p className="text-destructive">{state.message}</p>
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void loadInvoices()}
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <DataTable
      tableId="console-invoices"
      columns={invoiceColumns}
      data={state.data}
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
