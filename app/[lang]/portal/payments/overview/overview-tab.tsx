"use client"

import { eden } from "@/lib/eden"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

interface PaymentStats {
  totalGateways: number
  activeGateways: number
  totalBankAccounts: number
  verifiedBankAccounts: number
  pendingConfirmations: number
  totalProcessed: number
}

interface ConfirmationItem {
  id: string
  amount?: number
  currency?: string
  bankName?: string
  accountName?: string
  accountNumber?: string
  submittedAt?: string
}

type StatsRequestState =
  | { status: "loading" }
  | {
      status: "success"
      data: PaymentStats
      pendingItems: ConfirmationItem[]
    }
  | { status: "error"; message: string }

export function OverviewTab() {
  const [state, setState] = useState<StatsRequestState>({ status: "loading" })

  const fetchStats = useCallback(async () => {
    try {
      // Fetch stats in parallel
      const [gatewaysRes, bankAccountsRes, confirmationsRes] = await Promise.all([
        eden.api.portal.payments.gateways.get(),
        eden.api.portal.payments["bank-accounts"].get(),
        eden.api.portal.payments.confirmations.get(),
      ])

      const gateways = gatewaysRes.data ?? { ok: false }
      const bankAccounts = bankAccountsRes.data ?? { ok: false }
      const confirmations = confirmationsRes.data ?? { ok: false }

      setState({
        status: "success",
        pendingItems: confirmations.ok ? confirmations.data ?? [] : [],
        data: {
          totalGateways: gateways.ok ? gateways.data?.length ?? 0 : 0,
          activeGateways: gateways.ok
            ? gateways.data?.filter((g: { status: string }) => g.status === "active").length ?? 0
            : 0,
          totalBankAccounts: bankAccounts.ok ? bankAccounts.data?.length ?? 0 : 0,
          verifiedBankAccounts: bankAccounts.ok
            ? bankAccounts.data?.filter((b: { isVerified: boolean }) => b.isVerified).length ?? 0
            : 0,
          pendingConfirmations: confirmations.ok ? confirmations.data?.length ?? 0 : 0,
          totalProcessed: 0, // Would need separate API for this
        },
      })
    } catch {
      setState({ status: "error", message: "Failed to load payment stats" })
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchStats()
  }, [fetchStats])

  if (state.status === "loading") {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        {state.message}
      </div>
    )
  }

  const { data, pendingItems } = state

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Payment Gateways
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalGateways}</div>
            <p className="text-xs text-muted-foreground">
              {data.activeGateways} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bank Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalBankAccounts}</div>
            <p className="text-xs text-muted-foreground">
              {data.verifiedBankAccounts} verified
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Confirmations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.pendingConfirmations}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting review
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Use the tabs above to manage payment gateways, bank accounts, and manual payment confirmations.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Pending Confirmations</CardTitle>
          <Link
            href="/portal/payments?tab=confirmations"
            className="text-sm text-primary hover:underline"
          >
            See All →
          </Link>
        </CardHeader>
        <CardContent>
          {pendingItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pending confirmations
            </p>
          ) : (
            <ul className="space-y-3">
              {pendingItems.slice(0, 5).map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-4 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {item.bankName || "Unknown Bank"}
                      {item.accountName
                        ? ` — ${item.accountName}`
                        : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.submittedAt
                        ? new Date(item.submittedAt).toLocaleDateString()
                        : ""}
                    </p>
                  </div>
                  {typeof item.amount === "number" && (
                    <span className="shrink-0 font-medium">
                      {item.currency ?? "IDR"} {item.amount.toLocaleString()}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
