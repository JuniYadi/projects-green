"use client"

import { useCallback, useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { eden } from "@/lib/eden"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { type ColumnDef } from "@tanstack/react-table"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

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

const formatRelativeTime = (
  date: string,
  messages: ReturnType<typeof getMessages>
) => {
  const t = messages.pPortalAdminOrganizationsMembersTable
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return t.today
  if (diffDays === 1) return t.yesterday
  if (diffDays < 7) return t.daysAgo.replace("{count}", String(diffDays))
  if (diffDays < 30)
    return t.weeksAgo.replace("{count}", String(Math.floor(diffDays / 7)))
  return t.monthsAgo.replace("{count}", String(Math.floor(diffDays / 30)))
}

const formatExpiresAt = (
  date: string,
  messages: ReturnType<typeof getMessages>
) => {
  const t = messages.pPortalAdminOrganizationsMembersTable
  const now = new Date()
  const expires = new Date(date)
  const diffMs = expires.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return t.expired
  if (diffDays === 1) return t.oneDayRemaining
  return t.daysRemaining.replace("{count}", String(diffDays))
}

export function MembersTable({ organizationId }: MembersTableProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)

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
          data && "message" in data
            ? data.message
            : messages.pPortalAdminOrganizationsMembersTable.loadFailed
        )
        return
      }
      setMemberships(data.data.memberships)
      setPendingInvitations(data.data.pendingInvitations)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : messages.pPortalAdminOrganizationsMembersTable.unexpectedError
      )
    } finally {
      setIsLoading(false)
    }
  }, [organizationId, messages])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  const memberColumns = useMemo<ColumnDef<Membership>[]>(() => {
    return [
      {
        id: "name",
        accessorFn: (row) =>
          `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim(),
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={messages.pPortalAdminOrganizationsMembersTable.name}
          />
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
          <DataTableColumnHeader
            column={column}
            title={messages.pPortalAdminOrganizationsMembersTable.email}
          />
        ),
        cell: ({ row }) => <span>{row.original.email}</span>,
      },
      {
        accessorKey: "roleSlug",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={messages.pPortalAdminOrganizationsMembersTable.role}
          />
        ),
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.roleSlug}</Badge>
        ),
      },
      {
        accessorKey: "joinedAt",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={messages.pPortalAdminOrganizationsMembersTable.joined}
          />
        ),
        cell: ({ row }) => (
          <span>{new Date(row.original.joinedAt).toLocaleDateString()}</span>
        ),
      },
    ]
  }, [messages])

  const invitationColumns = useMemo<ColumnDef<PendingInvitation>[]>(() => {
    return [
      {
        accessorKey: "email",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={messages.pPortalAdminOrganizationsMembersTable.email}
          />
        ),
        cell: ({ row }) => <span>{row.original.email}</span>,
      },
      {
        accessorKey: "roleSlug",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={messages.pPortalAdminOrganizationsMembersTable.role}
          />
        ),
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.roleSlug}</Badge>
        ),
      },
      {
        id: "createdAt",
        accessorFn: (row) => row.createdAt,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={messages.pPortalAdminOrganizationsMembersTable.sent}
          />
        ),
        cell: ({ row }) => (
          <span>{formatRelativeTime(row.original.createdAt, messages)}</span>
        ),
      },
      {
        accessorKey: "expiresAt",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={messages.pPortalAdminOrganizationsMembersTable.expires}
          />
        ),
        cell: ({ row }) => (
          <span>{formatExpiresAt(row.original.expiresAt, messages)}</span>
        ),
      },
    ]
  }, [messages])

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
            {messages.pPortalAdminOrganizationsMembersTable.activeMembersTab.replace(
              "{count}",
              String(memberships.length)
            )}
          </TabsTrigger>
          <TabsTrigger value="invitations">
            {messages.pPortalAdminOrganizationsMembersTable.pendingInvitationsTab.replace(
              "{count}",
              String(pendingInvitations.length)
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="members">
          <DataTable
            tableId="portal-org-members"
            columns={memberColumns}
            data={memberships}
            searchableColumns={["firstName", "lastName", "email"]}
            searchPlaceholder={
              messages.pPortalAdminOrganizationsMembersTable
                .searchMembersPlaceholder
            }
            defaultColumnVisibility={{
              email: false,
              joinedAt: false,
            }}
            emptyMessage={
              messages.pPortalAdminOrganizationsMembersTable.noActiveMembers
            }
          />
        </TabsContent>
        <TabsContent value="invitations">
          <DataTable
            tableId="portal-org-invitations"
            columns={invitationColumns}
            data={pendingInvitations}
            searchableColumns={["email"]}
            searchPlaceholder={
              messages.pPortalAdminOrganizationsMembersTable
                .searchInvitationsPlaceholder
            }
            defaultColumnVisibility={{
              createdAt: false,
            }}
            emptyMessage={
              messages.pPortalAdminOrganizationsMembersTable
                .noPendingInvitations
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
