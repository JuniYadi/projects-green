"use client"

import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { WhatsAppText } from "@/modules/whatsapp/ui/whatsapp-text"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function WhatsAppUsageLoading() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params.lang)
  const t = getMessages(locale).console.whatsapp.usage.loading

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              <WhatsAppText id="s44" />
            </CardTitle>
            <Skeleton className="size-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-20" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.inboundCount}
            </CardTitle>
            <Skeleton className="size-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-20" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.outboundCount}
            </CardTitle>
            <Skeleton className="size-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-20" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              <WhatsAppText id="s45" />
            </CardTitle>
            <Skeleton className="size-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-20" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.monthlyQuotaUsed}
            </CardTitle>
            <Skeleton className="size-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-20" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.remainingQuota}
            </CardTitle>
            <Skeleton className="size-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-20" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.projectedCost}
            </CardTitle>
            <Skeleton className="size-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-20" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.balance}</CardTitle>
            <Skeleton className="size-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-20" />
          </CardContent>
        </Card>
      </div>

      <Skeleton className="h-[370px] w-full" />

      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}
