"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { eden } from "@/lib/eden"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import type { ColumnDef } from "@tanstack/react-table"
import {
  MagnifyingGlassIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  Plus,
  Trash,
  BuildingsIcon,
} from "@phosphor-icons/react"

type AdminInvitation = {
  id: string
  email: string
  state: string
  organizationId: string | null
  organizationName?: string | null
  roleSlug: string | null
  createdAt: string
  expiresAt: string
  acceptedAt: string | null
}

type OrganizationOption = {
  id: string
  name: string
}

type ListMetadata = {
  before?: string
  after?: string
}

const formatRelativeTime = (date: string) => {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

const formatExpiresAt = (date: string) => {
  const now = new Date()
  const expires = new Date(date)
  const diffMs = expires.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return "Expired"
  if (diffDays === 1) return "1 day left"
  return `${diffDays} days left`
}

export function InvitationsTable() {
  const [invitations, setInvitations] = useState<AdminInvitation[]>([])
  const [listMetadata, setListMetadata] = useState<ListMetadata>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedOrgId, setSelectedOrgId] = useState<string>("all")
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([])
  const [cursor, setCursor] = useState<{ before?: string; after?: string }>({})

  // Invite modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteOrgId, setInviteOrgId] = useState("")
  const [inviteRole, setInviteRole] = useState("member")
  const [inviteExpiresDays, setInviteExpiresDays] = useState("7")
  const [isSendingInvite, setIsSendingInvite] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  // Revoke modal state
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [isRevoking, setIsRevoking] = useState(false)

  // Load organizations for picker and filter
  useEffect(() => {
    async function loadOrgs() {
      try {
        const { data } = await eden.api.admin.organizations.get({
          $query: { limit: 100 },
        })
        if (data?.ok) {
          setOrganizations(
            data.data.organizations.map((org) => ({
              id: org.id,
              name: org.name,
            }))
          )
        }
      } catch {
        // non-fatal
      }
    }
    void loadOrgs()
  }, [])

  const fetchInvitations = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const query: {
        limit: number
        before?: string
        after?: string
        search?: string
        organizationId?: string
        status?: string
      } = {
        limit: 10,
        ...(cursor.before && { before: cursor.before }),
        ...(cursor.after && { after: cursor.after }),
        ...(search && { search }),
        ...(selectedOrgId !== "all" && { organizationId: selectedOrgId }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
      }

      const { data } = await eden.api.admin.invitations.get({
        $query: query,
      })

      if (!data || !data.ok) {
        setError(
          data && "message" in data
            ? data.message
            : "Failed to load invitations"
        )
        return
      }

      setInvitations(data.data.invitations)
      setListMetadata(data.data.listMetadata ?? {})
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      )
    } finally {
      setIsLoading(false)
    }
  }, [cursor, search, selectedOrgId, selectedStatus])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchInvitations()
  }, [fetchInvitations])

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail || !inviteOrgId) {
      setInviteError("Email and Organization are required.")
      return
    }

    setIsSendingInvite(true)
    setInviteError(null)

    try {
      const { data } = await eden.api.admin.invitations.post({
        email: inviteEmail.trim(),
        organizationId: inviteOrgId.trim(),
        roleSlug: inviteRole.trim(),
        expiresInDays: inviteExpiresDays
          ? Number(inviteExpiresDays)
          : undefined,
      })

      if (!data || !data.ok) {
        setInviteError(
          data && "message" in data ? data.message : "Failed to send invitation"
        )
        return
      }

      setIsInviteOpen(false)
      setInviteEmail("")
      setInviteOrgId("")
      setInviteRole("member")
      setInviteExpiresDays("7")
      await fetchInvitations()
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : "Failed to send invitation"
      )
    } finally {
      setIsSendingInvite(false)
    }
  }

  const handleRevoke = async (id: string) => {
    setIsRevoking(true)
    try {
      const { data } = await eden.api.admin.invitations[id].delete()
      if (data?.ok) {
        setRevokingId(null)
        await fetchInvitations()
      } else {
        setError(
          data && "message" in data
            ? data.message
            : "Failed to revoke invitation"
        )
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to revoke invitation"
      )
    } finally {
      setIsRevoking(false)
    }
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setCursor({})
  }

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value)
    setCursor({})
  }

  const handleOrgChange = (value: string) => {
    setSelectedOrgId(value)
    setCursor({})
  }

  const handlePrev = () => {
    if (listMetadata.before) {
      setCursor({ before: listMetadata.before })
    }
  }

  const handleNext = () => {
    if (listMetadata.after) {
      setCursor({ after: listMetadata.after })
    }
  }

  const columns = useMemo<ColumnDef<AdminInvitation>[]>(
    () => [
      {
        accessorKey: "email",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Recipient" />
        ),
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {row.original.email}
          </span>
        ),
      },
      {
        id: "organization",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Organization" />
        ),
        cell: ({ row }) => {
          const orgId = row.original.organizationId
          const orgName = row.original.organizationName ?? orgId
          if (!orgId) {
            return <span className="text-muted-foreground">-</span>
          }
          return (
            <Link
              href={`/portal/admin/organizations/${orgId}`}
              className="flex items-center gap-1.5 font-medium text-foreground hover:underline"
            >
              <BuildingsIcon className="h-4 w-4 text-muted-foreground" />
              <span>{orgName}</span>
            </Link>
          )
        },
      },
      {
        accessorKey: "roleSlug",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Role" />
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            {row.original.roleSlug ?? "member"}
          </Badge>
        ),
      },
      {
        accessorKey: "state",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => {
          const state = row.original.state
          let variant: "default" | "secondary" | "outline" | "destructive" =
            "secondary"
          if (state === "accepted") variant = "default"
          else if (state === "revoked") variant = "destructive"
          else if (state === "expired") variant = "outline"

          return (
            <Badge variant={variant} className="text-xs capitalize">
              {state}
            </Badge>
          )
        },
      },
      {
        id: "createdAt",
        accessorFn: (row) => row.createdAt,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Sent" />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: "expiresAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Expires" />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.state === "pending"
              ? formatExpiresAt(row.original.expiresAt)
              : new Date(row.original.expiresAt).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          if (row.original.state !== "pending") return null
          return (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setRevokingId(row.original.id)}
            >
              <Trash className="h-3.5 w-3.5" />
              <span>Revoke</span>
            </Button>
          )
        },
      },
    ],
    []
  )

  if (isLoading && invitations.length === 0) {
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

      {/* Action and filters bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <MagnifyingGlassIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search invitations..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          <Select value={selectedStatus} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-36 text-sm">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedOrgId} onValueChange={handleOrgChange}>
            <SelectTrigger className="w-52 text-sm">
              <SelectValue placeholder="All Organizations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Organizations</SelectItem>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setIsInviteOpen(true)}
        >
          <Plus className="h-4 w-4" />
          <span>Invite User</span>
        </Button>
      </div>

      <DataTable
        tableId="portal-admin-invitations"
        columns={columns}
        data={invitations}
        searchPlaceholder="Search invitations..."
        searchableColumns={["email"]}
      />

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrev}
          disabled={!listMetadata.before || isLoading}
        >
          <ArrowLeftIcon className="mr-1 h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={!listMetadata.after || isLoading}
        >
          Next
          <ArrowRightIcon className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {/* Send Invitation Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send User Invitation</DialogTitle>
            <DialogDescription>
              Invite a new user to an organization on the platform.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendInvite} className="space-y-4 pt-2">
            {inviteError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
                {inviteError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="invite-org" className="text-xs font-medium">
                Organization *
              </Label>
              <Select value={inviteOrgId} onValueChange={setInviteOrgId}>
                <SelectTrigger id="invite-org" className="w-full text-sm">
                  <SelectValue placeholder="Select target organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-email" className="text-xs font-medium">
                Email Address *
              </Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="invite-role" className="text-xs font-medium">
                  Role
                </Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger id="invite-role" className="w-full text-sm">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invite-expires" className="text-xs font-medium">
                  Expires In
                </Label>
                <Select
                  value={inviteExpiresDays}
                  onValueChange={setInviteExpiresDays}
                >
                  <SelectTrigger id="invite-expires" className="w-full text-sm">
                    <SelectValue placeholder="Days" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 Days</SelectItem>
                    <SelectItem value="14">14 Days</SelectItem>
                    <SelectItem value="30">30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsInviteOpen(false)}
                disabled={isSendingInvite}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSendingInvite}>
                {isSendingInvite ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog
        open={Boolean(revokingId)}
        onOpenChange={(open) => !open && setRevokingId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Revoke Invitation</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke this invitation? The recipient
              will no longer be able to use the link to join.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRevokingId(null)}
              disabled={isRevoking}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => revokingId && void handleRevoke(revokingId)}
              disabled={isRevoking}
            >
              {isRevoking ? "Revoking..." : "Revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
