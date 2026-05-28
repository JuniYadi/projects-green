"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DotsThreeVerticalIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react"
import { Skeleton } from "@/components/ui/skeleton"
import type {
  TenantInvitationSummary,
  TenantAuthorizationResponse,
} from "@/modules/tenants/contracts/tenant-api.contract"
import type { TenantAction } from "@/modules/tenants/tenant-policy"

type InvitationsViewProps = {
  organizationId: string
}

export function InvitationsView({ organizationId }: InvitationsViewProps) {
  const [invitations, setInvitations] = useState<TenantInvitationSummary[]>([])
  const [authorization, setAuthorization] = useState<TenantAuthorizationResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("member")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [authRes, invRes] = await Promise.all([
        fetch(`/api/tenants/${organizationId}/authorization`).then(r => r.json()),
        fetch(`/api/tenants/${organizationId}/invitations`).then(r => r.json())
      ])

      if (authRes.ok) setAuthorization(authRes)
      if (invRes.ok) {
        setInvitations(invRes.invitations)
      } else {
        setError(invRes.message || "Failed to load invitations")
      }
    } catch (err) {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/tenants/${organizationId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, targetRole: role })
      }).then(r => r.json())

      if (res.ok) {
        setEmail("")
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadData()
      } else {
        setError(res.message || "Failed to send invitation")
      }
    } catch (_err) {
      setError("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAction = async (path: string) => {
    setError(null)
    try {
      const res = await fetch(path, { method: "POST" }).then(r => r.json())
      if (res.ok) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadData()
      } else {
        setError(res.message || "Action failed")
      }
    } catch (_err) {
      setError("An unexpected error occurred")
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }

  const allowedActions = new Set((authorization?.allowedActions as TenantAction[]) || [])
  const canInvite = allowedActions.has("invite_member") || allowedActions.has("invite_admin")

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {canInvite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Invite New Member</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="w-full sm:w-[150px]">
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    {allowedActions.has("invite_admin") && (
                      <SelectItem value="admin">Admin</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={isSubmitting}>
                <PaperPlaneTiltIcon className="mr-2 h-4 w-4" />
                {isSubmitting ? "Sending..." : "Send Invitation"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No pending invitations
                </TableCell>
              </TableRow>
            ) : (
              invitations.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell className="font-medium">{invitation.email}</TableCell>
                  <TableCell className="capitalize">{invitation.roleSlug || "Member"}</TableCell>
                  <TableCell>{new Date(invitation.expiresAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <DotsThreeVerticalIcon className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleAction(`/api/tenants/${organizationId}/invitations/${invitation.id}/resend`)}>
                          Resend
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            if (confirm("Are you sure you want to revoke this invitation?")) {
                              handleAction(`/api/tenants/${organizationId}/invitations/${invitation.id}/revoke`)
                            }
                          }}
                        >
                          Revoke
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
