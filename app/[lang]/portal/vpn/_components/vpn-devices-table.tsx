"use client"

import { useCallback, useEffect, useState, startTransition } from "react"
import { useParams } from "next/navigation"

import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  listVpnMobileAdminDevices,
  revokeVpnMobileDevice,
} from "./vpn-admin-client"

// ── Types ────────────────────────────────────────────────────────────────

export type AdminDeviceEntry = {
  id: string
  deviceName: string
  platform: string
  osVersion: string | null
  subscriptionId: string
  organizationId: string
  organizationName: string | null
  status: "ACTIVE" | "SUSPENDED" | "REVOKED"
  pairedVia: "SSO" | "QR"
  lastSeenAt: string | null
  pairedAt: string
  revokedAt: string | null
  revokedReason: string | null
}

type Filters = {
  status: string
  platform: string
  pairedVia: string
  search: string
}

// ── Helpers ──────────────────────────────────────────────────────────────

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
  })
}

// ── Component ────────────────────────────────────────────────────────────

export function VpnDevicesTable() {
  const params = useParams<{ lang?: string }>()
  const lang = params?.lang || "en"
  const messages = getMessagesForMaybeLocale(lang).console.vpn.adminDevicesTable
  const [devices, setDevices] = useState<AdminDeviceEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [revokeReason, setRevokeReason] = useState("")
  const [showRevokeDialog, setShowRevokeDialog] = useState<string | null>(null)

  const [filters, setFilters] = useState<Filters>({
    status: "",
    platform: "",
    pairedVia: "",
    search: "",
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("limit", String(limit))
      if (filters.status) params.set("status", filters.status)
      if (filters.platform) params.set("platform", filters.platform)
      if (filters.pairedVia) params.set("pairedVia", filters.pairedVia)
      if (filters.search) params.set("search", filters.search)

      const res = await listVpnMobileAdminDevices(
        Object.fromEntries(params.entries())
      )
      startTransition(() => {
        setDevices(res.data.devices)
        setTotal(res.data.total)
      })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [page, limit, filters])

  useEffect(() => {
    const run = async () => {
      await load()
    }
    run()
  }, [load])

  const handleRevoke = useCallback(async () => {
    const deviceId = showRevokeDialog
    if (!deviceId) return
    setRevoking(deviceId)
    try {
      await revokeVpnMobileDevice(
        deviceId,
        revokeReason ? { reason: revokeReason } : {}
      )
      setShowRevokeDialog(null)
      setRevokeReason("")
      await load()
    } catch (err) {
      window.alert((err as Error).message)
    } finally {
      setRevoking(null)
    }
  }, [showRevokeDialog, revokeReason, load])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder={messages.searchPlaceholder}
          className="h-9 w-48"
          value={filters.search}
          onChange={(e) => {
            setFilters((f) => ({ ...f, search: e.target.value }))
            setPage(1)
          }}
        />
        <Select
          value={filters.status}
          onValueChange={(v) => {
            setFilters((f) => ({ ...f, status: v }))
            setPage(1)
          }}
        >
          <SelectTrigger className="h-9 w-32">
            <SelectValue placeholder={messages.allStatusPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value=" ">{messages.allStatus}</SelectItem>
            <SelectItem value="ACTIVE">{messages.statusActive}</SelectItem>
            <SelectItem value="SUSPENDED">
              {messages.statusSuspended}
            </SelectItem>
            <SelectItem value="REVOKED">{messages.statusRevoked}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.platform}
          onValueChange={(v) => {
            setFilters((f) => ({ ...f, platform: v }))
            setPage(1)
          }}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder={messages.allPlatformsPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value=" ">{messages.allPlatforms}</SelectItem>
            <SelectItem value="ios">{messages.platformIos}</SelectItem>
            <SelectItem value="android">{messages.platformAndroid}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.pairedVia}
          onValueChange={(v) => {
            setFilters((f) => ({ ...f, pairedVia: v }))
            setPage(1)
          }}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder={messages.allMethodsPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value=" ">{messages.allMethods}</SelectItem>
            <SelectItem value="SSO">{messages.methodSso}</SelectItem>
            <SelectItem value="QR">{messages.methodQr}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9" onClick={load}>
          {messages.refresh}
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{messages.thDeviceName}</TableHead>
              <TableHead>{messages.thPlatform}</TableHead>
              <TableHead>{messages.thStatus}</TableHead>
              <TableHead>{messages.thPairedVia}</TableHead>
              <TableHead>{messages.thPairedAt}</TableHead>
              <TableHead>{messages.thLastSeen}</TableHead>
              <TableHead className="text-right">{messages.thActions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : devices.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-sm text-muted-foreground"
                >
                  {messages.noDevicesFound}
                </TableCell>
              </TableRow>
            ) : (
              devices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="font-medium">
                    {device.deviceName}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {device.platform}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[device.status] ?? "outline"}>
                      {device.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {device.pairedVia}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(device.pairedAt)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(device.lastSeenAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {device.status !== "REVOKED" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive"
                        onClick={() => setShowRevokeDialog(device.id)}
                        disabled={revoking === device.id}
                      >
                        {revoking === device.id ? "…" : messages.revoke}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            {messages.showing} {(page - 1) * limit + 1}–
            {Math.min(page * limit, total)} {messages.of} {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {messages.previous}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {messages.next}
            </Button>
          </div>
        </div>
      )}

      {/* Revoke confirmation dialog */}
      <Dialog
        open={!!showRevokeDialog}
        onOpenChange={(o) => {
          if (!o) {
            setShowRevokeDialog(null)
            setRevokeReason("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{messages.revokeDeviceTitle}</DialogTitle>
            <DialogDescription>
              {messages.revokeDeviceDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder={messages.reasonPlaceholder}
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRevokeDialog(null)
                setRevokeReason("")
              }}
            >
              {messages.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={revoking === showRevokeDialog}
            >
              {revoking === showRevokeDialog
                ? messages.revoking
                : messages.revoke}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
