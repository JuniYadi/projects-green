"use client"

import React, { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CaretDown, CaretRight, Eye } from "@phosphor-icons/react"

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
  type ProvisioningSummary,
} from "./vpn-admin-client"
import { ProvisioningAuditModal } from "./provisioning-audit-modal"

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

function SummaryBadges({ summary }: { summary: ProvisioningSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {summary.active > 0 && (
        <Badge variant="default" className="text-xs">
          {summary.active} ACTIVE
        </Badge>
      )}
      {summary.pending > 0 && (
        <Badge variant="outline" className="text-xs">
          {summary.pending} PENDING
        </Badge>
      )}
      {summary.failed > 0 && (
        <Badge variant="destructive" className="text-xs">
          {summary.failed} FAILED
        </Badge>
      )}
      {summary.revoked > 0 && (
        <Badge variant="secondary" className="text-xs">
          {summary.revoked} REVOKED
        </Badge>
      )}
    </div>
  )
}

export function SubscriptionsTable() {
  const [subs, setSubs] = useState<VpnSubscriptionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [auditAccount, setAuditAccount] = useState<VpnServerAccountEntry | null>(
    null
  )

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

  const retryAllFailed = async (subId: string) => {
    if (!window.confirm("Retry provisioning for all failed accounts?")) return
    setBusy(subId)
    try {
      await vpnApi(`/admin/vpn/subscriptions/${subId}/retry-all`, {
        method: "POST",
      })
      await load()
    } catch (err) {
      window.alert((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const toggleExpand = (subId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(subId)) next.delete(subId)
      else next.add(subId)
      return next
    })
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
              <TableHead className="w-8" />
              <TableHead>Organization</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Devices</TableHead>
              <TableHead>Period end</TableHead>
              <TableHead>Provisioning</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : subs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-sm text-muted-foreground"
                >
                  No subscriptions yet.
                </TableCell>
              </TableRow>
            ) : (
              subs.map((sub) => {
                const isExpanded = expanded.has(sub.id)
                return (
                  <React.Fragment key={sub.id}>
                    <TableRow className="cursor-pointer" onClick={() => toggleExpand(sub.id)}>
                      <TableCell>
                        {isExpanded ? (
                          <CaretDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <CaretRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
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
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DeviceMobileIcon className="h-4 w-4 text-muted-foreground" />
                          {sub.deviceCount}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <SummaryBadges summary={sub.provisioningSummary} />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {sub.provisioningSummary.failed > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy === sub.id}
                            onClick={() => retryAllFailed(sub.id)}
                          >
                            {busy === sub.id ? "Retrying..." : "Retry All Failed"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 p-4">
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold">
                              Server Accounts
                            </h4>
                            <div className="space-y-2">
                              {sub.serverAccounts.map((account) => (
                                <div
                                  key={account.id}
                                  className="flex items-center justify-between rounded-md border bg-background p-3"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="flex flex-col">
                                      <span className="text-sm font-medium">
                                        {account.serverName}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {account.protocol} · {account.username}
                                      </span>
                                    </div>
                                    <Badge
                                      variant={
                                        PROVISION_VARIANT[
                                          account.provisioningStatus
                                        ]
                                      }
                                    >
                                      {account.provisioningStatus}
                                    </Badge>
                                    {account.failureReason && (
                                      <span className="max-w-xs truncate text-xs text-red-500">
                                        {account.failureReason}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title="View Audit Log"
                                      onClick={() => setAuditAccount(account)}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    {account.provisioningStatus ===
                                      "FAILED" && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={busy === account.id}
                                        onClick={() =>
                                          act(sub.id, account, "retry")
                                        }
                                      >
                                        Retry
                                      </Button>
                                    )}
                                    {(account.provisioningStatus === "ACTIVE" ||
                                      account.provisioningStatus ===
                                        "FAILED") && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={busy === account.id}
                                        onClick={() =>
                                          act(sub.id, account, "revoke")
                                        }
                                      >
                                        Revoke
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {auditAccount && (
        <ProvisioningAuditModal
          account={auditAccount}
          open={!!auditAccount}
          onClose={() => setAuditAccount(null)}
        />
      )}
    </div>
  )
}
