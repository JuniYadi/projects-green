"use client"

import { useCallback, useEffect, useState, useMemo } from "react"
import { eden } from "@/lib/eden"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { type ColumnDef } from "@tanstack/react-table"

type Membership = {
  id: string
  userId: string
  email: string
  firstName: string | null
  lastName: string | null
  roleSlug: string
  joinedAt: string
}

type PendingInvitation = {
  id: string
  email: string
  roleSlug: string
  createdAt: string
  expiresAt: string
}

type MembersTableProps = {
  organizationId: string
}

const formatRelativeTime = (date: string) => {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return `${Math.floor(diffDays / 30)} months ago`
}

const formatExpiresAt = (date: string) => {
  const now = new Date()
  const expires = new Date(date)
  const diffMs = expires.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return "Expired"
  if (diffDays === 1) return "1 day remaining"
  return `${diffDays} days remaining`
}

export function MembersTable({ organizationId }: MembersTableProps) {
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [pendingInvitations, setPendingInvitations] = useState<
    PendingInvitation[]
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } =
        await eden.api.admin.organizations[organizationId].members.get()

      if (!data || !data.ok) {
        setError(
          data && "message" in data ? data.message : "Failed to load members"
        )
        return
      }
      setMemberships(data.data.memberships)
      setPendingInvitations(data.data.pendingInvitations)
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

  const memberColumns = useMemo<ColumnDef<Membership>[]>(() => {
    return [
      {
        id: "name",
        accessorFn: (row) => `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim(),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.firstName} {row.original.lastName}
          </span>
        ),
      },
      {
        accessorKey: "email",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Email" />
        ),
        cell: ({ row }) => <span>{row.original.email}</span>,
      },
      {
        accessorKey: "roleSlug",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Role" />
        ),
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.roleSlug}</Badge>
        ),
      },
      {
        accessorKey: "joinedAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Joined" />
        ),
        cell: ({ row }) => (
          <span>{new Date(row.original.joinedAt).toLocaleDateString()}</span>
        ),
      },
    ]
  }, [])

  const invitationColumns = useMemo<ColumnDef<PendingInvitation>[]>(() => {
    return [
      {
        accessorKey: "email",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Email" />
        ),
        cell: ({ row }) => <span>{row.original.email}</span>,
      },
      {
        accessorKey: "roleSlug",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Role" />
        ),
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.roleSlug}</Badge>
        ),
      },
      {
        id: "createdAt",
        accessorFn: (row) => row.createdAt,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Sent" />
        ),
        cell: ({ row }) => (
          <span>{formatRelativeTime(row.original.createdAt)}</span>
        ),
      },
      {
        accessorKey: "expiresAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Expires" />
        ),
        cell: ({ row }) => (
          <span>{formatExpiresAt(row.original.expiresAt)}</span>
        ),
      },
    ]
  }, [])

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
      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">
            Active Members ({memberships.length})
          </TabsTrigger>
          <TabsTrigger value="invitations">
            Pending Invitations ({pendingInvitations.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="members">
          <DataTable
            tableId="portal-org-members"
            columns={memberColumns}
            data={memberships}
            searchableColumns={["firstName", "lastName", "email"]}
            searchPlaceholder="Search members..."
            defaultColumnVisibility={{
              email: false,
              joinedAt: false,
            }}
            emptyMessage="No active members"
          />
        </TabsContent>
        <TabsContent value="invitations">
          <DataTable
            tableId="portal-org-invitations"
            columns={invitationColumns}
            data={pendingInvitations}
            searchableColumns={["email"]}
            searchPlaceholder="Search invitations..."
            defaultColumnVisibility={{
              createdAt: false,
            }}
            emptyMessage="No pending invitations"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
