"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { eden } from "@/lib/eden"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DotsThreeVerticalIcon } from "@phosphor-icons/react"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import type { ColumnDef } from "@tanstack/react-table"
import type {
  TenantMembershipSummary,
  TenantAuthorizationResponse,
} from "@/modules/tenants/contracts/tenant-api.contract"
import type { TenantAction } from "@/modules/tenants/tenant-policy"

type MembersListProps = {
  organizationId: string
}

const toMemberInitials = (displayName: string) => {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() ?? "?"
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase()
}

export function MembersList({ organizationId }: MembersListProps) {
  const [members, setMembers] = useState<TenantMembershipSummary[]>([])
  const [authorization, setAuthorization] =
    useState<TenantAuthorizationResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [authRes, membersRes] = await Promise.all([
        eden.api.tenants[organizationId].authorization
          .get()
          .then((r) => r.data),
        eden.api.tenants[organizationId].members.get().then((r) => r.data),
      ])

      if (authRes?.ok) setAuthorization(authRes as TenantAuthorizationResponse)
      if (membersRes?.ok) {
        setMembers(
          (membersRes as { members: TenantMembershipSummary[] }).members
        )
      } else {
        setError(
          (membersRes as { message?: string })?.message ||
            "Failed to load members"
        )
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      )
    } finally {
      setIsLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  const handleAction = async (
    actionId: string,
    edenCall: Promise<{
      data?: { ok?: boolean; message?: string } | null
      error?: unknown
    }>
  ) => {
    setPendingActionId(actionId)
    setError(null)
    try {
      const { data: res } = await edenCall
      if (res?.ok) {
        void loadData()
      } else {
        setError(res?.message || "Action failed")
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      )
    } finally {
      setPendingActionId(null)
    }
  }

  const allowedActions = new Set(
    (authorization?.allowedActions as TenantAction[]) || []
  )

  const columns = useMemo<ColumnDef<TenantMembershipSummary>[]>(
    () => [
      {
        id: "member",
        accessorKey: "displayName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Member" />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={row.original.avatarUrl ?? undefined} />
              <AvatarFallback>
                {toMemberInitials(row.original.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">
                {row.original.email}
              </span>
            </div>
          </div>
        ),
      },
    ],
    [organizationId, allowedActions, pendingActionId, handleAction]
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      <DataTable
        tableId="portal-settings-members"
        columns={columns}
        data={members}
        searchPlaceholder="Search members..."
        searchableColumns={["displayName", "email"]}
        defaultColumnVisibility={{ actions: false }}
      />
    </div>
  )
}
