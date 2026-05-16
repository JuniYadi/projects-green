"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  isTenantApiError,
  type TenantApiError,
  type TenantAuthorizationResponse,
  type TenantInvitationsResponse,
  type TenantInvitationSummary,
  type TenantMembersResponse,
  type TenantMembershipSummary,
} from "@/modules/tenants/contracts/tenant-api.contract"

type TenantMemberManagementProps = {
  organizationId: string
}

export function TenantMemberManagement({
  organizationId,
}: TenantMemberManagementProps) {
  const [authorization, setAuthorization] =
    useState<TenantAuthorizationResponse | null>(null)
  const [members, setMembers] = useState<TenantMembershipSummary[]>([])
  const [invitations, setInvitations] = useState<TenantInvitationSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"member" | "admin" | "owner">(
    "member"
  )
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false)

  const pendingInvitations = useMemo(() => {
    return invitations.filter((item) => item.state === "pending")
  }, [invitations])

  const allowedActions = new Set(authorization?.allowedActions ?? [])

  useEffect(() => {
    let isActive = true

    const run = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const [authorizationResponse, membersResponse, invitationsResponse] =
          await Promise.all([
            fetch(`/api/tenants/${organizationId}/authorization`),
            fetch(`/api/tenants/${organizationId}/members`),
            fetch(`/api/tenants/${organizationId}/invitations`),
          ])

        const authorizationPayload = (await authorizationResponse
          .json()
          .catch(() => null)) as
          | TenantAuthorizationResponse
          | TenantApiError
          | null
        const membersPayload = (await membersResponse
          .json()
          .catch(() => null)) as TenantMembersResponse | TenantApiError | null
        const invitationsPayload = (await invitationsResponse
          .json()
          .catch(() => null)) as
          | TenantInvitationsResponse
          | TenantApiError
          | null

        if (!isActive) {
          return
        }

        if (
          !authorizationResponse.ok ||
          !authorizationPayload ||
          isTenantApiError(authorizationPayload)
        ) {
          setError(
            authorizationPayload && isTenantApiError(authorizationPayload)
              ? authorizationPayload.message
              : "Unable to load tenant authorization."
          )
          return
        }

        if (
          !membersResponse.ok ||
          !membersPayload ||
          isTenantApiError(membersPayload)
        ) {
          setError(
            membersPayload && isTenantApiError(membersPayload)
              ? membersPayload.message
              : "Unable to load tenant members."
          )
          return
        }

        if (
          !invitationsResponse.ok ||
          !invitationsPayload ||
          isTenantApiError(invitationsPayload)
        ) {
          setError(
            invitationsPayload && isTenantApiError(invitationsPayload)
              ? invitationsPayload.message
              : "Unable to load tenant invitations."
          )
          return
        }

        setAuthorization(authorizationPayload)
        setMembers(membersPayload.members)
        setInvitations(invitationsPayload.invitations)
      } catch {
        if (!isActive) {
          return
        }

        setError("Network error while loading tenant management data.")
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void run()

    return () => {
      isActive = false
    }
  }, [organizationId, reloadKey])

  const postAction = async (path: string, body?: unknown) => {
    setError(null)
    setNotice(null)

    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const payload = (await response.json().catch(() => null)) as
      | TenantApiError
      | { ok: true }
      | null

    if (!response.ok || !payload || isTenantApiError(payload)) {
      const message =
        payload && isTenantApiError(payload)
          ? payload.message
          : "Action failed. Please try again."
      throw new Error(message)
    }
  }

  const onInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!inviteEmail.trim()) {
      setError("Invite email is required.")
      return
    }

    setIsSubmittingInvite(true)
    setError(null)
    setNotice(null)

    try {
      await postAction(`/api/tenants/${organizationId}/invitations`, {
        email: inviteEmail.trim(),
        targetRole: inviteRole,
      })

      setNotice(`Invitation sent for ${inviteEmail.trim()}.`)
      setInviteEmail("")
      setReloadKey((current) => current + 1)
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to send invitation."
      )
    } finally {
      setIsSubmittingInvite(false)
    }
  }

  const onPromoteToAdmin = async (membershipId: string) => {
    try {
      await postAction(
        `/api/tenants/${organizationId}/members/${membershipId}/promote`,
        { targetRole: "admin" }
      )
      setNotice("Member promoted to admin.")
      setReloadKey((current) => current + 1)
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Promotion failed."
      )
    }
  }

  const onPromoteToOwner = async (membershipId: string) => {
    try {
      await postAction(
        `/api/tenants/${organizationId}/members/${membershipId}/promote`,
        { targetRole: "owner" }
      )
      setNotice("Member promoted to owner.")
      setReloadKey((current) => current + 1)
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Promotion failed."
      )
    }
  }

  const onDemote = async (membershipId: string) => {
    try {
      await postAction(
        `/api/tenants/${organizationId}/members/${membershipId}/demote`
      )
      setNotice("Member demoted to member role.")
      setReloadKey((current) => current + 1)
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Demotion failed."
      )
    }
  }

  const onTransferOwnership = async (membershipId: string) => {
    try {
      await postAction(`/api/tenants/${organizationId}/ownership/transfer`, {
        newOwnerMembershipId: membershipId,
      })
      setNotice("Ownership transferred successfully.")
      setReloadKey((current) => current + 1)
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Ownership transfer failed."
      )
    }
  }

  return (
    <section className="space-y-4 rounded-none border border-border p-4 md:p-6">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">Tenant Member Management</h2>
        <p className="text-sm text-muted-foreground">
          Organization: {organizationId}
        </p>
        <p className="text-sm text-muted-foreground">
          Effective role: {authorization?.effectiveGlobalRole ?? "none"} /{" "}
          {authorization?.effectiveTenantRole ?? "none"}
        </p>
      </header>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading tenant data...</p>
      ) : null}

      <form className="space-y-3" onSubmit={onInvite}>
        <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
          <Input
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="user@company.com"
            disabled={
              !allowedActions.has("invite_member") &&
              !allowedActions.has("invite_admin")
            }
          />
          <select
            className="h-9 rounded-none border border-input bg-background px-3 text-sm"
            value={inviteRole}
            onChange={(event) =>
              setInviteRole(event.target.value as "member" | "admin" | "owner")
            }
            disabled={
              !allowedActions.has("invite_member") &&
              !allowedActions.has("invite_admin")
            }
          >
            <option value="member">member</option>
            <option value="admin">admin</option>
            <option value="owner">owner</option>
          </select>
          <Button
            type="submit"
            disabled={
              isSubmittingInvite ||
              (!allowedActions.has("invite_member") &&
                !allowedActions.has("invite_admin"))
            }
          >
            {isSubmittingInvite ? "Sending..." : "Invite"}
          </Button>
        </div>
      </form>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Members
        </h3>
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex flex-col gap-2 border border-border p-3 text-sm md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-medium">{member.userId}</p>
                <p className="text-xs text-muted-foreground">
                  role: {member.role ?? "unknown"} | status: {member.status}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {member.role === "member" &&
                allowedActions.has("promote_member") ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void onPromoteToAdmin(member.id)}
                  >
                    Promote to admin
                  </Button>
                ) : null}

                {member.role !== "owner" &&
                allowedActions.has("promote_owner") ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void onPromoteToOwner(member.id)}
                  >
                    Promote to owner
                  </Button>
                ) : null}

                {(member.role === "admin" || member.role === "owner") &&
                (allowedActions.has("demote_admin") ||
                  allowedActions.has("demote_owner")) ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void onDemote(member.id)}
                  >
                    Demote to member
                  </Button>
                ) : null}

                {member.role !== "owner" &&
                allowedActions.has("transfer_ownership") ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void onTransferOwnership(member.id)}
                  >
                    Transfer ownership
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {!members.length ? (
            <p className="text-sm text-muted-foreground">No members found.</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Pending Invitations
        </h3>
        <div className="space-y-2">
          {pendingInvitations.map((invitation) => (
            <div
              key={invitation.id}
              className="border border-border p-3 text-sm"
            >
              <p className="font-medium">{invitation.email}</p>
              <p className="text-xs text-muted-foreground">
                role: {invitation.roleSlug ?? "member"} | expires:{" "}
                {invitation.expiresAt}
              </p>
            </div>
          ))}
          {!pendingInvitations.length ? (
            <p className="text-sm text-muted-foreground">
              No pending invitations.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
