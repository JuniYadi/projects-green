"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

import { SubscriptionManager } from "@/components/billing/admin/subscription-manager"
import {
  getAdminSubscriptions,
  type AdminSubscriptionItem,
} from "@/lib/billing-client"

export function SubscriptionsTab() {
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadSubscriptions() {
      try {
        const response = await getAdminSubscriptions({ limit: 50 })
        setSubscriptions(response.subscriptions)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load subscriptions"
        )
      } finally {
        setIsLoading(false)
      }
    }

    loadSubscriptions()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
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
    <div className="space-y-4">
      <SubscriptionManager subscriptions={subscriptions} />
    </div>
  )
}