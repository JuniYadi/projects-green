"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react"
import { eden } from "@/lib/eden"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DotsThreeVerticalIcon,
  PaperPlaneTiltIcon,
  UserPlusIcon,
} from "@phosphor-icons/react"
import type { ColumnDef } from "@tanstack/react-table"
import type {
  TenantMembershipSummary,
  TenantInvitationSummary,
  TenantAuthorizationResponse,
} from "@/modules/tenants/contracts/tenant-api.contract"
import type { TenantAction, TenantRole } from "@/modules/tenants/tenant-policy"

type UnifiedMemberRow = {
  id: string
  type: "member" | "invitation"
  displayName: string | null
  email: string | null
  avatarUrl: string | null
  role: TenantRole | null
  status: "active" | "pending_invite" | "expired" | "inactive"
  date: string | null
  invitationId?: string
  membershipId?: string
}

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

const getStatusBadge = (status: UnifiedMemberRow["status"]) => {
  switch (status) {
    case "active":
      return { label: "Active", variant: "success" as const }
    case "pending_invite":
      return { label: "Pending Invite", variant: "warning" as const }
    case "expired":
      return { label: "Expired", variant: "destructive" as const }
    case "inactive":
      return { label: "Inactive", variant: "outline" as const }
  }
}

export function MembersList({ organizationId }: MembersListProps) {
  const [members, setMembers] = useState<TenantMembershipSummary[]>([])
  const [invitations, setInvitations] = useState<TenantInvitationSummary[]>([])
  const [authorization, setAuthorization] =
    useState<TenantAuthorizationResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("member")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [authRes, membersRes, invRes] = await Promise.all([
        eden.api.tenants[organizationId].authorization
          .get()
          .then((r) => r.data),
        eden.api.tenants[organizationId].members.get().then((r) => r.data),
        eden.api.tenants[organizationId].invitations.get().then((r) => r.data),
      ])

      if (authRes?.ok) {
        setAuthorization(authRes as TenantAuthorizationResponse)
      }
      if (membersRes?.ok) {
        setMembers(
          (membersRes as { members: TenantMembershipSummary[] }).members
        )
      }
      if (invRes?.ok) {
        setInvitations(
          (invRes as { invitations: TenantInvitationSummary[] }).invitations
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

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return

    setIsSubmitting(true)
    setError(null)
    try {
      const { data: res } = await eden.api.tenants[
        organizationId
      ].invitations.post({
        email: inviteEmail,
        targetRole: inviteRole as "admin" | "owner" | "member",
      })

      if (res?.ok) {
        setInviteEmail("")
        setIsInviteOpen(false)
        void loadData()
      } else {
        setError(
          (res as { message?: string })?.message || "Failed to send invitation"
        )
      }
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInvitationAction = useCallback(
    async (
      edenCall: Promise<{
        data?: { ok?: boolean; message?: string } | null
        error?: unknown
      }>
    ) => {
      setError(null)
      try {
        const { data: res } = await edenCall
        if (res?.ok) {
          void loadData()
        } else {
          setError(res?.message || "Action failed")
        }
      } catch {
        setError("An unexpected error occurred")
      }
    },
    [loadData]
  )

  const unifiedData = useMemo<UnifiedMemberRow[]>(() => {
    const existingMemberEmails = new Set(
      members.map((m) => m.email?.toLowerCase()).filter(Boolean)
    )

    const rows: UnifiedMemberRow[] = members.map((m) => ({
      id: `member-${m.id}`,
      membershipId: m.id,
      type: "member",
      displayName: m.displayName,
      email: m.email ?? m.userId,
      avatarUrl: m.avatarUrl,
      role: m.role,
      status: (m.status.toLowerCase() === "active"
        ? "active"
        : "inactive") as UnifiedMemberRow["status"],
      date: m.createdAt,
    }))

    invitations.forEach((inv) => {
      // Don't show pending invitation if user has already accepted and joined as an active member
      if (inv.email && existingMemberEmails.has(inv.email.toLowerCase())) {
        return
      }

      const roleSlugCleaned = (inv.roleSlug || "member").replace(
        /^user_/i,
        ""
      ) as TenantRole
      const isExpired = inv.expiresAt ? Date.parse(inv.expiresAt) < 0 : false

      rows.push({
        id: `invitation-${inv.id}`,
        invitationId: inv.id,
        type: "invitation",
        displayName: null,
        email: inv.email,
        avatarUrl: null,
        role: roleSlugCleaned,
        status: isExpired ? "expired" : "pending_invite",
        date: inv.createdAt,
      })
    })

    return rows
  }, [members, invitations])

  const columns = useMemo<ColumnDef<UnifiedMemberRow>[]>(
    () => [
      {
        id: "member",
        accessorKey: "email",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Member" />
        ),
        cell: ({ row }) => {
          const name = row.original.displayName
          const displayTitle = name || row.original.email || "Unknown"

          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={row.original.avatarUrl ?? undefined} />
                <AvatarFallback>
                  {toMemberInitials(displayTitle)}
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
                  {row.original.email}
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
        cell: ({ row }) => {
          const statusInfo = getStatusBadge(row.original.status)
          return (
            <Badge variant={statusInfo.variant} className="capitalize">
              {statusInfo.label}
            </Badge>
          )
        },
      },
      {
        id: "date",
        accessorKey: "date",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.date
              ? new Date(row.original.date).toLocaleDateString()
              : "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => {
          const isInvitation = row.original.type === "invitation"
          const invId = row.original.invitationId
          const memId = row.original.membershipId
          const role = row.original.role

          if (isInvitation && invId) {
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <DotsThreeVerticalIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      handleInvitationAction(
                        eden.api.tenants[organizationId].invitations[
                          invId
                        ].resend.post()
                      )
                    }
                  >
                    Resend
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      if (
                        confirm(
                          "Are you sure you want to revoke this invitation?"
                        )
                      ) {
                        handleInvitationAction(
                          eden.api.tenants[organizationId].invitations[
                            invId
                          ].revoke.post()
                        )
                      }
                    }}
                  >
                    Revoke
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )
          }

          if (!isInvitation && memId && role !== "owner") {
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <DotsThreeVerticalIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {role === "member" ? (
                    <DropdownMenuItem
                      onClick={() =>
                        handleInvitationAction(
                          eden.api.tenants[organizationId].members[
                            memId
                          ].promote.post({ targetRole: "admin" })
                        )
                      }
                    >
                      Promote to Admin
                    </DropdownMenuItem>
                  ) : null}
                  {role === "admin" ? (
                    <DropdownMenuItem
                      onClick={() =>
                        handleInvitationAction(
                          eden.api.tenants[organizationId].members[
                            memId
                          ].demote.post()
                        )
                      }
                    >
                      Demote to Member
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      if (
                        confirm(
                          "Are you sure you want to remove this member from the organization?"
                        )
                      ) {
                        handleInvitationAction(
                          eden.api.tenants[organizationId].members[
                            memId
                          ].remove.post()
                        )
                      }
                    }}
                  >
                    Remove Member
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )
          }

          return null
        },
        enableHiding: false,
      },
    ],
    [organizationId, handleInvitationAction]
  )

  const allowedActions = new Set(
    (authorization?.allowedActions as TenantAction[]) || []
  )
  const canInvite =
    allowedActions.has("invite_member") || allowedActions.has("invite_admin")

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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Members & Invitations</h2>
          <p className="text-xs text-muted-foreground">
            Manage active members and pending invitations for your organization.
          </p>
        </div>
        {canInvite ? (
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <UserPlusIcon className="size-4" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleInvite} className="space-y-4">
                <DialogHeader>
                  <DialogTitle>Invite New Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation link to your teammate to join this
                    organization.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1">
                    <label
                      htmlFor="invite-email"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Email Address
                    </label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="teammate@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Role
                    </label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">
                          Member - Standard team access
                        </SelectItem>
                        <SelectItem value="admin">
                          Admin - Full workspace & member management
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsInviteOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !inviteEmail}
                    className="gap-2"
                  >
                    <PaperPlaneTiltIcon className="size-4" />
                    {isSubmitting ? "Sending..." : "Send Invitation"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <DataTable
        tableId="portal-settings-members"
        columns={columns}
        data={unifiedData}
        searchPlaceholder="Search members or invitations..."
        searchableColumns={["email", "displayName"]}
        defaultColumnVisibility={{ actions: true }}
      />
    </div>
  )
}
