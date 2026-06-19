"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"

import { startTransition } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { listVpnSubscriptions, type VpnSubscription } from "@/lib/vpn-client"

import { VpnPackages } from "../_components/vpn-packages"
import { VpnMyServices } from "../_components/vpn-my-services"

type PageState =
  | { phase: "loading" }
  | { phase: "ready"; subscriptions: VpnSubscription[] }

export default function ConsoleVpnDashboardPage() {
  const [state, setState] = useState<PageState>({ phase: "loading" })
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const topupUrl = localizePathname({
    pathname: "/console/billing/topup",
    locale,
  })

  const load = useCallback(async () => {
    try {
      const subscriptions = await listVpnSubscriptions()
      startTransition(() => {
        setState({ phase: "ready", subscriptions })
      })
    } catch {
      startTransition(() => {
        setState({ phase: "ready", subscriptions: [] })
      })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (state.phase === "loading") {
    return (
      <>
        <header className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      </>
    )
  }

  const hasSubscriptions = state.subscriptions.length > 0

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">VPN Packages</h1>
        <p className="text-sm text-muted-foreground">
          Pick a package, pay from your balance, and get credentials for every
          protocol immediately.
        </p>
      </header>

      {hasSubscriptions && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">My VPN Subscriptions</h2>
          <VpnMyServices subscriptions={state.subscriptions} onChanged={load} />
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-medium">
          {hasSubscriptions ? "Add another package" : "Available packages"}
        </h2>
        <VpnPackages topupUrl={topupUrl} onPurchased={load} />
      </section>

      <div className="rounded-lg border border-muted bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">
          <strong>Need help?</strong> Download the config for each protocol and
          import it into the matching client app (OpenVPN Connect, WireGuard, or
          your proxy settings).
        </p>
      </div>
    </>
  )
}
