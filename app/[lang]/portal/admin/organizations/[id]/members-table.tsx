"use client"

import { useCallback, useEffect, useState } from "react"
import { eden } from "@/lib/eden"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

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
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberships.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No active members
                    </TableCell>
                  </TableRow>
                ) : (
                  memberships.map((member, index) => (
                    <TableRow key={member.id}>
                      <TableCell className="text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {member.firstName} {member.lastName}
                      </TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{member.roleSlug}</Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="invitations">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No pending invitations
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingInvitations.map((invitation, index) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell>{invitation.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{invitation.roleSlug}</Badge>
                      </TableCell>
                      <TableCell>
                        {formatRelativeTime(invitation.createdAt)}
                      </TableCell>
                      <TableCell>
                        {formatExpiresAt(invitation.expiresAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
