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

export function PlatformUsageTrend() {
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
          Failed to load usage trend: {error}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform Usage Trend (30 days)</CardTitle>
      </CardHeader>
      <CardContent>
        {trend.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            No usage data available.
          </p>
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
                  `Rp ${(value / 1000).toFixed(0)}k`
                }
              />
              <Tooltip
                formatter={(value: number) => [
                  `Rp ${value.toLocaleString("id-ID")}`,
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
