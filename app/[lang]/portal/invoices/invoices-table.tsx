"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { eden } from "@/lib/eden"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { Button } from "@/components/ui/button"
import { InvoicesTableSkeleton } from "@/modules/invoices/ui/invoices-table-skeleton"
import { getMessages } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
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
import { InvoiceDownloadPdfAction } from "@/modules/invoices/ui/invoice-download-pdf-action"

const getInvoiceColumns = (lang: string): ColumnDef<InvoiceListItem>[] => {
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale).pInvoicesTable

  return [
    {
      accessorKey: "invoiceNumber",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.colInvoiceId} />
      ),
      cell: ({ row }) => {
        const invoicePath = localizePathname({
          pathname: `/portal/billing/invoices/${row.original.id}`,
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
      accessorKey: "organizationName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.colOrganization} />
      ),
      cell: ({ row }) => {
        const orgName = row.original.organizationName
        return (
          <span className="font-medium text-foreground">
            {orgName || "—"}
          </span>
        )
      },
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true
        const orgName = row.getValue<string | null | undefined>(columnId) ?? "—"
        return orgName === filterValue
      },
    },
    {
      accessorKey: "issuedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.colIssued} />
      ),
      cell: ({ row }) => formatInvoiceDate(row.original.issuedAt, locale),
      sortingFn: "datetime",
    },
    {
      accessorKey: "dueAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.colDue} />
      ),
      cell: ({ row }) => formatInvoiceDate(row.original.dueAt, locale),
      sortingFn: "datetime",
    },
    {
      accessorKey: "totalAmount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.colAmount} />
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
        <DataTableColumnHeader column={column} title={messages.colStatus} />
      ),
      cell: ({ row }) => <InvoiceStatusPill status={row.original.status} />,
    },
    {
      id: "actions",
      enableHiding: false,
      header: () => <span>PDF</span>,
      cell: ({ row }) => (
        <InvoiceDownloadPdfAction
          invoiceId={row.original.id}
          invoiceNumber={row.original.invoiceNumber}
        />
      ),
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

  const orgFilterOptions = useMemo(() => {
    if (state.status !== "success") return []
    const names = [
      ...new Set(
        state.data
          .map((inv) => inv.organizationName?.trim())
          .filter((name): name is string => Boolean(name))
      ),
    ].sort((a, b) => a.localeCompare(b))

    return names.map((name) => ({
      label: name,
      value: name,
    }))
  }, [state])

  if (state.status === "loading") {
    return <InvoicesTableSkeleton />
  }

  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale).pInvoicesTable

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
            {messages.retry}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <DataTable
      tableId="portal-invoices"
      columns={invoiceColumns}
      data={state.data}
      defaultColumnVisibility={{
        dueAt: false,
      }}
      searchPlaceholder={messages.searchPlaceholderPortal}
      searchableColumns={["invoiceNumber", "organizationName"]}
      facetFilters={[
        {
          columnId: "organizationName",
          label: "Organization",
          allLabel: "All organizations",
          options: orgFilterOptions,
        },
        {
          columnId: "status",
          label: "Status",
          allLabel: "All status",
          options: INVOICE_STATUS_FILTER_OPTIONS,
        },
      ]}
      initialSorting={[{ id: "issuedAt", desc: true }]}
      emptyMessage={messages.noInvoicesMatch}
    />
  )
}
