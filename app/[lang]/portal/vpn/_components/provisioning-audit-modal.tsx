"use client"

import { useEffect, useState } from "react"
import { X } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { type VpnServerAccountEntry } from "./vpn-admin-client"
import { ProvisioningTimeline, type AuditEvent } from "./provisioning-timeline"

type Props = {
  account: VpnServerAccountEntry
  open: boolean
  onClose: () => void
}

export function ProvisioningAuditModal({ account, open, onClose }: Props) {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const loadEvents = async () => {
      setLoading(true)
      setError(null)
      try {
        // TODO(PGREEN-098): wire up real audit endpoint when available
        // const res = await vpnApi<{ ok: true; data: AuditEvent[] }>(
        //   `/admin/vpn/audit/accounts/${account.id}`
        // )
        // if (!cancelled) setEvents(res.data)

        // Fallback: generate synthetic timeline from account data
        const synthetic: AuditEvent[] = [
          {
            type: "PROVISIONING_STARTED",
            timestamp: account.createdAt,
            detail: `Account created for ${account.serverName}`,
          },
        ]
        if (account.provisioningStatus === "FAILED") {
          synthetic.push({
            type: "PROVISIONING_FAILED",
            timestamp: account.updatedAt,
            detail: account.failureReason ?? "Unknown error",
          })
        } else if (account.provisioningStatus === "ACTIVE") {
          synthetic.push({
            type: "PROVISIONING_SUCCESS",
            timestamp: account.updatedAt,
          })
        }
        if (!cancelled) setEvents(synthetic)
      } catch (e) {
        if (cancelled) return
        setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadEvents()

    return () => {
      cancelled = true
    }
  }, [open, account])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Provisioning Audit Log</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <div className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600">
            {error}
          </div>
        ) : (
          <ProvisioningTimeline account={account} events={events} />
        )}

        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
