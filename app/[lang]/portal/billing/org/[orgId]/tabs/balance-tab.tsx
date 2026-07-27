"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { WalletIcon, WarningIcon } from "@phosphor-icons/react"
import type { AdminOrgDetail } from "@/lib/billing-client"
import { formatBillingMoney } from "@/modules/billing/format-money"

type BalanceTabProps = {
  orgId: string
  lang?: string
  orgDetail: AdminOrgDetail
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(dateStr))
}

const LOW_BALANCE_THRESHOLDS: Record<string, { warn: number; danger: number }> =
  {
    IDR: { warn: 10_000, danger: 1_000 },
    USD: { warn: 5, danger: 1 },
  }

function getBalanceColor(balance: string, currency: string): string {
  const value = Number.parseFloat(balance)
  const thresholds =
    LOW_BALANCE_THRESHOLDS[currency] ?? LOW_BALANCE_THRESHOLDS.IDR
  if (value >= thresholds.warn) return "text-green-600 dark:text-green-400"
  if (value >= thresholds.danger) return "text-yellow-600 dark:text-yellow-400"
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
            className={`text-3xl font-bold ${getBalanceColor(org.balance, org.currency)}`}
          >
            {formatBillingMoney(org.balance, org.currency)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Currency: {org.currency} | Status: {org.status}
          </p>

          {Number(org.balance) <
            (LOW_BALANCE_THRESHOLDS[org.currency] ?? LOW_BALANCE_THRESHOLDS.IDR)
              .danger && (
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
                      {formatBillingMoney(invoice.totalAmountIdr, org.currency)}
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
