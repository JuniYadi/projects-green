"use client"

import { useState } from "react"
import { eden } from "@/lib/eden"
import { useRouter } from "next/navigation"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ResourceSlider } from "@/components/billing/admin/resource-slider"
import type { SubscriptionItem } from "@/lib/billing-client"

type SubscriptionManagerProps = {
  subscriptions: SubscriptionItem[]
}

type SubscriptionType = "APP_HOSTING" | "VPN" | "WHATSAPP"

const PLAN_OPTIONS = [
  { value: "STARTER", label: "Starter" },
  { value: "BASIC", label: "Basic" },
  { value: "STANDARD", label: "Standard" },
  { value: "PROFESSIONAL", label: "Professional" },
  { value: "CUSTOM", label: "Custom" },
]

const BILLING_MODES = [
  { value: "PACKAGE", label: "Package" },
  { value: "PAYG", label: "Pay-as-you-go" },
]

function getSubscriptionType(type: string): SubscriptionType {
  const normalizedType = type.toUpperCase().replace(/[-_]/g, "_")
  if (normalizedType === "APP_HOSTING") return "APP_HOSTING"
  if (normalizedType === "VPN") return "VPN"
  if (normalizedType === "WHATSAPP") return "WHATSAPP"
  return "APP_HOSTING" // default
}

function getStatusBadgeVariant(status: string): "success" | "warning" | "secondary" | "destructive" {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "success"
    case "PAST_DUE":
    case "PAUSED":
      return "warning"
    case "CANCELED":
    case "EXPIRED":
      return "destructive"
    default:
      return "secondary"
  }
}

