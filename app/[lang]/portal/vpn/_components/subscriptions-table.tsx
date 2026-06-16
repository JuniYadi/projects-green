"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

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
import { Skeleton } from "@/components/ui/skeleton"
import { DeviceMobileIcon } from "@phosphor-icons/react"

import {
  vpnApi,
  type VpnSubscriptionItem,
  type VpnServerAccountEntry,
} from "./vpn-admin-client"

const STATUS_VARIANT: Record<
  VpnSubscriptionItem["status"],
  "default" | "secondary" | "destructive"
> = {
  ACTIVE: "default",
  SUSPENDED: "secondary",
  EXPIRED: "destructive",
}

const PROVISION_VARIANT: Record<
  VpnServerAccountEntry["provisioningStatus"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  PENDING: "outline",
  PROVISIONING: "secondary",
  FAILED: "destructive",
  REVOKED: "secondary",
}

export function SubscriptionsTable() {
  const [subs, setSubs] = useState<VpnSubscriptionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await vpnApi<{ ok: true; data: VpnSubscriptionItem[] }>(
        "/admin/vpn/subscriptions"
      )
      setSubs(res.data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const act = async (
    subId: string,
    account: VpnServerAccountEntry,
    action: "retry" | "revoke"
  ) => {
    if (
      action === "revoke" &&
      !window.confirm(`Revoke ${account.protocol} on ${account.serverName}?`)
    )
      return
    setBusy(account.id)
    try {
      await vpnApi(
        `/admin/vpn/subscriptions/${subId}/servers/${account.id}/${action}`,
        { method: "POST" }
      )
      await load()
    } catch (err) {
      window.alert((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Devices</TableHead>
              <TableHead>Period end</TableHead>
              <TableHead>Server accounts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : subs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-sm text-muted-foreground"
                >
                  No subscriptions yet.
                </TableCell>
              </TableRow>
            ) : (
              subs.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-mono text-xs">
                    {sub.organizationId}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[sub.status]}>
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/portal/vpn/devices?subscriptionId=${sub.id}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                    >
                      <DeviceMobileIcon className="h-4 w-4 text-muted-foreground" />
                      {sub.deviceCount}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      {sub.serverAccounts.map((account) => (
                        <div
                          key={account.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="font-medium">
                            {account.serverName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {account.protocol}
                          </span>
                          <Badge
                            variant={
                              PROVISION_VARIANT[account.provisioningStatus]
                            }
                          >
                            {account.provisioningStatus}
                          </Badge>
                          {account.provisioningStatus === "FAILED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy === account.id}
                              onClick={() => act(sub.id, account, "retry")}
                            >
                              Retry
                            </Button>
                          )}
                          {(account.provisioningStatus === "ACTIVE" ||
                            account.provisioningStatus === "FAILED") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy === account.id}
                              onClick={() => act(sub.id, account, "revoke")}
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
