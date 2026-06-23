"use client"

import { useCallback, useEffect, useMemo, useState, startTransition } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { listVpnSubscriptions, type VpnSubscription } from "@/lib/vpn-client"

import { VpnMyServices } from "../_components/vpn-my-services"
import {
  VpnSubscriptionFilter,
  type FilterState,
  type RegionOption,
} from "../_components/vpn-subscription-filter"

type PageState =
  | { phase: "loading" }
  | { phase: "ready"; subscriptions: VpnSubscription[] }

/** ponytail: unique regions from loaded subscription data, not a separate API */
function extractRegions(subs: VpnSubscription[]): RegionOption[] {
  const seen = new Set<string>()
  const regions: RegionOption[] = []
  for (const sub of subs) {
    for (const sa of sub.serverAccounts) {
      if (sa.region && !seen.has(sa.region.slug)) {
        seen.add(sa.region.slug)
        regions.push(sa.region)
      }
    }
  }
  return regions
}

function applyFilters(
  subscriptions: VpnSubscription[],
  filters: FilterState,
): VpnSubscription[] {
  if (!filters.regionSlug && !filters.search) return subscriptions
  return subscriptions
    .map((sub) => {
      // Filter server accounts, not whole subscriptions
      const filtered = sub.serverAccounts.filter((sa) => {
        const matchesRegion =
          !filters.regionSlug || sa.region?.slug === filters.regionSlug
        const q = filters.search.toLowerCase()
        const matchesSearch =
          !filters.search ||
          sa.serverName.toLowerCase().includes(q) ||
          (sa.hostname ?? "").toLowerCase().includes(q) ||
          sa.ipAddress?.toLowerCase().includes(q)
        return matchesRegion && matchesSearch
      })
      return { ...sub, serverAccounts: filtered }
    })
    .filter((sub) => sub.serverAccounts.length > 0)
}

export default function ConsoleVpnSubscriptionsPage() {
  const [state, setState] = useState<PageState>({ phase: "loading" })
  const [filters, setFilters] = useState<FilterState>({
    regionSlug: null,
    search: "",
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

  // ponytail: all region filter options derived from subscriptions on the client
  const regionOptions = useMemo(
    () => (state.phase === "ready" ? extractRegions(state.subscriptions) : []),
    [state],
  )

  const hasActiveFilters = filters.regionSlug !== null || filters.search !== ""

  const handleClearFilters = () => {
    setFilters({ regionSlug: null, search: "" })
  }

  if (state.phase === "loading") {
    return (
      <>
        <header className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </header>
        {/* ponytail: skeleton matching new card layout */}
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-56 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
        </div>
      </>
    )
  }

  const hasSubscriptions = state.subscriptions.length > 0
  const visible = applyFilters(state.subscriptions, filters)
  const hasVisible = visible.length > 0

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">My VPN Subscriptions</h1>
        <p className="text-sm text-muted-foreground">
          View your active and past VPN subscriptions, download config files,
          and manage credentials.
        </p>
      </header>

      {hasSubscriptions && (
        <section className="space-y-4">
          <VpnSubscriptionFilter
            regions={regionOptions}
            onFilterChange={setFilters}
          />
        </section>
      )}

      {hasVisible ? (
        <section className="space-y-4">
          <VpnMyServices
            subscriptions={visible}
            onChanged={load}
          />
        </section>
      ) : hasSubscriptions ? (
        /* Filter with no results */
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No matching servers.
          </p>
          {hasActiveFilters && (
            <Button
              variant="link"
              className="mt-1 h-auto p-0 text-sm"
              onClick={handleClearFilters}
            >
              Clear filters
            </Button>
          )}
        </div>
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
