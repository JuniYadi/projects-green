"use client"

import { useEffect, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getAdminUsage, type AdminUsageTrend } from "@/lib/billing-client"
import { formatBillingMoney } from "@/modules/billing/format-money"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export function PlatformUsageTrend() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pPortalBillingOverviewPlatformUsageTrend
  const [trend, setTrend] = useState<AdminUsageTrend[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAdminUsage({ days: 30 })
      .then((res) => setTrend(res.data.trend))
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-destructive">
          {t.loadFailed} {error}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {trend.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">{t.noData}</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trend}>
              <XAxis
                dataKey="date"
                tickFormatter={(date: string) =>
                  new Date(date).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                  })
                }
              />
              <YAxis
                tickFormatter={(value: number) =>
                  `IDR ${(value / 1000).toFixed(0)}k`
                }
              />
              <Tooltip
                formatter={(value: number) => [
                  formatBillingMoney(value, "IDR"),
                  "Cost",
                ]}
              />
              <Bar dataKey="amount" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
