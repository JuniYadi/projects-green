"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  WalletIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import type { AdminOrgDetail } from "@/lib/billing-client"

type BalanceTabProps = {
  orgId: string
  lang?: string
  orgDetail: AdminOrgDetail
}

function formatCurrency(amount: string): string {
  return `Rp ${Number(amount).toLocaleString("id-ID")}`
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(dateStr))
}

function getBalanceColor(balance: string): string {
  const value = Number.parseFloat(balance)
  if (value >= 10_000) return "text-green-600 dark:text-green-400"
  if (value >= 1_000) return "text-yellow-600 dark:text-yellow-400"
  return "text-red-600 dark:text-red-400"
}

export function BalanceTab({ orgDetail }: BalanceTabProps) {
  const org = orgDetail.org

  return (
    <div className="space-y-4">
      {/* Balance Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Balance</CardTitle>
          <WalletIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div
            className={`text-3xl font-bold ${getBalanceColor(org.balance)}`}
          >
            {formatCurrency(org.balance)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Currency: {org.currency} | Status: {org.status}
          </p>

          {Number(org.balance) < 1000 && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-yellow-500/20 bg-yellow-500/10 p-3">
              <WarningIcon className="h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                Balance is running low. Top up to avoid service interruption.
              </p>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Recent Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            Recent Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {org.recentInvoices.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No invoices found.
            </p>
          ) : (
            <div className="space-y-3">
              {org.recentInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">{invoice.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(invoice.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatCurrency(invoice.totalAmountIdr)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {invoice.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
