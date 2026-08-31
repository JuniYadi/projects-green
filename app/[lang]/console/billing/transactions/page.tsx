"use client"

import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { type ColumnDef } from "@tanstack/react-table"
import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { eden } from "@/lib/eden"
import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge"
import { formatBalanceTransaction } from "@/modules/billing/user-labels"
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

interface StatementItem {
  id: string
  type: "CREDIT" | "DEBIT" | string
  amount: string
  currency: string
  reason: string | null
  source: string | null
  balanceBefore: string | number | null
  balanceAfter: string | number | null
  createdAt: string
  invoice: {
    id: string
    invoiceNumber: string
    status: string
  } | null
}

export default function TransactionsPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const transactionMessages = messages.console.billing.transactionsPage
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [statements, setStatements] = useState<StatementItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const [historyRes, statementRes] = await Promise.allSettled([
          eden.api.payments.history.get(),
          eden.api.billing.account.statement.get(),
        ])

        if (cancelled) return

        if (historyRes.status === "fulfilled" && historyRes.value.data?.ok) {
          setTransactions(
            (historyRes.value.data.data ?? []) as unknown as Transaction[]
          )
        }

        if (
          statementRes.status === "fulfilled" &&
          statementRes.value.data?.ok
        ) {
          setStatements(
            (statementRes.value.data.statements ??
              []) as unknown as StatementItem[]
          )
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadData()
    return () => {
      cancelled = true
    }
  }, [])

  const formatCurrency = useMemo(
    () =>
      (amount: number | string, currency = "IDR"): string => {
        const numericAmount =
          typeof amount === "string" ? Number(amount) : amount
        return new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", {
          style: "currency",
          currency: currency || "IDR",
          minimumFractionDigits: 0,
        }).format(Number.isFinite(numericAmount) ? numericAmount : 0)
      },
    [locale]
  )

  const formatDate = useMemo(
    () =>
      (dateStr: string | null): string => {
        if (!dateStr) return transactionMessages.notAvailable
        return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(dateStr))
      },
    [locale, transactionMessages.notAvailable]
  )

  const formatPaymentMethod = useMemo(
    () =>
      (method: string | null): string => {
        if (!method) return "-"
        switch (method) {
          case "VA":
            return transactionMessages.methodVirtualAccount
          case "QRIS":
            return "QRIS"
          case "MANUAL_BANK":
            return transactionMessages.methodManualBank
          default:
            return method
        }
      },
    [transactionMessages]
  )

  const formatTransactionType = useMemo(
    () =>
      (type: string): string => {
        switch (type) {
          case "TOP_UP":
            return transactionMessages.typeTopUp
          case "INVOICE":
            return transactionMessages.typeInvoice
          case "ADJUSTMENT":
            return transactionMessages.typeAdjustment
          default:
            return type
        }
      },
    [transactionMessages]
  )

  const statementColumns = useMemo<ColumnDef<StatementItem>[]>(() => {
    return [
      {
        accessorKey: "reason",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={transactionMessages.balanceActivity}
          />
        ),
        cell: ({ row }) => {
          const entry = formatBalanceTransaction({
            adjustmentType: row.original.type,
            metadataJson: { source: row.original.source },
          })
          return (
            <div className="space-y-0.5">
              <p className="font-medium text-foreground">
                {row.original.reason || entry.label}
              </p>
              {row.original.invoice && (
                <p className="text-xs text-muted-foreground">
                  Invoice:{" "}
                  <Link
                    href={`/${locale}/console/billing/invoices/${row.original.invoice.id}`}
                    className="text-primary hover:underline"
                  >
                    {row.original.invoice.invoiceNumber}
                  </Link>
                </p>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: "type",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={transactionMessages.status}
          />
        ),
        cell: ({ row }) => {
          const isCredit = row.original.type === "CREDIT"
          return (
            <Badge
              variant="outline"
              className={
                isCredit
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
              }
            >
              {isCredit
                ? transactionMessages.typeCredit
                : transactionMessages.typeDebit}
            </Badge>
          )
        },
      },
      {
        accessorKey: "amount",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={transactionMessages.amount}
          />
        ),
        cell: ({ row }) => {
          const isCredit = row.original.type === "CREDIT"
          return (
            <span
              className={`text-right text-sm font-semibold ${
                isCredit
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground"
              }`}
            >
              {isCredit ? "+" : "−"}{" "}
              {formatCurrency(row.original.amount, row.original.currency)}
            </span>
          )
        },
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={transactionMessages.date}
          />
        ),
        cell: ({ row }) => (
          <span className="text-right text-xs text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
    ]
  }, [formatCurrency, formatDate, locale, transactionMessages])
  const invoiceColumns = useMemo<ColumnDef<Transaction>[]>(() => {
    return [
      {
        accessorKey: "invoiceNumber",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={transactionMessages.invoice}
          />
        ),
        cell: ({ row }) => (
          <div>
            <Link
              href={`/${locale}/console/billing/invoices/${row.original.id}`}
              className="font-medium text-primary hover:underline"
            >
              {row.original.invoiceNumber}
            </Link>
            <p className="text-xs text-muted-foreground">
              {formatTransactionType(row.original.type)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={transactionMessages.status}
          />
        ),
        cell: ({ row }) => (
          <InvoiceStatusBadge
            status={row.original.status as "OPEN" | "PAID" | "VOID"}
            lang={locale}
          />
        ),
      },
      {
        accessorKey: "paymentMethod",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={transactionMessages.method}
          />
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
          <DataTableColumnHeader
            column={column}
            title={transactionMessages.amount}
          />
        ),
        cell: ({ row }) => (
          <span className="text-right text-sm font-medium">
            {formatCurrency(row.original.totalAmount, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={transactionMessages.date}
          />
        ),
        cell: ({ row }) => (
          <span className="text-right text-xs text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
    ]
  }, [
    formatCurrency,
    formatDate,
    formatPaymentMethod,
    formatTransactionType,
    locale,
    transactionMessages,
  ])
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/${locale}/console/billing`}>
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">
            {transactionMessages.heading}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {transactionMessages.description}
        </p>
      </header>

      <Tabs defaultValue="statements" className="space-y-4">
        <TabsList>
          <TabsTrigger value="statements">
            {transactionMessages.tabStatements}
          </TabsTrigger>
          <TabsTrigger value="invoices">
            {transactionMessages.tabInvoices}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="statements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {transactionMessages.tabStatements}
              </CardTitle>
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
                  tableId="console-billing-statements"
                  columns={statementColumns}
                  data={statements}
                  searchableColumns={["reason"]}
                  searchPlaceholder={
                    transactionMessages.searchStatementsPlaceholder
                  }
                  facetFilters={[
                    {
                      columnId: "type",
                      label: transactionMessages.status,
                      allLabel: transactionMessages.statusAll,
                      options: [
                        {
                          label: transactionMessages.statusAll,
                          value: "ALL",
                        },
                        {
                          label: transactionMessages.typeCredit,
                          value: "CREDIT",
                        },
                        {
                          label: transactionMessages.typeDebit,
                          value: "DEBIT",
                        },
                      ],
                    },
                  ]}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {transactionMessages.tabInvoices}
              </CardTitle>
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
                  columns={invoiceColumns}
                  data={transactions}
                  searchableColumns={["invoiceNumber"]}
                  searchPlaceholder={transactionMessages.searchPlaceholder}
                  facetFilters={[
                    {
                      columnId: "status",
                      label: transactionMessages.status,
                      allLabel: transactionMessages.statusAll,
                      options: [
                        {
                          label: transactionMessages.statusAll,
                          value: "ALL",
                        },
                        {
                          label: transactionMessages.statusOpen,
                          value: "OPEN",
                        },
                        {
                          label: transactionMessages.statusPaid,
                          value: "PAID",
                        },
                        {
                          label: transactionMessages.statusVoid,
                          value: "VOID",
                        },
                      ],
                    },
                  ]}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}
