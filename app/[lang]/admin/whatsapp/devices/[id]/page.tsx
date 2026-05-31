"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  WarningCircle,
  ArrowsClockwise,
  Bank,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

type AdminDeviceDetail = {
  id: string
  organizationId: string
  phoneNumber: string
  status: string
  balance: number
  quotaBase: number
  quotaBaseIn: number
  quotaBaseOut: number
  dailyLimitMessage: number
  whatsappBusinessAccountId: string | null
  whatsappPhoneId: string | null
  callbackUrl: string | null
  expiredAt: string | null
  createdAt: string
  updatedAt: string
}

export default function AdminDeviceDetailPage() {
  const params = useParams()
  const deviceId = params.id as string

  const [device, setDevice] = React.useState<AdminDeviceDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Top-up form
  const [topUpAmount, setTopUpAmount] = React.useState(0)
  const [topUpReason, setTopUpReason] = React.useState("")
  const [toppingUp, setToppingUp] = React.useState(false)

  const loadDevice = React.useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/devices/${deviceId}`)
      const body = await res.json()

      if (!body.ok) {
        throw new Error(body.message || "Failed to load device.")
      }

      setDevice(body.device)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load device.")
    } finally {
      setLoading(false)
    }
  }, [deviceId])

  React.useEffect(() => {
    ;(async () => {
      await loadDevice()
    })()
  }, [loadDevice])

  const handleTopUp = async () => {
    if (topUpAmount <= 0) {
      toast.error("Amount must be greater than 0.")
      return
    }

    if (!topUpReason.trim()) {
      toast.error("Reason is required.")
      return
    }

    setToppingUp(true)

    try {
      const res = await fetch(`/api/admin/devices/${deviceId}/top-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: topUpAmount,
          reason: topUpReason,
        }),
      })

      const body = await res.json()

      if (!body.ok) {
        throw new Error(body.message || "Top-up failed.")
      }

      toast.success(
        `Balance topped up by ${new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          minimumFractionDigits: 0,
        }).format(topUpAmount)}.`,
      )

      setTopUpAmount(0)
      setTopUpReason("")
      void loadDevice()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Top-up failed.",
      )
    } finally {
      setToppingUp(false)
    }
  }

  // ── Loading skeleton ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <Skeleton className="h-5 w-32" />
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <Button asChild variant="ghost" size="sm" className="w-fit px-0">
          <Link href="/admin/whatsapp/devices">
            <ArrowLeft className="mr-1 size-4" />
            Back to Devices
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Device Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <WarningCircle className="mb-3 size-10 text-destructive" />
              <p className="mb-2 text-sm text-destructive" role="alert">
                {error}
              </p>
              <Button variant="outline" onClick={() => void loadDevice()}>
                <ArrowsClockwise className="mr-2 size-4" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!device) {
    return null
  }

  // ── Main render ────────────────────────────────────────────────────────

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)

  const formatDate = (date: string | null) => {
    if (!date) return "N/A"
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(date))
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <Button asChild variant="ghost" size="sm" className="w-fit px-0">
        <Link href="/admin/whatsapp/devices">
          <ArrowLeft className="mr-1 size-4" />
          Back to Devices
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {device.phoneNumber}
        </h1>
        <p className="text-muted-foreground">
          Admin device management
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Device Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Device Information</CardTitle>
            <CardDescription>
              Core device details and status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex items-center justify-between border-b pb-3">
                <dt className="text-sm text-muted-foreground">Status</dt>
                <dd>
                  <Badge
                    variant={
                      device.status === "ACTIVE" ? "default" : "secondary"
                    }
                  >
                    {device.status}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between border-b pb-3">
                <dt className="text-sm text-muted-foreground">
                  Organization ID
                </dt>
                <dd>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {device.organizationId}
                  </code>
                </dd>
              </div>
              <div className="flex items-center justify-between border-b pb-3">
                <dt className="text-sm text-muted-foreground">
                  WhatsApp Business Account ID
                </dt>
                <dd className="text-sm font-medium">
                  {device.whatsappBusinessAccountId || "-"}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b pb-3">
                <dt className="text-sm text-muted-foreground">
                  WhatsApp Phone ID
                </dt>
                <dd className="text-sm font-medium">
                  {device.whatsappPhoneId || "-"}
                </dd>
              </div>
              <div className="flex items-center justify-between pb-3">
                <dt className="text-sm text-muted-foreground">Callback URL</dt>
                <dd className="text-sm font-medium">
                  {device.callbackUrl || "-"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Balance & Quota */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Balance & Quota</CardTitle>
            <CardDescription>
              Current balance and usage limits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex items-center justify-between border-b pb-3">
                <dt className="text-sm text-muted-foreground">Balance</dt>
                <dd className="text-lg font-bold text-green-600">
                  {formatCurrency(device.balance)}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b pb-3">
                <dt className="text-sm text-muted-foreground">Quota Base</dt>
                <dd className="text-sm font-medium">
                  {device.quotaBase.toLocaleString()}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b pb-3">
                <dt className="text-sm text-muted-foreground">
                  Quota Base In
                </dt>
                <dd className="text-sm font-medium">
                  {device.quotaBaseIn.toLocaleString()}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b pb-3">
                <dt className="text-sm text-muted-foreground">
                  Quota Base Out
                </dt>
                <dd className="text-sm font-medium">
                  {device.quotaBaseOut.toLocaleString()}
                </dd>
              </div>
              <div className="flex items-center justify-between pb-3">
                <dt className="text-sm text-muted-foreground">
                  Daily Limit
                </dt>
                <dd className="text-sm font-medium">
                  {device.dailyLimitMessage.toLocaleString()}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Timestamps */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timestamps</CardTitle>
            <CardDescription>Creation and activity dates</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex items-center justify-between border-b pb-3">
                <dt className="text-sm text-muted-foreground">Created</dt>
                <dd className="text-sm font-medium">
                  {formatDate(device.createdAt)}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b pb-3">
                <dt className="text-sm text-muted-foreground">Updated</dt>
                <dd className="text-sm font-medium">
                  {formatDate(device.updatedAt)}
                </dd>
              </div>
              <div className="flex items-center justify-between pb-3">
                <dt className="text-sm text-muted-foreground">Expires</dt>
                <dd className="text-sm font-medium">
                  {formatDate(device.expiredAt)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Top Up Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Up Balance</CardTitle>
            <CardDescription>
              Credit balance for this device
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="topup-amount">
                Amount (IDR)
              </Label>
              <Input
                id="topup-amount"
                type="number"
                min={1}
                placeholder="e.g. 100000"
                value={topUpAmount || ""}
                onChange={(e) =>
                  setTopUpAmount(Number(e.target.value))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="topup-reason">Reason</Label>
              <Input
                id="topup-reason"
                placeholder="e.g. Monthly top-up"
                value={topUpReason}
                onChange={(e) => setTopUpReason(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => void handleTopUp()}
              disabled={toppingUp || topUpAmount <= 0 || !topUpReason.trim()}
            >
              <Bank className="mr-2 size-4" />
              {toppingUp ? "Processing..." : "Top Up"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
