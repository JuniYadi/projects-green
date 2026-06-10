"use client"

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
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
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>("ALL")

  useEffect(() => {
    let cancelled = false

    async function loadTransactions() {
      try {
        const response = await fetch("/api/payments/history")
        const data = await response.json()
        if (data.ok && !cancelled) {
          setTransactions(data.data || [])
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

  const filtered = filter === "ALL"
    ? transactions
    : transactions.filter((t) => t.status === filter)

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

  const FILTERS: { value: FilterStatus; label: string }[] = [
    { value: "ALL", label: "All" },
    { value: "OPEN", label: "Open" },
    { value: "PAID", label: "Paid" },
    { value: "VOID", label: "Void" },
  ]

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
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Transactions</CardTitle>
            <div className="flex gap-1">
              {FILTERS.map((f) => (
                <Button
                  key={f.value}
                  variant={filter === f.value ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilter(f.value)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border p-6 text-center">
              <p className="text-muted-foreground">
                {filter === "ALL"
                  ? "No transactions found"
                  : `No ${filter.toLowerCase()} transactions`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Invoice
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Method
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b last:border-b-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/console/billing/invoices/${tx.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {tx.invoiceNumber}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {tx.type === "TOP_UP" ? "Top Up" : tx.type}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <InvoiceStatusBadge
                          status={tx.status as "OPEN" | "PAID" | "VOID"}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {formatPaymentMethod(tx.paymentMethod)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium">
                        {formatCurrency(tx.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {formatDate(tx.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
