"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
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
  messages,
}: {
  device: MobileDeviceEntry
  onRevoke: (id: string) => void
  revoking: string | null
  messages: ReturnType<typeof getMessages>["pVpnDevicesList"]
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
          {revoking === device.id ? "Revoking…" : messages.revoke}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{messages.revokeDeviceTitle}</DialogTitle>
          <DialogDescription>
            {messages.revokeDesc.replace("{device}", device.deviceName)}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {messages.cancel}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setOpen(false)
              onRevoke(device.id)
            }}
          >
            {messages.revoke}
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
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale).pVpnDevicesList

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
              messages={messages}
            />
          </div>
        ),
      },
    ],
    [onRevoke, revoking, messages]
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
      searchPlaceholder={messages.searchPlaceholder}
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
      defaultColumnVisibility={{ pairedAt: false, lastSeenAt: false }}
      emptyMessage={messages.noDevicesFound}
    />
  )
}
