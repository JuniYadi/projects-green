"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { eden } from "@/lib/eden"
import type { VpnSubscription } from "@/lib/vpn-client"

import { VpnMyServices } from "../_components/vpn-my-services"

export default function ConsoleVpnProfilesPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const plansUrl = localizePathname({
    pathname: "/console/billing/services/vpn",
    locale,
  })

  const {
    data: subscriptions = [],
    isLoading,
    refetch,
  } = useQuery<VpnSubscription[]>({
    queryKey: ["vpn", "profiles"],
    queryFn: async () => {
      const res = await (
        eden.api.vpn as unknown as {
          subscriptions: {
            get: () => Promise<{ data?: { ok: boolean; data: unknown } }>
          }
        }
      ).subscriptions.get()
      if (res.data && res.data.ok && Array.isArray(res.data.data)) {
        return res.data.data as VpnSubscription[]
      }
      return []
    },
  })

  if (isLoading) {
    return (
      <>
        <header className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </header>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </>
    )
  }

  const hasSubscriptions = subscriptions.length > 0

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">
          {locale === "id" ? "Profil Akses VPN" : "Access Profiles"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your VPN connection profiles, server locations, and devices.
        </p>
      </header>

      {hasSubscriptions ? (
        <section className="space-y-4">
          <VpnMyServices
            subscriptions={subscriptions}
            onChanged={() => void refetch()}
          />
        </section>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            You don&apos;t have any VPN access profiles yet.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse VPN plans to provision your first access profile.
          </p>
          <Button asChild className="mt-4">
            <Link href={plansUrl}>Browse VPN Plans</Link>
          </Button>
        </div>
      )}
    </>
  )
}
