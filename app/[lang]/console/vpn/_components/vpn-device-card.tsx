"use client"

import { useState } from "react"

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DeviceMobileIcon } from "@phosphor-icons/react"
import type { MobileDeviceEntry } from "@/lib/vpn-mobile-client"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  SUSPENDED: "secondary",
  REVOKED: "destructive",
}

type Props = {
  device: MobileDeviceEntry
  onRevoke: (deviceId: string) => void
  revoking: string | null
  locale?: string
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

function RevokeAction({
  device,
  onRevoke,
  revoking,
  t,
}: {
  device: MobileDeviceEntry
  onRevoke: (id: string) => void
  revoking: string | null
  t: Record<string, string>
}) {
  const [open, setOpen] = useState(false)

  if (device.status === "REVOKED") {
    return (
      <Badge variant="outline" className="text-xs">
        {t.revoked}
      </Badge>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="destructive"
          className="h-8 text-xs"
          disabled={revoking === device.id}
        >
          {revoking === device.id ? t.revoking : t.revoke}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.revokeDeviceTitle}</DialogTitle>
          <DialogDescription>
            {t.disconnectNoticeBefore}{" "}
            <span className="font-medium">{device.deviceName}</span>{" "}
            {t.disconnectNoticeAfter}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t.cancel}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setOpen(false)
              onRevoke(device.id)
            }}
          >
            {t.revoke}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function VpnDeviceCard({
  device,
  onRevoke,
  revoking,
  locale: propLocale,
}: Props) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(propLocale ?? params?.lang)
  const messages = getMessages(locale)
  const t = messages.pConsoleVpnDeviceCard
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <DeviceMobileIcon className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base font-semibold">
            {device.deviceName}
          </CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <PlatformBadge platform={device.platform} />
          <Badge variant={STATUS_VARIANT[device.status] ?? "outline"}>
            {device.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div className="text-muted-foreground">{t.osVersion}</div>
          <div>{device.osVersion ?? "—"}</div>

          <div className="text-muted-foreground">{t.pairedVia}</div>
          <div>{device.pairedVia}</div>

          <div className="text-muted-foreground">{t.pairedAt}</div>
          <div>{formatDate(device.pairedAt)}</div>

          <div className="text-muted-foreground">{t.lastSeen}</div>
          <div>{formatDate(device.lastSeenAt)}</div>
        </div>
      </CardContent>
      <CardFooter className="border-t pt-4">
        <RevokeAction
          device={device}
          onRevoke={onRevoke}
          revoking={revoking}
          t={t}
        />
      </CardFooter>
    </Card>
  )
}
