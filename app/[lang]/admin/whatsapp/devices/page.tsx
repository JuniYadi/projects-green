"use client"

import * as React from "react"
import Link from "next/link"
import { Phone, ArrowsClockwise, WarningCircle } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

type AdminDevice = {
  id: string
  organizationId: string
  phoneNumber: string
  status: string
  balance: number
  quotaBase: number
  dailyLimitMessage: number
  createdAt: string
  updatedAt: string
}

export default function AdminDevicesPage() {
  const [devices, setDevices] = React.useState<AdminDevice[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const loadDevices = React.useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/admin/devices")
      const body = await res.json()

      if (!body.ok) {
        throw new Error(body.message || "Failed to load devices.")
      }

      setDevices(body.devices)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load devices.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    ;(async () => {
      await loadDevices()
    })()
  }, [loadDevices])

  // ── Loading skeleton ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Devices (Admin)
          </h1>
          <p className="text-muted-foreground">
            Manage all WhatsApp devices across organizations.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Devices</CardTitle>
            <CardDescription>
              Loading device list...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Devices (Admin)
          </h1>
          <p className="text-muted-foreground">
            Manage all WhatsApp devices across organizations.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Devices</CardTitle>
            <CardDescription>Device list</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <WarningCircle className="mb-3 size-10 text-destructive" />
              <p className="mb-2 text-sm text-destructive" role="alert">
                {error}
              </p>
              <Button variant="outline" onClick={() => void loadDevices()}>
                <ArrowsClockwise className="mr-2 size-4" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Devices (Admin)</h1>
        <p className="text-muted-foreground">
          Manage all WhatsApp devices across organizations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Devices</CardTitle>
          <CardDescription>
            {devices.length} device{devices.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Phone className="mb-3 size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No devices found
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Devices will appear here once they are created by organizations.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <Link
                      href={`/admin/whatsapp/devices/${device.id}`}
                      className="font-medium hover:underline"
                    >
                      {device.phoneNumber}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      Org:{" "}
                      <code className="rounded bg-muted px-1 text-xs">
                        {device.organizationId.slice(0, 12)}...
                      </code>{" "}
                      &middot; Balance:{" "}
                      {new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        minimumFractionDigits: 0,
                      }).format(device.balance)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      device.status === "ACTIVE" ? "default" : "secondary"
                    }
                  >
                    {device.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
