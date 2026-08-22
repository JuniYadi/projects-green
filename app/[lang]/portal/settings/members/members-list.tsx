"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { eden } from "@/lib/eden"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import type { ColumnDef } from "@tanstack/react-table"
import type { TenantMembershipSummary } from "@/modules/tenants/contracts/tenant-api.contract"
import type { TenantRole } from "@/modules/tenants/tenant-policy"
type MembersListProps = {
  organizationId: string
}

const toMemberInitials = (displayName: string) => {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() ?? "?"
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase()
}

const getRoleBadgeVariant = (role: TenantRole | null) => {
  switch (role) {
    case "owner":
      return "default"
    case "admin":
      return "secondary"
    default:
      return "outline"
  }
}

const getStatusBadgeVariant = (status: string) => {
  switch (status.toLowerCase()) {
    case "active":
      return "success"
    case "pending":
      return "warning"
    default:
      return "outline"
  }
}
export function MembersList({ organizationId }: MembersListProps) {
  const [members, setMembers] = useState<TenantMembershipSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [, membersRes] = await Promise.all([
        eden.api.tenants[organizationId].authorization
          .get()
          .then((r) => r.data),
        eden.api.tenants[organizationId].members.get().then((r) => r.data),
      ])

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

  const columns = useMemo<ColumnDef<TenantMembershipSummary>[]>(
    () => [
      {
        id: "member",
        accessorKey: "displayName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Member" />
        ),
        cell: ({ row }) => {
          const name =
            row.original.displayName &&
            row.original.displayName !== row.original.email
              ? row.original.displayName
              : null

          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={row.original.avatarUrl ?? undefined} />
                <AvatarFallback>
                  {toMemberInitials(
                    row.original.displayName || row.original.email || "?"
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                {name ? (
                  <span className="font-medium text-foreground">{name}</span>
                ) : null}
                <span
                  className={
                    name
                      ? "text-xs text-muted-foreground"
                      : "font-medium text-foreground"
                  }
                >
                  {row.original.email ?? row.original.userId}
                </span>
              </div>
            </div>
          )
        },
      },
      {
        id: "role",
        accessorKey: "role",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Role" />
        ),
        cell: ({ row }) => (
          <Badge
            variant={getRoleBadgeVariant(row.original.role)}
            className="capitalize"
          >
            {row.original.role ?? "Member"}
          </Badge>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <Badge
            variant={getStatusBadgeVariant(row.original.status)}
            className="capitalize"
          >
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Joined" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.createdAt
              ? new Date(row.original.createdAt).toLocaleDateString()
              : "-"}
          </span>
        ),
      },
    ],
    []
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
