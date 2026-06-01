"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useCallback, useEffect, useState } from "react"

interface PaymentStats {
  totalGateways: number
  activeGateways: number
  totalBankAccounts: number
  verifiedBankAccounts: number
  pendingConfirmations: number
  totalProcessed: number
}

type StatsRequestState =
  | { status: "loading" }
  | { status: "success"; data: PaymentStats }
  | { status: "error"; message: string }

export function OverviewTab({ lang }: { lang: string }) {
  const [state, setState] = useState<StatsRequestState>({ status: "loading" })

  const fetchStats = useCallback(async () => {
    try {
      // Fetch stats in parallel
      const [gatewaysRes, bankAccountsRes, confirmationsRes] = await Promise.all([
        fetch("/api/payments/gateways"),
        fetch("/api/payments/bank-accounts"),
        fetch("/api/payments/confirmations"),
      ])

      const gateways = gatewaysRes.ok ? await gatewaysRes.json() : { ok: false }
      const bankAccounts = bankAccountsRes.ok ? await bankAccountsRes.json() : { ok: false }
      const confirmations = confirmationsRes.ok ? await confirmationsRes.json() : { ok: false }

      setState({
        status: "success",
        data: {
          totalGateways: gateways.ok ? gateways.gateways?.length ?? 0 : 0,
          activeGateways: gateways.ok
            ? gateways.gateways?.filter((g: { status: string }) => g.status === "active").length ?? 0
            : 0,
          totalBankAccounts: bankAccounts.ok ? bankAccounts.bankAccounts?.length ?? 0 : 0,
          verifiedBankAccounts: bankAccounts.ok
            ? bankAccounts.bankAccounts?.filter((b: { isVerified: boolean }) => b.isVerified).length ?? 0
            : 0,
          pendingConfirmations: confirmations.ok ? confirmations.confirmations?.length ?? 0 : 0,
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

  const { data } = state

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
    </div>
  )
}
