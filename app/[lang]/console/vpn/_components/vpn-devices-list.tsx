"use client"

import { useState } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { MobileDeviceEntry } from "@/lib/vpn-mobile-client"

type Props = {
  devices: MobileDeviceEntry[]
  onRevoke: (deviceId: string) => void
  onRename?: (deviceId: string, name: string) => void
  revoking: string | null
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  SUSPENDED: "secondary",
  REVOKED: "destructive",
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function PlatformBadge({ platform }: { platform: string }) {
  const label =
    platform === "ios"
      ? "iOS"
      : platform === "android"
        ? "Android"
        : platform
  return (
    <Badge variant="outline" className="font-mono text-xs">
      {label}
    </Badge>
  )
}

function RevokeButton({
  device,
  onRevoke,
  revoking,
}: {
  device: MobileDeviceEntry
  onRevoke: (id: string) => void
  revoking: string | null
}) {
  const [open, setOpen] = useState(false)

  if (device.status === "REVOKED") {
    return (
      <Badge variant="outline" className="text-xs">
        Revoked
      </Badge>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-destructive hover:text-destructive"
          disabled={revoking === device.id}
        >
          {revoking === device.id ? "Revoking…" : "Revoke"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke device</DialogTitle>
          <DialogDescription>
            This will disconnect VPN on{" "}
            <span className="font-medium">{device.deviceName}</span>{" "}
            immediately. The device can be re-paired later if needed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setOpen(false)
              onRevoke(device.id)
            }}
          >
            Revoke
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function VpnDevicesList({
  devices,
  onRevoke,
  revoking,
}: Props) {
  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No devices paired yet.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Pair a device from the My Subscriptions page or use the
          mobile app QR scan.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Device Name</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Paired Via</TableHead>
            <TableHead>Last Seen</TableHead>
            <TableHead>Paired At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {devices.map((device) => (
            <TableRow key={device.id}>
              <TableCell className="font-medium">
                {device.deviceName}
              </TableCell>
              <TableCell>
                <PlatformBadge platform={device.platform} />
                {device.osVersion && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {device.osVersion}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    STATUS_VARIANT[device.status] ?? "outline"
                  }
                >
                  {device.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {device.pairedVia}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(device.lastSeenAt)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(device.pairedAt)}
              </TableCell>
              <TableCell className="text-right">
                <RevokeButton
                  device={device}
                  onRevoke={onRevoke}
                  revoking={revoking}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
