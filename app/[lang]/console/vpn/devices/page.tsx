"use client"

import { useCallback, useEffect, useState, startTransition } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  listMobileDevices,
  revokeMobileDevice,
  type MobileDeviceEntry,
} from "@/lib/vpn-mobile-client"
import {
  listVpnSubscriptions,
  type VpnSubscription,
} from "@/lib/vpn-client"

import { VpnDevicesList } from "../_components/vpn-devices-list"
import { VpnPairingQrModal } from "@/modules/vpn/_components/vpn-pairing-qr-modal"
import { DeviceMobileIcon } from "@phosphor-icons/react"

type PageState =
  | { phase: "loading" }
  | {
      phase: "ready"
      devices: MobileDeviceEntry[]
      subscriptions: VpnSubscription[]
    }
  | { phase: "error"; message: string }

export default function ConsoleVpnDevicesPage() {
  const [state, setState] = useState<PageState>({ phase: "loading" })
  const [revoking, setRevoking] = useState<string | null>(null)
  const [pairOpen, setPairOpen] = useState(false)

  const load = useCallback(async () => {
    setState({ phase: "loading" })
    try {
      const [devices, subscriptions] = await Promise.all([
        listMobileDevices(),
        listVpnSubscriptions(),
      ])
      const activeSubs = subscriptions.filter((s) => s.status === "ACTIVE")
      startTransition(() => {
        setState({ phase: "ready", devices, subscriptions: activeSubs })
      })
    } catch (error) {
      startTransition(() => {
        setState({
          phase: "error",
          message:
            error instanceof Error ? error.message : "Failed to load devices.",
        })
      })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleRevoke = useCallback(
    async (deviceId: string) => {
      setRevoking(deviceId)
      try {
        await revokeMobileDevice(deviceId)
        setState((prev) =>
          prev.phase === "ready"
            ? {
                ...prev,
                devices: prev.devices.map((d) =>
                  d.id === deviceId
                    ? {
                        ...d,
                        status: "REVOKED" as const,
                        revokedAt: new Date().toISOString(),
                      }
                    : d
                ),
              }
            : prev
        )
      } catch {
        await load()
      } finally {
        setRevoking(null)
      }
    },
    [load]
  )

  if (state.phase === "loading") {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <header className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </header>
        <Skeleton className="h-64" />
      </main>
    )
  }

  if (state.phase === "error") {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">My VPN Devices</h1>
          <p className="text-sm text-muted-foreground">
            Devices paired to your VPN subscriptions.
          </p>
        </header>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-destructive">{state.message}</p>
          <Button className="mt-4" onClick={load}>
            Retry
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">My VPN Devices</h1>
        <p className="text-sm text-muted-foreground">
          View and manage devices paired to your VPN subscriptions.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => setPairOpen(true)}
          disabled={state.subscriptions.length === 0}
        >
          <DeviceMobileIcon className="mr-2 h-4 w-4" />
          Pair New Device
        </Button>
      </div>

      {state.subscriptions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          You need an active VPN subscription to pair a device.{" "}
          <a className="underline" href="../subscriptions">
            View subscriptions
          </a>
        </p>
      )}

      <VpnDevicesList
        devices={state.devices}
        onRevoke={handleRevoke}
        revoking={revoking}
      />

      {pairOpen && state.subscriptions.length > 0 && (
        <VpnPairingQrModal
          open={pairOpen}
          onOpenChange={setPairOpen}
          subscriptionId={state.subscriptions[0].id}
          subscriptionName={state.subscriptions[0].packageName}
          availableSubscriptions={state.subscriptions}
          onPaired={load}
        />
      )}
    </main>
  )
}
