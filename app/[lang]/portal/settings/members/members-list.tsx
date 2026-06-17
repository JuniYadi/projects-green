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
  const [authorization, setAuthorization] = useState<TenantAuthorizationResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)

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

  const handleAction = async (actionId: string, path: string, body?: { targetRole: string }) => {
    setPendingActionId(actionId)
    setError(null)
    try {
      // eslint-disable-next-line no-restricted-globals
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
      }).then(r => r.json())

      if (res.ok) {
         
        void loadData()
      } else {
        setError(res.message || "Action failed")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setPendingActionId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  const allowedActions = new Set((authorization?.allowedActions as TenantAction[]) || [])

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.avatarUrl ?? undefined} />
                      <AvatarFallback>{toMemberInitials(member.displayName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium">{member.displayName}</span>
                      <span className="text-xs text-muted-foreground">{member.email}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="capitalize">{member.role || "Member"}</TableCell>
                <TableCell className="capitalize">{member.status}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!!pendingActionId}>
                        <DotsThreeVerticalIcon className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {member.role === "member" && allowedActions.has("promote_member") && (
                        <DropdownMenuItem
                          onClick={() => handleAction(`promote-${member.id}`, `/api/tenants/${organizationId}/members/${member.id}/promote`, { targetRole: "admin" })}
                        >
                          Make Admin
                        </DropdownMenuItem>
                      )}
                      {member.role === "admin" && allowedActions.has("demote_admin") && (
                        <DropdownMenuItem
                          onClick={() => handleAction(`demote-${member.id}`, `/api/tenants/${organizationId}/members/${member.id}/demote`)}
                        >
                          Demote to Member
                        </DropdownMenuItem>
                      )}
                      {allowedActions.has("manage_tenant") && (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            if (confirm("Are you sure you want to remove this member?")) {
                              handleAction(`remove-${member.id}`, `/api/tenants/${organizationId}/members/${member.id}/remove`)
                            }
                          }}
                        >
                          Remove
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
