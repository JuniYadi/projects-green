"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

type TabKey = "members" | "invitations" | "settings"

type TenantAction =
  | "manage_tenant"
  | "invite_member"
  | "invite_admin"
  | "invite_owner"
  | "promote_member"
  | "promote_owner"
  | "demote_admin"
  | "demote_owner"
  | "transfer_ownership"

type TenantRole = "owner" | "admin" | "member" | null

type ApiError = {
  ok: false
  error: string
  message: string
  policyCode?: string
}

type TenantAuthorizationResponse = {
  ok: true
  effectiveGlobalRole: "none" | "super_admin"
  effectiveTenantRole: TenantRole
  allowedActions: TenantAction[]
}

type TenantMember = {
  id: string
  organizationId: string
  userId: string
  status: string
  role: TenantRole
  roleSlug: string | null
  createdAt: string
  updatedAt: string
}

type TenantMembersResponse = {
  ok: true
  members: TenantMember[]
}

type TenantInvitation = {
  id: string
  email: string
  state: string
  organizationId: string | null
  inviterUserId: string | null
  acceptedUserId: string | null
  roleSlug: string | null
  createdAt: string
  expiresAt: string
}

type TenantInvitationsResponse = {
  ok: true
  invitations: TenantInvitation[]
}

type OrganizationProfile = {
  id: string
  name: string
  allowProfilesOutsideOrganization: boolean
  createdAt: string
  updatedAt: string
}

type TenantOrganizationResponse = {
  ok: true
  organization: OrganizationProfile
}

type OrganizationAdminSurfaceProps = {
  organizationId: string
}

const TAB_OPTIONS: Array<{ key: TabKey; label: string; description: string }> =
  [
    {
      key: "members",
      label: "Members",
      description: "Manage membership roles, ownership, and removals.",
    },
    {
      key: "invitations",
      label: "Invitations",
      description: "Invite users and manage pending invitations.",
    },
    {
      key: "settings",
      label: "Organization Settings",
      description: "Update organization profile and destructive settings.",
    },
  ]

const isApiError = (value: unknown): value is ApiError => {
  return Boolean(
    value &&
    typeof value === "object" &&
    "ok" in value &&
    (value as { ok?: boolean }).ok === false
  )
}

const toActionLabel = (value: string | null) => {
  if (!value) {
    return "Unknown"
  }

  return value
    .replace(/^user[_:/-]/, "")
    .replaceAll(/[_:/-]/g, " ")
    .trim()
}

const formatTimestamp = (value: string) => {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.valueOf())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed)
}

