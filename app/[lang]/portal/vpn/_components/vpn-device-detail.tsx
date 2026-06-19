"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{device.deviceName}</CardTitle>
            <CardDescription>Device ID: {device.id}</CardDescription>
          </div>
          <Badge variant={STATUS_VARIANT[device.status] ?? "outline"}>
            {device.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <DetailRow label="Platform" value={device.platform} />
          <DetailRow label="OS Version" value={device.osVersion} />
          <DetailRow label="Paired Via" value={device.pairedVia} />
          <DetailRow label="Paired At" value={device.pairedAt} />
          <DetailRow label="Last Seen" value={device.lastSeenAt} />
          <DetailRow label="Subscription" value={device.subscriptionId} />
          <DetailRow
            label="Organization"
            value={device.organizationName ?? device.organizationId}
          />
          {device.status === "REVOKED" && (
            <>
              <DetailRow label="Revoked At" value={device.revokedAt} />
              <DetailRow label="Revoked Reason" value={device.revokedReason} />
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
              Revoke Device
            </Button>
            <Button variant="outline" size="sm" onClick={onBack}>
              Back to list
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
