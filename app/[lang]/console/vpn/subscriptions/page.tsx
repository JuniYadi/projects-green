"use client"

import { useCallback, useEffect, useState, startTransition } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { listVpnSubscriptions, type VpnSubscription } from "@/lib/vpn-client"

import { VpnMyServices } from "../_components/vpn-my-services"

type PageState =
  | { phase: "loading" }
  | { phase: "ready"; subscriptions: VpnSubscription[] }

export default function ConsoleVpnSubscriptionsPage() {
  const [state, setState] = useState<PageState>({ phase: "loading" })

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
        {/* ponytail: skeleton matching subscription table layout */}
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </>
    )
  }

  const hasSubscriptions = state.subscriptions.length > 0

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">My VPN Subscriptions</h1>
        <p className="text-sm text-muted-foreground">
          View your active and past VPN subscriptions, download config files,
          and manage credentials.
        </p>
      </header>

      {hasSubscriptions ? (
        <section className="space-y-4">
          <VpnMyServices subscriptions={state.subscriptions} onChanged={load} />
        </section>
      ) : (
        /* Empty state: no subscriptions at all */
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            You don&apos;t have any VPN subscriptions yet.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Go to the Dashboard to browse available packages.
          </p>
        </div>
      )}
    </>
  )
}
