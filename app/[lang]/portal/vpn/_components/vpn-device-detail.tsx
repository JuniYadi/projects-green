"use client"

import { useParams } from "next/navigation"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

import type { AdminDeviceEntry } from "./vpn-devices-table"

type Props = {
  device: AdminDeviceEntry
  onRevoke: (deviceId: string) => void
  onBack: () => void
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> =
  {
    ACTIVE: "default",
    SUSPENDED: "secondary",
    REVOKED: "destructive",
  }

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  )
}

export function VpnDeviceDetail({ device, onRevoke, onBack }: Props) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pPortalVpnVpnDeviceDetail

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{device.deviceName}</CardTitle>
            <CardDescription>
              {t.deviceIdLabel.replace("{id}", device.id)}
            </CardDescription>
          </div>
          <Badge variant={STATUS_VARIANT[device.status] ?? "outline"}>
            {device.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <DetailRow label={t.platform} value={device.platform} />
          <DetailRow label={t.osVersion} value={device.osVersion} />
          <DetailRow label={t.pairedVia} value={device.pairedVia} />
          <DetailRow label={t.pairedAt} value={device.pairedAt} />
          <DetailRow label={t.lastSeen} value={device.lastSeenAt} />
          <DetailRow label={t.subscription} value={device.subscriptionId} />
          <DetailRow
            label={t.organization}
            value={device.organizationName ?? device.organizationId}
          />
          {device.status === "REVOKED" && (
            <>
              <DetailRow label={t.revokedAt} value={device.revokedAt} />
              <DetailRow label={t.revokedReason} value={device.revokedReason} />
            </>
          )}
        </div>

        {device.status !== "REVOKED" && (
          <div className="mt-6 flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onRevoke(device.id)}
            >
              {t.revokeDevice}
            </Button>
            <Button variant="outline" size="sm" onClick={onBack}>
              {t.backToList}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
