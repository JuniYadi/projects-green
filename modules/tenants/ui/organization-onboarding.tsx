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
  userEmail?: string
  showWarning?: boolean
}

const getOrgNameSuggestion = (email?: string): string => {
  if (!email) return ""
  const localPart = email.split("@")[0] || ""
  const parts = localPart.split(/[.\-_+]/)
  const capitalized = parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
  const baseName = capitalized.join(" ")
  return baseName ? `${baseName} Org's` : ""
}

export function OrganizationOnboarding({
  nextPath,
  userEmail,
  showWarning,
}: OrganizationOnboardingProps) {
  const router = useRouter()
  const { switchToOrganization } = useAuth({ ensureSignedIn: true })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [memberships, setMemberships] = useState<TenantBootstrapMembership[]>(
    []
  )
  const [organizationName, setOrganizationName] = useState(() =>
    getOrgNameSuggestion(userEmail)
  )
  const [isCreating, setIsCreating] = useState(false)
  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null)
  const [currency, setCurrency] = useState<"IDR" | "USD">("IDR")

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

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isCreating || Boolean(switchingOrgId)) {
        return
      }
      event.preventDefault()
      event.returnValue =
        "Organization setup is required. Are you sure you want to leave?"
      return event.returnValue
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [isCreating, switchingOrgId])

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
        body: JSON.stringify({ name: candidateName, currency }),
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

  const hasInvitations =
    !isLoading &&
    (activeMemberships.length > 0 || pendingMemberships.length > 0)

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Set up your organization</h1>
        <p className="text-sm text-muted-foreground">
          {hasInvitations
            ? "Create your first organization or join one where you already have an active membership."
            : "Create your first organization to get started."}
        </p>
      </header>

      {showWarning ? (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
          Organization setup is required to access the console.
        </div>
      ) : null}

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
        <p className="text-xs text-muted-foreground">
          Billing currency is set once at creation and locked after the first
          financial activity. IDR supports automatic payment methods (Virtual
          Account, QRIS); USD is manual transfer only.
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
          <select
            value={currency}
            onChange={(event) =>
              setCurrency(event.target.value === "USD" ? "USD" : "IDR")
            }
            disabled={isCreating || Boolean(switchingOrgId)}
            aria-label="Billing currency"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="IDR">IDR</option>
            <option value="USD">USD</option>
          </select>
          <Button
            type="submit"
            disabled={isCreating || Boolean(switchingOrgId)}
          >
            {isCreating ? "Creating..." : "Create organization"}
          </Button>
        </form>
      </section>

      {!isLoading &&
      (activeMemberships.length > 0 || pendingMemberships.length > 0) ? (
        <section className="space-y-3 rounded-lg border border-border p-4 md:p-6">
          <h2 className="text-lg font-semibold">Join existing organization</h2>
          <p className="text-sm text-muted-foreground">
            Select from your active organization memberships.
          </p>

          {activeMemberships.length > 0 ? (
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

          {activeMemberships.length === 0 && pendingMemberships.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              You have pending invitations. Accept an invitation first, then
              come back here to join.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
