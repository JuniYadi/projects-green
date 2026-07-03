"use client"

import { useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table"
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
  defaultStatusFilter?: string
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
    platform === "ios" ? "iOS" : platform === "android" ? "Android" : platform
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
    return null
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
          <Button variant="outline" onClick={() => setOpen(false)}>
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
  defaultStatusFilter = "ACTIVE",
}: Props) {
  const columns = useMemo<ColumnDef<MobileDeviceEntry, unknown>[]>(
    () => [
      {
        accessorKey: "deviceName",
        header: "Device Name",
      },
      {
        accessorKey: "platform",
        header: "Platform",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <PlatformBadge platform={row.original.platform} />
            {row.original.osVersion && (
              <span className="text-xs text-muted-foreground">
                {row.original.osVersion}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.original.status] ?? "outline"}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: "pairedVia",
        header: "Paired Via",
      },
      {
        accessorKey: "lastSeenAt",
        header: "Last Seen",
        cell: ({ row }) => formatDate(row.original.lastSeenAt),
      },
      {
        accessorKey: "pairedAt",
        header: "Paired At",
        cell: ({ row }) => formatDate(row.original.pairedAt),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="text-right">
            <RevokeButton
              device={row.original}
              onRevoke={onRevoke}
              revoking={revoking}
            />
          </div>
        ),
      },
    ],
    [onRevoke, revoking]
  )

  const initialColumnFilters =
    defaultStatusFilter === "all"
      ? []
      : [{ id: "status", value: defaultStatusFilter }]

  return (
    <DataTable
      columns={columns}
      data={devices}
      tableId="console-vpn-devices"
      searchPlaceholder="Search devices..."
      searchableColumns={["deviceName", "platform", "pairedVia"]}
      initialColumnFilters={initialColumnFilters}
      facetFilters={[
        {
          columnId: "status",
          label: "Status",
          options: [
            { label: "Active", value: "ACTIVE" },
            { label: "Suspended", value: "SUSPENDED" },
            { label: "Revoked", value: "REVOKED" },
          ],
        },
      ]}
      emptyMessage="No devices found."
    />
  )
}
