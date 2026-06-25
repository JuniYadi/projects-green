"use client"

import Link from "next/link"
import { startTransition, useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { listVpnPackages, type VpnPackageSummary } from "@/lib/vpn-client"

import { VpnPackageComparison } from "../_components/vpn-package-comparison"
import { VpnPackages } from "../_components/vpn-packages"

type PageState =
  | { phase: "loading" }
  | { phase: "ready"; packages: VpnPackageSummary[] }

const protocolBenefits = [
  {
    protocol: "WireGuard",
    bestFor: "Fast daily VPN",
    benefit: "Modern protocol with quick reconnects and low battery usage.",
    useWhen: "Choose this for phones, laptops, and normal browsing.",
  },
  {
    protocol: "OpenVPN",
    bestFor: "Compatibility",
    benefit: "Mature protocol supported by many VPN clients and networks.",
    useWhen: "Choose this when WireGuard is blocked or unsupported.",
  },
  {
    protocol: "Proxy",
    bestFor: "App-specific routing",
    benefit: "Simple credentials for routing selected apps or tools only.",
    useWhen: "Choose this when you do not need full-device VPN routing.",
  },
]

function ProtocolBenefits() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">Protocol Benefits</h2>
        <p className="text-sm text-muted-foreground">
          Packages can include multiple connection methods. Pick the package
          based on the protocols your devices and workflows need.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {protocolBenefits.map((item) => (
          <Card key={item.protocol} size="sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>{item.protocol}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {item.bestFor}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{item.benefit}</p>
              <p className="text-sm font-medium">{item.useWhen}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

export default function ConsoleVpnOrderPage() {
  const [state, setState] = useState<PageState>({ phase: "loading" })
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const topupUrl = localizePathname({
    pathname: "/console/billing/topup",
    locale,
  })

  const load = useCallback(async () => {
    try {
      const packages = await listVpnPackages()
      startTransition(() => {
        setState({ phase: "ready", packages })
      })
    } catch {
      startTransition(() => {
        setState({ phase: "ready", packages: [] })
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
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-96" />
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-80" />
      </>
    )
  }

  return (
    <>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Order VPN Package</h1>
          <p className="text-sm text-muted-foreground">
            Compare coverage, protocols, and pricing before choosing a VPN
            package.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={topupUrl}>Top Up</Link>
        </Button>
      </header>

      {state.packages.length > 0 ? (
        <>
          <ProtocolBenefits />

          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-medium">Recommended for You</h2>
              <p className="text-sm text-muted-foreground">
                Pick a package by coverage first, then inspect the server list
                before buying.
              </p>
            </div>
            <VpnPackages
              topupUrl={topupUrl}
              onPurchased={load}
              packages={state.packages}
              variant="order"
            />
          </section>

          <section>
            <VpnPackageComparison packages={state.packages} />
          </section>
        </>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No VPN packages are available right now.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  )
}
