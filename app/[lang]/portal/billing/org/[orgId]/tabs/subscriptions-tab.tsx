"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SubscriptionManager } from "@/components/billing/admin/subscription-manager"
import {
  getAdminSubscriptions,
  type AdminSubscriptionItem,
} from "@/lib/billing-client"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

type SubscriptionsTabProps = {
  orgId: string
}

export function SubscriptionsTab({ orgId }: SubscriptionsTabProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pPortalBillingOrgTabsSubscriptionsTab
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionItem[]>(
    []
  )
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAdminSubscriptions({ orgId })
      .then((res) => setSubscriptions(res.subscriptions))
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [orgId])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
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

  // Map AdminSubscriptionItem to SubscriptionItem for SubscriptionManager
  const mappedSubscriptions = subscriptions.map((sub) => ({
    id: sub.id,
    packageCode: sub.packageCode,
    planCode: sub.planCode,
    regionCode: sub.regionCode,
    billingMode: sub.billingMode,
    type: sub.type,
    status: sub.status,
    allocatedConfig: sub.allocatedConfig,
    monthlyRateIdr: sub.monthlyRateIdr,
    currentPeriodEnd: sub.currentPeriodEnd,
  }))

  return <SubscriptionManager subscriptions={mappedSubscriptions} />
}
