"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  localizePathname,
  resolveLocaleOrDefault,
} from "@/lib/i18n/pathname"
import {
  activateVpnSubscription,
  getVpnStatus,
  type VpnClientStatus,
  type VpnApiErrorResponse,
} from "@/lib/vpn-client"
import { GlobeIcon, DownloadIcon, ShieldCheckIcon } from "@phosphor-icons/react"

type PageState =
  | { phase: "loading" }
  | { phase: "inactive"; monthlyPrice: string; currency: string }
  | { phase: "error"; error: string; topupUrl: string | null }
  | { phase: "active"; clients: VpnClientStatus[] }

export default function ConsoleVpnPage() {
  const [state, setState] = useState<PageState>({ phase: "loading" })
  const [activating, setActivating] = useState(false)
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)

  const loadStatus = useCallback(async () => {
    try {
      const status = await getVpnStatus()
      if (status.clients.length > 0) {
        setState({ phase: "active", clients: status.clients })
      } else {
        setState({
          phase: "inactive",
          monthlyPrice: "Rp25.000",
          currency: "IDR",
        })
      }
    } catch {
      setState({
        phase: "inactive",
        monthlyPrice: "Rp25.000",
        currency: "IDR",
      })
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const handleActivate = async () => {
    setActivating(true)
    try {
      await activateVpnSubscription()
      await loadStatus()
    } catch (err: unknown) {
      const error = err as Error & {
        error?: string
        topupUrl?: string
      }
      if (error.error === "INSUFFICIENT_BALANCE") {
        setState({
          phase: "error",
          error: error.message,
          topupUrl: error.topupUrl ?? "/console/billing/topup",
        })
      } else {
        setState({
          phase: "error",
          error:
            error.message ||
            "Failed to activate VPN. Please try again or contact support.",
          topupUrl: null,
        })
      }
    } finally {
      setActivating(false)
    }
  }

  const handleDownload = (clientId: string) => {
    window.location.href = `/api/vpn/clients/${clientId}/download`
  }

  if (state.phase === "loading") {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <header className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">VPN Access</h1>
        <p className="text-sm text-muted-foreground">
          Secure private VPN access for your organization.
        </p>
      </header>

      {state.phase === "error" && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
          {state.topupUrl && (
            <a
              href={localizePathname({
                pathname: state.topupUrl,
                locale,
              })}
              className="mt-2 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Top up balance
            </a>
          )}
        </div>
      )}

      {state.phase === "inactive" ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <GlobeIcon className="h-5 w-5" />
              <CardTitle className="text-base">VPN Indonesia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Region</span>
                  <span className="font-medium">Indonesia</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Provider</span>
                  <span className="font-medium">OpenVPN</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Billing</span>
                  <span className="font-medium">Monthly upfront</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-medium">
                    {state.monthlyPrice} / month
                  </span>
                </div>
              </div>
              <Button
                onClick={handleActivate}
                disabled={activating}
                className="w-full"
              >
                {activating ? "Activating..." : "Activate VPN"}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : state.phase === "active" ? (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5" />
                <CardTitle className="text-base">VPN Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium text-green-600">Active</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Region</span>
                  <span className="font-medium">
                    {state.clients[0]?.regionCode ?? "INDONESIA"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Provider</span>
                  <span className="font-medium">OpenVPN</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Period</span>
                  <span className="font-medium">
                    {state.clients[0]?.currentPeriodStart
                      ? new Date(
                          state.clients[0].currentPeriodStart,
                        ).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "-"}{" "}
                    &ndash;{" "}
                    {state.clients[0]?.currentPeriodEnd
                      ? new Date(
                          state.clients[0].currentPeriodEnd,
                        ).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "-"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-lg border border-muted bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              Your VPN configuration is sensitive. Do not share the downloaded
              file with anyone outside your organization.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {state.clients
              .filter((c) => c.status === "ACTIVE")
              .map((client) => (
                <Button
                  key={client.id}
                  onClick={() => handleDownload(client.id)}
                  variant="default"
                >
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  Download .ovpn
                </Button>
              ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-muted bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">
          <strong>Need help?</strong> Import the downloaded .ovpn file into your
          OpenVPN client application and connect.
        </p>
      </div>
    </main>
  )
}
