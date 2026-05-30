"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PlusIcon } from "@phosphor-icons/react"
import Link from "next/link"

import { BalanceCard } from "@/components/billing/balance-card"
import { getAccount } from "@/lib/billing-client"
import type { BillingAccount } from "@/lib/billing-client"

type OverviewTabProps = {
  lang: string
}

export function OverviewTab({ lang }: OverviewTabProps) {
  const [account, setAccount] = useState<BillingAccount | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadAccount() {
      try {
        const data = await getAccount()
        setAccount(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load account")
      } finally {
        setIsLoading(false)
      }
    }

    loadAccount()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          {error}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <BalanceCard
          balanceIdr={account?.balanceIdr ?? "0"}
          formattedBalance={account?.formattedBalance ?? "IDR 0"}
          isAboveWarn={account?.isAboveWarn ?? false}
          accountAge={account?.accountAge}
        />

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full justify-start">
              <Link href={`/${lang}/portal/billing?tab=subscriptions`}>
                <PlusIcon className="mr-2 h-4 w-4" />
                Manage Subscriptions
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href={`/${lang}/portal/invoices`}>
                View Invoices
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No recent adjustments
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Subscription Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            View all subscriptions in the Subscriptions tab
          </p>
        </CardContent>
      </Card>
    </div>
  )
}