"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"

interface UsageBreakdown {
  category: string
  quantity: number
  totalCost: number
  percentage: number
}

interface DailyTrend {
  date: string
  amount: number
}

export default function UsagePage() {
  const [breakdown, setBreakdown] = useState<UsageBreakdown[]>([])
  const [trend, setTrend] = useState<DailyTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [breakdownRes, trendRes] = await Promise.all([
          fetch("/api/billing/usage/breakdown"),
          fetch("/api/billing/usage/trend?days=30"),
        ])

        if (!breakdownRes.ok || !trendRes.ok) {
          throw new Error("Failed to fetch usage data")
        }

        const breakdownData = await breakdownRes.json()
        const trendData = await trendRes.json()

        setBreakdown(breakdownData.data.breakdown)
        setTrend(trendData.data.trend)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  const totalCost = breakdown.reduce((sum, item) => sum + item.totalCost, 0)

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <h1 className="text-2xl font-bold">Usage & Costs</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Rp {totalCost.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cost by Service</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {breakdown.map((item) => (
                <div key={item.category} className="flex items-center">
                  <div className="flex-1">
                    <div className="text-sm font-medium capitalize">
                      {item.category}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {item.quantity} events
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      Rp {item.totalCost.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {item.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Trend (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trend}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string) =>
                    new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
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
                    `Rp ${value.toLocaleString()}`,
                    "Cost",
                  ]}
                  labelFormatter={(label: string) =>
                    new Date(label).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  }
                />
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
