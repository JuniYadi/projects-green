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
import { QuickTopUpDialog } from "@/components/billing/quick-top-up-dialog"
import { formatBalanceTransaction } from "@/modules/billing/user-labels"
import {
  ArrowLeft,
  ArrowUpRight,
  Plus,
  Receipt,
  TrendDown,
  TrendUp,
  Wallet,
} from "@phosphor-icons/react"
interface StatementAccount {
  id: string
  organizationId: string
  currency: string
  balanceIdr: string
  formattedBalance: string
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
  const [account, setAccount] = useState<StatementAccount | null>(null)
  const [statements, setStatements] = useState<StatementItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [topUpOpen, setTopUpOpen] = useState(false)
  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const res = await eden.api.billing.account.statement.get()

        if (cancelled) return

        if (res.data?.ok) {
          const resData = res.data
          if (resData.account) {
            setAccount(resData.account as unknown as StatementAccount)
          }
          setStatements(
            (resData.statements ?? []) as unknown as StatementItem[]
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
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {isCredit ? "+" : "−"}{" "}
              {formatCurrency(row.original.amount, row.original.currency)}
            </span>
          )
        },
      },
      {
        accessorKey: "balanceAfter",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={transactionMessages.balanceAfter}
          />
        ),
        cell: ({ row }) => {
          if (
            row.original.balanceAfter === null ||
            row.original.balanceAfter === undefined
          ) {
            return (
              <span className="text-right text-xs text-muted-foreground">
                -
              </span>
            )
          }
          return (
            <span className="text-right text-sm font-medium text-foreground">
              {formatCurrency(row.original.balanceAfter, row.original.currency)}
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
  const summaryMetrics = useMemo(() => {
    let totalCredit = 0
    let totalDebit = 0
    for (const item of statements) {
      const amt = Number(item.amount) || 0
      if (item.type === "CREDIT") {
        totalCredit += amt
      } else {
        totalDebit += amt
      }
    }
    return {
      totalCredit,
      totalDebit,
    }
  }, [statements])

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/${locale}/console/billing`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold">
              {transactionMessages.heading}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {transactionMessages.description}
          </p>
        </div>
        <div>
          <Button
            onClick={() => setTopUpOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" weight="bold" />
            {transactionMessages.topUpCta}
          </Button>
        </div>
      </header>

      {/* Summary Cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {transactionMessages.currentBalance}
            </CardTitle>
            <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <div className="text-2xl font-bold text-foreground">
                {account?.formattedBalance ??
                  formatCurrency(
                    statements[0]?.balanceAfter ?? 0,
                    account?.currency ?? "IDR"
                  )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {transactionMessages.totalCredit}
            </CardTitle>
            <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <TrendUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                +
                {formatCurrency(
                  summaryMetrics.totalCredit,
                  account?.currency ?? "IDR"
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {transactionMessages.totalDebit}
            </CardTitle>
            <div className="rounded-md bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400">
              <TrendDown className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <div className="text-2xl font-bold text-foreground">
                −
                {formatCurrency(
                  summaryMetrics.totalDebit,
                  account?.currency ?? "IDR"
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Invoices Shortcut Helper */}
      <div className="flex flex-col items-start justify-between gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-background p-2 text-muted-foreground shadow-sm">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {transactionMessages.invoicesShortcut}
            </p>
            <p className="text-xs text-muted-foreground">
              {transactionMessages.invoicesShortcutDesc}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <Link
            href={`/${locale}/console/billing/invoices`}
            className="flex items-center gap-1"
          >
            {transactionMessages.viewInvoicesLink}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

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
              pageSize={10}
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
      <QuickTopUpDialog
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
        currentBalance={account?.formattedBalance}
        currency={(account?.currency as "IDR" | "USD") || "IDR"}
        lang={locale}
        onSuccess={() => {
          // reload statements data
          eden.api.billing.account.statement.get().then((res) => {
            if (res.data?.ok) {
              if (res.data.account) {
                setAccount(res.data.account as unknown as StatementAccount)
              }
              setStatements(
                (res.data.statements ?? []) as unknown as StatementItem[]
              )
            }
          })
        }}
      />
    </main>
  )
}