export function OrganizationAdminSurface({
  organizationId,
}: OrganizationAdminSurfaceProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>("members")

  const [authorization, setAuthorization] =
    useState<TenantAuthorizationResponse | null>(null)
  const [members, setMembers] = useState<TenantMember[]>([])
  const [invitations, setInvitations] = useState<TenantInvitation[]>([])
  const [organization, setOrganization] = useState<OrganizationProfile | null>(
    null
  )

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"member" | "admin" | "owner">(
    "member"
  )
  const [organizationNameDraft, setOrganizationNameDraft] = useState("")
  const [deleteConfirmation, setDeleteConfirmation] = useState("")

  const allowedActions = useMemo(() => {
    return new Set(authorization?.allowedActions ?? [])
  }, [authorization])

  const canManageTenant = allowedActions.has("manage_tenant")

  const allowedInviteRoles = useMemo(() => {
    const roles: Array<"member" | "admin" | "owner"> = []

    if (allowedActions.has("invite_member")) {
      roles.push("member")
    }

    if (allowedActions.has("invite_admin")) {
      roles.push("admin")
    }

    if (allowedActions.has("invite_owner")) {
      roles.push("owner")
    }

    return roles
  }, [allowedActions])

  const selectedInviteRole = allowedInviteRoles.includes(inviteRole)
    ? inviteRole
    : (allowedInviteRoles[0] ?? "member")

  const fetchJson = useCallback(
    async <T,>(path: string, init?: RequestInit) => {
      const response = await fetch(path, init)
      const payload = (await response.json().catch(() => null)) as
        | T
        | ApiError
        | null

      if (!response.ok || !payload || isApiError(payload)) {
        const message =
          payload && isApiError(payload)
            ? payload.message
            : "The request failed."
        throw new Error(message)
      }

      return payload
    },
    []
  )

  const loadTenantData = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "initial") {
        setIsLoading(true)
      } else {
        setIsRefreshing(true)
      }

      setError(null)

      try {
        const authPayload = await fetchJson<TenantAuthorizationResponse>(
          `/api/tenants/${organizationId}/authorization`
        )

        const hasManageTenant =
          authPayload.allowedActions.includes("manage_tenant")

        const [membersPayload, invitationsPayload, orgPayload] = hasManageTenant
          ? await Promise.all([
              fetchJson<TenantMembersResponse>(
                `/api/tenants/${organizationId}/members`
              ),
              fetchJson<TenantInvitationsResponse>(
                `/api/tenants/${organizationId}/invitations`
              ),
              fetchJson<TenantOrganizationResponse>(
                `/api/tenants/${organizationId}/organization`
              ),
            ])
          : [null, null, null]

        setAuthorization(authPayload)
        setMembers(membersPayload?.members ?? [])
        setInvitations(invitationsPayload?.invitations ?? [])
        setOrganization(orgPayload?.organization ?? null)
        setOrganizationNameDraft(orgPayload?.organization.name ?? "")
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load organization administration data."
        )
      } finally {
        if (mode === "initial") {
          setIsLoading(false)
        } else {
          setIsRefreshing(false)
        }
      }
    },
    [fetchJson, organizationId]
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTenantData("initial")
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadTenantData])

  const runAction = useCallback(
    async (
      actionId: string,
      options: {
        path: string
        body?: unknown
        successMessage: string
        refresh?: boolean
      }
    ) => {
      setPendingActionId(actionId)
      setError(null)
      setNotice(null)

      try {
        await fetchJson(options.path, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
        })

        setNotice(options.successMessage)

        if (options.refresh ?? true) {
          await loadTenantData("refresh")
        }

        return true
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "Action failed. Please try again."
        )
        return false
      } finally {
        setPendingActionId(null)
      }
    },
    [fetchJson, loadTenantData]
  )

  const onInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const email = inviteEmail.trim()

    if (!email) {
      setError("Invite email is required.")
      return
    }

    const invitationSent = await runAction("invite", {
      path: `/api/tenants/${organizationId}/invitations`,
      body: {
        email,
        targetRole: selectedInviteRole,
      },
      successMessage: `Invitation sent to ${email}.`,
    })

    if (invitationSent) {
      setInviteEmail("")
    }
  }

  const pendingInvitations = useMemo(() => {
    return invitations.filter((item) => item.state === "pending")
  }, [invitations])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
        </Card>
        <Card>
          <CardContent className="space-y-3 pt-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 pt-0">
      <Card>
        <CardHeader>
          <CardTitle>Organization Administration</CardTitle>
          <CardDescription>
            Manage members, invitations, and tenant settings for{" "}
            <span className="font-medium">
              {organization?.name ?? organizationId}
            </span>
            .
          </CardDescription>
          <p className="text-xs text-muted-foreground">
            Effective role: {authorization?.effectiveGlobalRole ?? "none"} /{" "}
            {authorization?.effectiveTenantRole ?? "none"}
          </p>
        </CardHeader>
      </Card>

      {error ? (
        <div className="rounded-none border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void loadTenantData("refresh")
              }}
              disabled={isRefreshing}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-none border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TAB_OPTIONS.map((tab) => {
          const isActive = activeTab === tab.key

          return (
            <Button
              key={tab.key}
              type="button"
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </Button>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {TAB_OPTIONS.find((option) => option.key === activeTab)?.description}
        {isRefreshing ? " Refreshing..." : ""}
      </p>

      {activeTab === "members" ? (
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              Promote, demote, transfer ownership, and remove organization
              members.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!canManageTenant ? (
              <p className="rounded-none border border-border p-3 text-sm text-muted-foreground">
                You do not have permission to manage members in this
                organization.
              </p>
            ) : null}

            {members.length === 0 ? (
              <p className="rounded-none border border-dashed border-border p-3 text-sm text-muted-foreground">
                No members found.
              </p>
            ) : (
              members.map((member) => {
                const demoteAllowed =
                  (member.role === "admin" &&
                    allowedActions.has("demote_admin")) ||
                  (member.role === "owner" &&
                    allowedActions.has("demote_owner"))

                const transferAllowed =
                  member.role !== "owner" &&
                  member.status === "active" &&
                  allowedActions.has("transfer_ownership")

                return (
                  <div
                    key={member.id}
                    className="space-y-2 border border-border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{member.userId}</p>
                      <p className="text-xs text-muted-foreground">
                        Role: {member.role ?? "unknown"} | Status:{" "}
                        {member.status}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {member.role === "member" &&
                      allowedActions.has("promote_member") ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={Boolean(pendingActionId)}
                          onClick={() => {
                            void runAction(`promote-admin-${member.id}`, {
                              path:
                                `/api/tenants/${organizationId}` +
                                `/members/${member.id}/promote`,
                              body: { targetRole: "admin" },
                              successMessage: "Member promoted to admin.",
                            })
                          }}
                        >
                          {pendingActionId === `promote-admin-${member.id}`
                            ? "Promoting..."
                            : "Promote to Admin"}
                        </Button>
                      ) : null}

                      {member.role !== "owner" &&
                      allowedActions.has("promote_owner") ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={Boolean(pendingActionId)}
                          onClick={() => {
                            const shouldContinue = window.confirm(
                              "Promote this member to owner?"
                            )

                            if (!shouldContinue) {
                              return
                            }

                            void runAction(`promote-owner-${member.id}`, {
                              path:
                                `/api/tenants/${organizationId}` +
                                `/members/${member.id}/promote`,
                              body: { targetRole: "owner" },
                              successMessage: "Member promoted to owner.",
                            })
                          }}
                        >
                          {pendingActionId === `promote-owner-${member.id}`
                            ? "Promoting..."
                            : "Promote to Owner"}
                        </Button>
                      ) : null}

                      {demoteAllowed ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={Boolean(pendingActionId)}
                          onClick={() => {
                            void runAction(`demote-${member.id}`, {
                              path:
                                `/api/tenants/${organizationId}` +
                                `/members/${member.id}/demote`,
                              successMessage: "Member demoted to member.",
                            })
                          }}
                        >
                          {pendingActionId === `demote-${member.id}`
                            ? "Demoting..."
                            : "Demote to Member"}
                        </Button>
                      ) : null}

                      {transferAllowed ? (
                        <Button
                          size="sm"
                          disabled={Boolean(pendingActionId)}
                          onClick={() => {
                            const shouldContinue = window.confirm(
                              "Transfer ownership to this member?"
                            )

                            if (!shouldContinue) {
                              return
                            }

                            void runAction(`transfer-${member.id}`, {
                              path: `/api/tenants/${organizationId}/ownership/transfer`,
                              body: { newOwnerMembershipId: member.id },
                              successMessage:
                                "Organization ownership transferred.",
                            })
                          }}
                        >
                          {pendingActionId === `transfer-${member.id}`
                            ? "Transferring..."
                            : "Transfer Ownership"}
                        </Button>
                      ) : null}

                      {canManageTenant ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={Boolean(pendingActionId)}
                          onClick={() => {
                            const shouldContinue = window.confirm(
                              "Remove this member from the organization?"
                            )

                            if (!shouldContinue) {
                              return
                            }

                            void runAction(`remove-${member.id}`, {
                              path:
                                `/api/tenants/${organizationId}` +
                                `/members/${member.id}/remove`,
                              successMessage:
                                "Member removed from organization.",
                            })
                          }}
                        >
                          {pendingActionId === `remove-${member.id}`
                            ? "Removing..."
                            : "Remove Member"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "invitations" ? (
        <Card>
          <CardHeader>
            <CardTitle>Invitations</CardTitle>
            <CardDescription>
              Send, revoke, and resend organization invitations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="space-y-3"
              onSubmit={(event) => void onInvite(event)}
            >
              <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="user@company.com"
                  disabled={
                    !allowedInviteRoles.length || Boolean(pendingActionId)
                  }
                />
                <select
                  className="h-9 rounded-none border border-input bg-background px-3 text-sm"
                  value={selectedInviteRole}
                  onChange={(event) =>
                    setInviteRole(
                      event.target.value as "member" | "admin" | "owner"
                    )
                  }
                  disabled={
                    !allowedInviteRoles.length || Boolean(pendingActionId)
                  }
                >
                  {allowedInviteRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <Button
                  type="submit"
                  disabled={
                    !allowedInviteRoles.length || Boolean(pendingActionId)
                  }
                >
                  {pendingActionId === "invite" ? "Sending..." : "Invite"}
                </Button>
              </div>
              {!allowedInviteRoles.length ? (
                <p className="text-xs text-muted-foreground">
                  You do not have permission to send invitations.
                </p>
              ) : null}
            </form>

            {pendingInvitations.length === 0 ? (
              <p className="rounded-none border border-dashed border-border p-3 text-sm text-muted-foreground">
                No pending invitations.
              </p>
            ) : (
              <div className="space-y-3">
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="space-y-2 border border-border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{invitation.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Role: {toActionLabel(invitation.roleSlug)} | Expires:{" "}
                        {formatTimestamp(invitation.expiresAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={Boolean(pendingActionId)}
                        onClick={() => {
                          void runAction(`resend-${invitation.id}`, {
                            path:
                              `/api/tenants/${organizationId}` +
                              `/invitations/${invitation.id}/resend`,
                            successMessage: "Invitation resent.",
                          })
                        }}
                      >
                        {pendingActionId === `resend-${invitation.id}`
                          ? "Resending..."
                          : "Resend"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={Boolean(pendingActionId)}
                        onClick={() => {
                          const shouldContinue = window.confirm(
                            "Revoke this invitation?"
                          )

                          if (!shouldContinue) {
                            return
                          }

                          void runAction(`revoke-${invitation.id}`, {
                            path:
                              `/api/tenants/${organizationId}` +
                              `/invitations/${invitation.id}/revoke`,
                            successMessage: "Invitation revoked.",
                          })
                        }}
                      >
                        {pendingActionId === `revoke-${invitation.id}`
                          ? "Revoking..."
                          : "Revoke"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "settings" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization Profile</CardTitle>
              <CardDescription>
                Keep your organization name and metadata current.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault()

                  void runAction("update-organization", {
                    path: `/api/tenants/${organizationId}/organization/update`,
                    body: { name: organizationNameDraft },
                    successMessage: "Organization profile updated.",
                  })
                }}
              >
                <Input
                  value={organizationNameDraft}
                  onChange={(event) =>
                    setOrganizationNameDraft(event.target.value)
                  }
                  placeholder="Organization name"
                  disabled={Boolean(pendingActionId)}
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={Boolean(pendingActionId)}
                >
                  {pendingActionId === "update-organization"
                    ? "Saving..."
                    : "Save Profile"}
                </Button>
              </form>

              {organization ? (
                <div className="space-y-1 border border-border p-3 text-xs text-muted-foreground">
                  <p>Organization ID: {organization.id}</p>
                  <p>Created: {formatTimestamp(organization.createdAt)}</p>
                  <p>Last updated: {formatTimestamp(organization.updatedAt)}</p>
                </div>
              ) : (
                <p className="rounded-none border border-dashed border-border p-3 text-sm text-muted-foreground">
                  Organization profile is not available.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Danger Zone</CardTitle>
              <CardDescription>
                Delete this organization and all tenant-scoped data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                To confirm deletion, type the organization name exactly:{" "}
                <span className="font-medium text-foreground">
                  {organization?.name ?? "(organization name unavailable)"}
                </span>
                .
              </p>
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault()

                  const shouldContinue = window.confirm(
                    "This permanently deletes the organization. Continue?"
                  )

                  if (!shouldContinue) {
                    return
                  }

                  void (async () => {
                    const deleted = await runAction("delete-organization", {
                      path: `/api/tenants/${organizationId}/organization/delete`,
                      body: {
                        confirmOrganizationName: deleteConfirmation,
                      },
                      successMessage:
                        "Organization deleted. Redirecting to onboarding...",
                      refresh: false,
                    })

                    if (!deleted) {
                      return
                    }

                    router.replace(
                      `/onboarding/organization?next=${encodeURIComponent("/console")}`
                    )
                    router.refresh()
                  })()
                }}
              >
                <Input
                  value={deleteConfirmation}
                  onChange={(event) =>
                    setDeleteConfirmation(event.target.value)
                  }
                  placeholder="Type organization name to confirm"
                  disabled={Boolean(pendingActionId)}
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={Boolean(pendingActionId) || !organization}
                >
                  {pendingActionId === "delete-organization"
                    ? "Deleting..."
                    : "Delete Organization"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
