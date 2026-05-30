"use client"

import { useState } from "react"
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
  const showResourceSliders =
    isAppHosting && (planCode === "CUSTOM" || billingMode === "PAYG")

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
  const response = await fetch(`/api/billing/admin/subscriptions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  })

  const data = await response.json()

  if (!response.ok || data.ok === false) {
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