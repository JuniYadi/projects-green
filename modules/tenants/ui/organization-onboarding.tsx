"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { useAuth } from "@workos-inc/authkit-nextjs/components"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  isTenantApiError,
  type TenantApiError,
  type TenantBootstrapCreateResponse,
  type TenantBootstrapMembership,
  type TenantBootstrapResponse,
} from "@/modules/tenants/contracts/tenant-api.contract"

type OrganizationOnboardingProps = {
  nextPath: string
}

export function OrganizationOnboarding({
  nextPath,
}: OrganizationOnboardingProps) {
  const router = useRouter()
  const { switchToOrganization } = useAuth({ ensureSignedIn: true })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [memberships, setMemberships] = useState<TenantBootstrapMembership[]>(
    []
  )
  const [organizationName, setOrganizationName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null)

  const activeMemberships = useMemo(() => {
    return memberships.filter((membership) => membership.status === "active")
  }, [memberships])

  const pendingMemberships = useMemo(() => {
    return memberships.filter((membership) => membership.status === "pending")
  }, [memberships])

  useEffect(() => {
    let isActive = true

    const run = async () => {
      try {
        const response = await fetch("/api/tenants/bootstrap")
        const payload = (await response.json().catch(() => null)) as
          | TenantBootstrapResponse
          | TenantApiError
          | null

        if (!isActive) {
          return
        }

        if (!response.ok || !payload || isTenantApiError(payload)) {
          setError(
            payload && isTenantApiError(payload)
              ? payload.message
              : "Unable to load organization onboarding data."
          )
          return
        }

        setMemberships(payload.memberships)
      } catch {
        if (isActive) {
          setError("Network error while loading organization data.")
        }
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
  }, [])

  const handleSwitchOrganization = async (organizationId: string) => {
    setError(null)
    setSwitchingOrgId(organizationId)
    const destinationPath = nextPath || "/console"

    try {
      await switchToOrganization(organizationId, {
        returnTo: destinationPath,
      })

      router.replace(destinationPath)
      router.refresh()
    } catch {
      setError("Unable to switch organization. Please try again.")
      setSwitchingOrgId(null)
    }
  }

  const onCreateOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const candidateName = organizationName.trim()

    if (!candidateName) {
      setError("Organization name is required.")
      return
    }

    setError(null)
    setIsCreating(true)

    try {
      const response = await fetch("/api/tenants/bootstrap/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: candidateName }),
      })
      const payload = (await response.json().catch(() => null)) as
        | TenantBootstrapCreateResponse
        | TenantApiError
        | null

      if (!response.ok || !payload || isTenantApiError(payload)) {
        setError(
          payload && isTenantApiError(payload)
            ? payload.message
            : "Unable to create organization right now."
        )
        return
      }

      setOrganizationName("")
      await handleSwitchOrganization(payload.organizationId)
    } catch {
      setError("Network error while creating organization.")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="space-y-3 rounded-lg border border-border p-4 md:p-6">
        <h2 className="text-lg font-semibold">Create organization</h2>
        <p className="text-sm text-muted-foreground">
          This creates a new organization and assigns you the owner role.
        </p>
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            void onCreateOrganization(event)
          }}
        >
          <Input
            value={organizationName}
            placeholder="Organization name"
            onChange={(event) => setOrganizationName(event.target.value)}
            disabled={isCreating || Boolean(switchingOrgId)}
          />
          <Button
            type="submit"
            disabled={isCreating || Boolean(switchingOrgId)}
          >
            {isCreating ? "Creating..." : "Create organization"}
          </Button>
        </form>
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4 md:p-6">
        <h2 className="text-lg font-semibold">Join existing organization</h2>
        <p className="text-sm text-muted-foreground">
          Select from your active organization memberships.
        </p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">
            Loading organization memberships...
          </p>
        ) : null}

        {!isLoading && activeMemberships.length > 0 ? (
          <div className="space-y-2">
            {activeMemberships.map((membership) => {
              const isSwitching = switchingOrgId === membership.organizationId

              return (
                <div
                  key={membership.organizationId}
                  className="flex items-center justify-between gap-3 border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {membership.organizationName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Role: {membership.roleSlug ?? "member"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={Boolean(switchingOrgId)}
                    onClick={() => {
                      void handleSwitchOrganization(membership.organizationId)
                    }}
                  >
                    {isSwitching ? "Switching..." : "Join"}
                  </Button>
                </div>
              )
            })}
          </div>
        ) : null}

        {!isLoading &&
        activeMemberships.length === 0 &&
        pendingMemberships.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            You have pending invitations. Accept an invitation first, then come
            back here to join.
          </p>
        ) : null}

        {!isLoading &&
        activeMemberships.length === 0 &&
        pendingMemberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active memberships found yet. Create a new organization above, or
            ask an owner/admin to invite you.
          </p>
        ) : null}
      </section>
    </div>
  )
}
