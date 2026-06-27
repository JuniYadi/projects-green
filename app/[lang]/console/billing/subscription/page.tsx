"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getSubscriptions } from "@/lib/billing-client"
import type { BillingSubscriptions } from "@/lib/billing-client"
import { GlobeIcon, RocketLaunchIcon } from "@phosphor-icons/react"

export default function SubscriptionPage() {
  void useParams<{ lang?: string }>()
  const [data, setData] = useState<BillingSubscriptions | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const result = await getSubscriptions()
        setData(result)
      } catch {
        setError("Failed to load subscriptions")
      } finally {
        setIsLoading(false)
      }
    }

    void loadData()
  }, [])

  if (isLoading) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <header className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </main>
    )
  }

  const subscriptions = data?.subscriptions ?? []
  const whatsappSubs = subscriptions.filter((s) => s.packageCode === "WHATSAPP")
  const vpnSubs = subscriptions.filter((s) => s.packageCode === "VPN")
  const appHostingSubs = subscriptions.filter(
    (s) => s.packageCode === "APP_HOSTING"
  )

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">My Subscription</h1>
        <p className="text-sm text-muted-foreground">
          View your current subscription details. Contact admin to modify plans.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* App Hosting */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <RocketLaunchIcon className="h-5 w-5" />
            <CardTitle className="text-base">App Hosting</CardTitle>
          </CardHeader>
          <CardContent>
            {appHostingSubs.length > 0 ? (
              <div className="space-y-3">
                {appHostingSubs.map((sub) => (
                  <div key={sub.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Plan</span>
                      <span className="font-medium">{sub.planCode}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <span className="font-medium">{sub.status}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Billing</span>
                      <span className="font-medium">{sub.billingMode}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No App Hosting subscription
              </p>
            )}
          </CardContent>
        </Card>

        {/* VPN */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <GlobeIcon className="h-5 w-5" />
            <CardTitle className="text-base">VPN</CardTitle>
          </CardHeader>
          <CardContent>
            {vpnSubs.length > 0 ? (
              <div className="space-y-3">
                {vpnSubs.map((sub) => (
                  <div key={sub.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Region</span>
                      <span className="font-medium">{sub.regionCode}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <span className="font-medium">{sub.status}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Monthly Rate
                      </span>
                      <span className="font-medium">
                        {new Intl.NumberFormat("id-ID", {
                          style: "currency",
                          currency: "IDR",
                          minimumFractionDigits: 0,
                        }).format(Number.parseFloat(sub.monthlyRateIdr))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No VPN subscription
              </p>
            )}
          </CardContent>
        </Card>

        {/* WhatsApp */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            <CardTitle className="text-base">WhatsApp</CardTitle>
          </CardHeader>
          <CardContent>
            {whatsappSubs.length > 0 ? (
              <div className="space-y-3">
                {whatsappSubs.map((sub) => (
                  <div key={sub.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Plan</span>
                      <span className="font-medium">{sub.planCode}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <span className="font-medium">{sub.status}</span>
                    </div>
                    {sub.quotaIn != null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Quota In</span>
                        <span className="font-medium">
                          {sub.quotaIn.toLocaleString("id-ID")}
                        </span>
                      </div>
                    )}
                    {sub.quotaOut != null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Quota Out</span>
                        <span className="font-medium">
                          {sub.quotaOut.toLocaleString("id-ID")}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No WhatsApp subscription
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border border-muted bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">
          <strong>Note:</strong> Contact your administrator to upgrade,
          downgrade, or cancel subscriptions.
        </p>
      </div>
    </main>
  )
}
