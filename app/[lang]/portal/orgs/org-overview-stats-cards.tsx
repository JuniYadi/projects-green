"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  WalletIcon,
  UsersIcon,
  ReceiptIcon,
  LifebuoyIcon,
} from "@phosphor-icons/react"
import { getAdminStats, type AdminStats } from "@/lib/billing-client"

export function OrgOverviewStatsCards() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-destructive">
          Failed to load stats: {error}
        </CardContent>
      </Card>
    )
  }

  if (!stats) return null

  function fmtCurrency(amount: string): string {
    return `Rp ${Number(amount).toLocaleString("id-ID")}`
  }

  const cards = [
    {
      title: "Total Orgs",
      value: stats.activeOrgs.toString(),
      icon: UsersIcon,
    },
    {
      title: "Total Balance",
      value: fmtCurrency(stats.totalBalance),
      icon: WalletIcon,
    },
    {
      title: "Open Invoices",
      value: stats.openInvoices.toString(),
      icon: ReceiptIcon,
    },
    {
      title: "Open Tickets",
      value: stats.openTickets.toString(),
      icon: LifebuoyIcon,
    },
    {
      title: "Total Members",
      value: "\u2014",
      icon: UsersIcon,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))
      }
    </div>
  )
}
