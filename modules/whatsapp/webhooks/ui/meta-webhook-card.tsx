"use client"

import * as React from "react"
import { ArrowsClockwise, CheckCircle, Warning } from "@phosphor-icons/react"
import { toast } from "sonner"
import { WhatsAppText } from "@/modules/whatsapp/ui/whatsapp-text"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export type MetaWebhookSyncState = {
  active: boolean
  status: string
  metaAppId?: string | null
  metaAppName?: string | null
  tokenSource?: string | null
  effectiveVersion?: string | null
  subscribedApps?: Array<{ id: string; name?: string }>
  lastCheckedAt?: string | null
  warning?: string | null
}

export type MetaWebhookInfo = {
  appName: string
  callbackUrl: string
  deviceId?: string
  apiBasePath?: string
  syncState?: MetaWebhookSyncState | null
}

type MetaWebhookCardProps = {
  metaWebhook: MetaWebhookInfo | null
  deviceId?: string
  apiBasePath?: string
}
function MetaWebhookRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1 border-b pb-3 last:border-0 last:pb-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm font-medium">{children}</dd>
    </div>
  )
}

export function MetaWebhookCard({
  metaWebhook,
  deviceId: propDeviceId,
  apiBasePath: propApiBasePath,
}: MetaWebhookCardProps) {
  const deviceId = propDeviceId || metaWebhook?.deviceId
  const apiBasePath =
    propApiBasePath || metaWebhook?.apiBasePath || "/api/whatsapp/devices"
  const [syncStateOverride, setSyncStateOverride] =
    React.useState<MetaWebhookSyncState | null>(null)
  const [syncing, setSyncing] = React.useState(false)

  const syncState = syncStateOverride ?? metaWebhook?.syncState ?? null

  const handleSync = async () => {
    if (!deviceId) return
    setSyncing(true)
    try {
      const res = await fetch(`${apiBasePath}/${deviceId}/sync-webhook`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Failed to sync webhook")
      }
      setSyncStateOverride(data.data)
      toast.success("Webhook subscription verified successfully.")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sync webhook"
      toast.error(msg)
    } finally {
      setSyncing(false)
    }
  }

  const isSubscribed = syncState?.status === "SUBSCRIBED"
  const isMismatch = syncState?.status === "TOKEN_APP_MISMATCH"

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-base">Meta Webhook Setup</CardTitle>
          <CardDescription className="text-xs">
            <WhatsAppText id="s279" />
          </CardDescription>
        </div>
        {deviceId && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="gap-1.5 text-xs"
          >
            <ArrowsClockwise
              className={`size-3.5 ${syncing ? "animate-spin" : ""}`}
            />
            {syncing ? "Checking..." : "Verify Webhook"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {metaWebhook ? (
          <>
            {isMismatch && (
              <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
                <Warning className="size-4 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  Token Application Mismatch
                </AlertTitle>
                <AlertDescription className="text-xs text-amber-800/90 dark:text-amber-300/90">
                  {syncState?.warning ||
                    "Access token belongs to another Meta App. WABA is not receiving webhooks for this device."}
                </AlertDescription>
              </Alert>
            )}

            <dl className="space-y-3">
              <MetaWebhookRow label="Meta App">
                <div className="flex items-center gap-2">
                  <span>{metaWebhook.appName}</span>
                  {syncState && (
                    <Badge
                      variant={
                        isSubscribed
                          ? "outline"
                          : isMismatch
                            ? "secondary"
                            : "outline"
                      }
                      className={`text-[10px] ${
                        isSubscribed
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : isMismatch
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : ""
                      }`}
                    >
                      {isSubscribed ? (
                        <>
                          <CheckCircle className="mr-1 size-3" />
                          Subscribed (Active)
                        </>
                      ) : isMismatch ? (
                        <>
                          <Warning className="mr-1 size-3" />
                          Token Mismatch
                        </>
                      ) : (
                        syncState.status
                      )}
                    </Badge>
                  )}
                </div>
              </MetaWebhookRow>

              <MetaWebhookRow label="Callback URL">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs break-all">
                  {metaWebhook.callbackUrl}
                </code>
              </MetaWebhookRow>

              {syncState?.subscribedApps &&
                syncState.subscribedApps.length > 0 && (
                  <MetaWebhookRow label="Subscribed Meta Apps">
                    <div className="flex flex-wrap gap-1.5">
                      {syncState.subscribedApps.map((app) => (
                        <Badge
                          key={app.id}
                          variant="outline"
                          className="font-mono text-[10px]"
                        >
                          {app.name ? `${app.name} (${app.id})` : app.id}
                        </Badge>
                      ))}
                    </div>
                  </MetaWebhookRow>
                )}
            </dl>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            <WhatsAppText id="s280" />
          </p>
        )}
      </CardContent>
    </Card>
  )
}