function SubscriptionCard({
  subscription,
  onUpdate,
}: {
  subscription: SubscriptionItem
  onUpdate: (id: string, updates: Partial<SubscriptionItem>) => Promise<void>
}) {
  const router = useRouter()
  const [updateState, setUpdateState] = useState<"idle" | "submitting">("idle")

  // Local state for form values
  const [planCode, setPlanCode] = useState(subscription.planCode)
  const [billingMode, setBillingMode] = useState(subscription.billingMode)
  const [cpu, setCpu] = useState(
    (subscription.allocatedConfig?.cpu as number) ?? 500
  )
  const [memory, setMemory] = useState(
    (subscription.allocatedConfig?.memory as number) ?? 512
  )

  const subscriptionType = getSubscriptionType(subscription.type)
  const isAppHosting = subscriptionType === "APP_HOSTING"
  const isVpn = subscriptionType === "VPN"
  const isWhatsApp = subscriptionType === "WHATSAPP"
  const showResourceSliders =
    isAppHosting && (planCode === "CUSTOM" || billingMode === "PAYG")

  // VPN state
  const [vpnRegion, setVpnRegion] = useState(subscription.regionCode || "ID")
  const [vpnStatus, setVpnStatus] = useState(subscription.status)

  // WhatsApp state
  const [waPlan, setWaPlan] = useState(subscription.planCode || "LITE")
  const [waStatus, setWaStatus] = useState(subscription.status)

  async function handleUpdate() {
    setUpdateState("submitting")

    try {
      const updates: Partial<SubscriptionItem> = {
        planCode,
        billingMode,
      }

      if (showResourceSliders) {
        updates.allocatedConfig = { cpu, memory }
      }

      await onUpdate(subscription.id, updates)
      toast.success("Subscription updated successfully")
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update subscription"
      toast.error(message)
    } finally {
      setUpdateState("idle")
    }
  }

  const hasChanges =
    planCode !== subscription.planCode ||
    billingMode !== subscription.billingMode ||
    (showResourceSliders &&
      (cpu !== (subscription.allocatedConfig?.cpu as number) ||
        memory !== (subscription.allocatedConfig?.memory as number)))

  const vpnHasChanges =
    isVpn &&
    (vpnRegion !== subscription.regionCode || vpnStatus !== subscription.status)

  const waHasChanges =
    isWhatsApp &&
    (waPlan !== subscription.planCode || waStatus !== subscription.status)

  async function handleVpnUpdate() {
    setUpdateState("submitting")
    try {
      await onUpdate(subscription.id, {
        regionCode: vpnRegion,
        status: vpnStatus,
      })
      toast.success("VPN subscription updated successfully")
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update VPN subscription"
      toast.error(message)
    } finally {
      setUpdateState("idle")
    }
  }

  async function handleWaUpdate() {
    setUpdateState("submitting")
    try {
      await onUpdate(subscription.id, {
        planCode: waPlan,
        status: waStatus,
      })
      toast.success("WhatsApp subscription updated successfully")
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update WhatsApp subscription"
      toast.error(message)
    } finally {
      setUpdateState("idle")
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="capitalize">
              {subscription.type.replace("_", " ").toLowerCase()}
            </CardTitle>
            <Badge variant={getStatusBadgeVariant(subscription.status)}>
              {subscription.status.replace("_", " ")}
            </Badge>
          </div>
          {subscription.monthlyRateIdr && (
            <span className="text-sm text-muted-foreground">
              {Number.parseFloat(subscription.monthlyRateIdr).toLocaleString(
                "id-ID",
                { style: "currency", currency: "IDR", minimumFractionDigits: 0 }
              )}
              /mo
            </span>
          )}
        </div>
        <CardDescription>
          Package: {subscription.packageCode} | Region: {subscription.regionCode}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAppHosting ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Plan</label>
                <Select value={planCode} onValueChange={setPlanCode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Billing Mode</label>
                <Select value={billingMode} onValueChange={setBillingMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_MODES.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {showResourceSliders && (
              <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
                <ResourceSlider
                  label="CPU"
                  resource="cpu"
                  value={cpu}
                  onChange={setCpu}
                />
                <ResourceSlider
                  label="Memory"
                  resource="memory"
                  value={memory}
                  onChange={setMemory}
                />
              </div>
            )}

            {hasChanges && (
              <Button
                onClick={handleUpdate}
                disabled={updateState === "submitting"}
                className="w-full"
              >
                {updateState === "submitting" ? "Updating..." : "Update Subscription"}
              </Button>
            )}
          </>
        ) : isVpn ? (
          <>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Region</label>
                  <Select value={vpnRegion} onValueChange={setVpnRegion}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ID">🇮🇩 Indonesia</SelectItem>
                      <SelectItem value="SG">🇸🇬 Singapore</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={vpnStatus} onValueChange={setVpnStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="SUSPENDED">Suspended</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Status changes take effect immediately.
              </p>
            </div>

            {vpnHasChanges && (
              <Button
                onClick={handleVpnUpdate}
                disabled={updateState === "submitting"}
                className="w-full"
              >
                {updateState === "submitting" ? "Updating..." : "Update VPN Subscription"}
              </Button>
            )}
          </>
        ) : isWhatsApp ? (
          <>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Plan</label>
                  <Select value={waPlan} onValueChange={setWaPlan}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LITE">Lite</SelectItem>
                      <SelectItem value="STANDARD">Standard</SelectItem>
                      <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                      <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={waStatus} onValueChange={setWaStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="NON_ACTIVE">Non-Active</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {subscription.quotaIn && subscription.quotaOut && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <p>
                    Quota: {subscription.quotaIn} in / {subscription.quotaOut} out
                    per month
                  </p>
                  {subscription.dailyPerDevice && (
                    <p>Daily per device: {subscription.dailyPerDevice}</p>
                  )}
                </div>
              )}
            </div>

            {waHasChanges && (
              <Button
                onClick={handleWaUpdate}
                disabled={updateState === "submitting"}
                className="w-full"
              >
                {updateState === "submitting"
                  ? "Updating..."
                  : "Update WhatsApp Subscription"}
              </Button>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Contact us for pricing and configuration options.
          </p>
        )}

        {subscription.currentPeriodEnd && (
          <p className="text-xs text-muted-foreground">
            Current period ends:{" "}
            {new Date(subscription.currentPeriodEnd).toLocaleDateString("id-ID", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

async function updateSubscription(
  id: string,
  updates: Partial<SubscriptionItem>
): Promise<void> {
  const { data } = await eden.api.billing.admin.subscriptions[id].patch(updates)

  if (!data || data.ok === false) {
    throw new Error(data.message || "Failed to update subscription")
  }
}

export function SubscriptionManager({ subscriptions }: SubscriptionManagerProps) {
  if (subscriptions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No active subscriptions
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {subscriptions.map((subscription) => (
        <SubscriptionCard
          key={subscription.id}
          subscription={subscription}
          onUpdate={updateSubscription}
        />
      ))}

      <p className="text-xs text-muted-foreground text-center">
        Changes take effect at the next billing cycle.
      </p>
    </div>
  )
}