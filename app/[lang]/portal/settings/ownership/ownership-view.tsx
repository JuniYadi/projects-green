"use client"

import { useCallback, useEffect, useState } from "react"
import { eden } from "@/lib/eden"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Warning } from "@phosphor-icons/react"
import type {
  TenantMembershipSummary,
  TenantAuthorizationResponse,
} from "@/modules/tenants/contracts/tenant-api.contract"
import type { TenantAction } from "@/modules/tenants/tenant-policy"

type OwnershipViewProps = {
  organizationId: string
}

export function OwnershipView({ organizationId }: OwnershipViewProps) {
  const [members, setMembers] = useState<TenantMembershipSummary[]>([])
  const [authorization, setAuthorization] = useState<TenantAuthorizationResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAdminId, setSelectedAdminId] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [authRes, membersRes] = await Promise.all([
        eden.api.tenants[organizationId].authorization.get().then(r => r.data),
        eden.api.tenants[organizationId].members.get().then(r => r.data)
      ])

      if (authRes?.ok) setAuthorization(authRes as TenantAuthorizationResponse)
      if (membersRes?.ok) {
        setMembers((membersRes as { members: TenantMembershipSummary[] }).members)
      } else {
        setError((membersRes as { message?: string })?.message || "Failed to load members")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  const handleTransfer = async () => {
    if (!selectedAdminId) return

    if (!confirm("Are you sure you want to transfer ownership? This action will demote you to an admin and cannot be undone.")) {
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const { data: res } = await eden.api.tenants[organizationId].ownership.transfer.post({
        newOwnerMembershipId: selectedAdminId
      })

      if (res?.ok) {
        window.location.reload()
      } else {
        setError((res as { message?: string })?.message || "Transfer failed")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[150px] w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    )
  }

  const currentOwner = members.find(m => m.role === "owner")
  const admins = members.filter(m => m.role === "admin" && m.status === "active")
  const allowedActions = new Set((authorization?.allowedActions as TenantAction[]) || [])
  const canTransfer = allowedActions.has("transfer_ownership")

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Current Owner</CardTitle>
          <CardDescription>The user who currently owns this organization</CardDescription>
        </CardHeader>
        <CardContent>
          {currentOwner ? (
            <div className="flex flex-col">
              <span className="font-medium text-lg">{currentOwner.displayName}</span>
              <span className="text-sm text-muted-foreground">{currentOwner.email}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">No owner found</span>
          )}
        </CardContent>
      </Card>

      {canTransfer && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <CardHeader>
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <Warning className="h-5 w-5" />
              <CardTitle className="text-base font-medium">Transfer Ownership</CardTitle>
            </div>
            <CardDescription className="text-amber-700 dark:text-amber-300">
              Transferring ownership will demote you to an administrator role. The new owner will have full control over the organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select new owner</label>
              <Select value={selectedAdminId} onValueChange={setSelectedAdminId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an administrator" />
                </SelectTrigger>
                <SelectContent>
                  {admins.length === 0 ? (
                    <div className="p-2 text-sm text-center text-muted-foreground">
                      No other active administrators available
                    </div>
                  ) : (
                    admins.map((admin) => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {admin.displayName} ({admin.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="destructive"
              className="w-full"
              disabled={!selectedAdminId || isSubmitting}
              onClick={handleTransfer}
            >
              {isSubmitting ? "Transferring..." : "Transfer Ownership"}
            </Button>
          </CardContent>
        </Card>
      )}

      {!canTransfer && (
        <p className="text-sm text-center text-muted-foreground">
          Only the current owner can transfer ownership.
        </p>
      )}
    </div>
  )
}
