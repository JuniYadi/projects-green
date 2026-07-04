"use client"

import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { type ColumnDef } from "@tanstack/react-table"
import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { eden } from "@/lib/eden"
import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge"
import { ArrowLeftIcon } from "@phosphor-icons/react"

interface Transaction {
  id: string
  invoiceNumber: string
  status: string
  type: string
  paymentMethod: string | null
  totalAmount: number
  currency: string
  createdAt: string
  dueDate: string | null
  metadata: Record<string, unknown> | null
}

type FilterStatus = "ALL" | "OPEN" | "PAID" | "VOID"

export default function TransactionsPage() {
  void useParams<{ lang?: string }>()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter] = useState<FilterStatus>("ALL")

  useEffect(() => {
    let cancelled = false

    async function loadTransactions() {
      try {
        const { data } = await eden.api.payments.history.get()
        if (!data || !data.ok) {
          return
        }
        if (!cancelled) {
          setTransactions((data.data ?? []) as unknown as Transaction[])
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadTransactions()
    return () => {
      cancelled = true
    }
  }, [])

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "N/A"
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateStr))
  }

  function formatPaymentMethod(method: string | null): string {
    if (!method) return "-"
    switch (method) {
      case "VA":
        return "Virtual Account"
      case "QRIS":
        return "QRIS"
      case "MANUAL_BANK":
        return "Manual Bank"
      default:
        return method
    }
  }

  const columns = useMemo<ColumnDef<Transaction>[]>(() => {
    return [
      {
        accessorKey: "invoiceNumber",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Invoice" />
        ),
        cell: ({ row }) => (
          <div>
            <Link
              href={`/console/billing/invoices/${row.original.id}`}
              className="font-medium text-primary hover:underline"
            >
              {row.original.invoiceNumber}
            </Link>
            <p className="text-xs text-muted-foreground">
              {row.original.type === "TOP_UP" ? "Top Up" : row.original.type}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <InvoiceStatusBadge
            status={row.original.status as "OPEN" | "PAID" | "VOID"}
          />
        ),
      },
      {
        accessorKey: "paymentMethod",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Method" />
        ),
        cell: ({ row }) => (
          <span className="text-sm">
            {formatPaymentMethod(row.original.paymentMethod)}
          </span>
        ),
      },
      {
        accessorKey: "totalAmount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Amount" />
        ),
        cell: ({ row }) => (
          <span className="text-right text-sm font-medium">
            {formatCurrency(row.original.totalAmount)}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => (
          <span className="text-right text-xs text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
    ]
  }, [])

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/console/billing">
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">Transaction History</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          View all your top-up transactions and payment history.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <DataTable
              tableId="console-billing-transactions"
              columns={columns}
              data={transactions}
              searchableColumns={["invoiceNumber"]}
              searchPlaceholder="Search invoices..."
              facetFilters={[
                {
                  columnId: "status",
                  label: "Status",
                  allLabel: "All status",
                  options: [
                    { label: "All", value: "ALL" },
                    { label: "Open", value: "OPEN" },
                    { label: "Paid", value: "PAID" },
                    { label: "Void", value: "VOID" },
                  ],
                },
              ]}
              defaultColumnVisibility={{
                paymentMethod: false,
                createdAt: false,
              }}
              emptyMessage={
                filter === "ALL"
                  ? "No transactions found"
                  : `No ${filter.toLowerCase()} transactions`
              }
            />
          )}
        </CardContent>
      </Card>
    </main>
  )
}
