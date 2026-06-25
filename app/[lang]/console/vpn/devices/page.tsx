"use client"

import { useCallback, useEffect, useState, startTransition } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  listMobileDevices,
  revokeMobileDevice,
  type MobileDeviceEntry,
} from "@/lib/vpn-mobile-client"

import { VpnDevicesList } from "../_components/vpn-devices-list"
import { VpnPairingQrModal } from "../_components/vpn-pairing-qr-modal"
import { DeviceMobileIcon } from "@phosphor-icons/react"

type PageState =
  | { phase: "loading" }
  | { phase: "ready"; devices: MobileDeviceEntry[] }
  | { phase: "error"; message: string }

export default function ConsoleVpnDevicesPage() {
  const [state, setState] = useState<PageState>({ phase: "loading" })
  const [revoking, setRevoking] = useState<string | null>(null)
  const [pairOpen, setPairOpen] = useState(false)

  const load = useCallback(async () => {
    setState({ phase: "loading" })
    try {
      const devices = await listMobileDevices()
      startTransition(() => {
        setState({ phase: "ready", devices })
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
        await load()
      } catch {
        // Refresh anyway to show current state.
        await load()
      } finally {
        setRevoking(null)
      }
    },
    [load]
  )

  if (state.phase === "loading") {
    return (
      <>
        <header className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </header>
        <Skeleton className="h-64" />
      </>
    )
  }

  if (state.phase === "error") {
    return (
      <>
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
      </>
    )
  }

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">My VPN Devices</h1>
        <p className="text-sm text-muted-foreground">
          View and manage devices paired to your VPN subscriptions.
        </p>
      </header>

      <VpnDevicesList
        devices={state.devices}
        onRevoke={handleRevoke}
        revoking={revoking}
      />

      <div>
        <Button
          onClick={() => setPairOpen(true)}
          disabled={state.devices.length === 0}
        >
          <DeviceMobileIcon className="mr-2 h-4 w-4" />
          Pair New Device
        </Button>
      </div>

      {pairOpen && state.devices.length > 0 && (
        <VpnPairingQrModal
          open={pairOpen}
          onOpenChange={setPairOpen}
          subscriptionId={state.devices[0].subscriptionId}
          onPaired={load}
        />
      )}
    </>
  )
}
