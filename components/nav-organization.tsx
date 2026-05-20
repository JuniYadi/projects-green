"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@workos-inc/authkit-nextjs/components"
import { CheckCircleIcon, CaretUpDownIcon } from "@phosphor-icons/react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { defaultLocale, type AppLocale } from "@/lib/i18n/config"
import { getMessages } from "@/lib/i18n/messages"
import { getLocaleFromPathname, localizePathname } from "@/lib/i18n/pathname"
import type { AppSidebarOrganization } from "@/components/app-sidebar"
import {
  isTenantApiError,
  type TenantApiError,
  type TenantBootstrapMembership,
  type TenantBootstrapResponse,
  type TenantOrganizationCreateResponse,
} from "@/modules/tenants/contracts/tenant-api.contract"

const resolveOrganizationInitials = (value: string) => {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "NO"
  )
}

export function NavOrganization({
  organization,
}: {
  organization: AppSidebarOrganization
}) {
  const { isMobile } = useSidebar()
  const { switchToOrganization } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [memberships, setMemberships] = useState<TenantBootstrapMembership[]>(
    []
  )
  const [bootstrapOrgId, setBootstrapOrgId] = useState<string | null>(null)
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(true)
  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const { locale: pathnameLocale } = getLocaleFromPathname(pathname)
  const activeLocale = (pathnameLocale ?? defaultLocale) as AppLocale
  const messages = getMessages(activeLocale)

  const currentPathWithQuery = useMemo(() => {
    const query = searchParams.toString()
    return query ? `${pathname}?${query}` : pathname
  }, [pathname, searchParams])

  const currentOrganizationId = useMemo(() => {
    const fromBootstrap = bootstrapOrgId?.trim()
    if (fromBootstrap) {
      return fromBootstrap
    }

    return organization.id?.trim() || null
  }, [bootstrapOrgId, organization.id])

  const activeMemberships = useMemo(() => {
    return memberships.filter((membership) => membership.status === "active")
  }, [memberships])

  const currentMembership = useMemo(() => {
    if (!currentOrganizationId) {
      return null
    }

    return (
      activeMemberships.find(
        (membership) => membership.organizationId === currentOrganizationId
      ) ?? null
    )
  }, [activeMemberships, currentOrganizationId])

  useEffect(() => {
    let isActive = true

    const run = async () => {
      setIsLoadingMemberships(true)

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
          setBootstrapOrgId(null)
          setMemberships([])
          return
        }

        setBootstrapOrgId(payload.currentOrganizationId)
        setMemberships(payload.memberships)
      } catch {
        if (isActive) {
          setBootstrapOrgId(null)
          setMemberships([])
        }
      } finally {
        if (isActive) {
          setIsLoadingMemberships(false)
        }
      }
    }

    void run()

    return () => {
      isActive = false
    }
  }, [])

  const handleSwitchOrganization = async (organizationId: string) => {
    if (!organizationId || organizationId === currentOrganizationId) {
      return
    }

    setActionError(null)
    setSwitchingOrgId(organizationId)

    try {
      await switchToOrganization(organizationId, {
        returnTo: currentPathWithQuery,
      })

      router.replace(currentPathWithQuery)
      router.refresh()
    } catch {
      setActionError(messages.navOrganization.switchOrganizationError)
      setSwitchingOrgId(null)
    }
  }

  const handleCreateOrganization = async () => {
    const promptValue = window.prompt(
      messages.navOrganization.createOrganizationPlaceholder
    )

    if (promptValue === null) {
      return
    }

    const candidateName = promptValue.trim()
    if (!candidateName) {
      setActionError(messages.navOrganization.organizationNameRequired)
      return
    }

    setActionError(null)
    setIsCreating(true)

    try {
      const response = await fetch("/api/tenants/organizations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: candidateName }),
      })
      const payload = (await response.json().catch(() => null)) as
        | TenantOrganizationCreateResponse
        | TenantApiError
        | null

      if (!response.ok || !payload || isTenantApiError(payload)) {
        setActionError(
          payload && isTenantApiError(payload)
            ? payload.message
            : messages.navOrganization.createOrganizationError
        )
        return
      }

      await handleSwitchOrganization(payload.organizationId)
    } catch {
      setActionError(messages.navOrganization.createOrganizationError)
    } finally {
      setIsCreating(false)
    }
  }

  const organizationName =
    currentMembership?.organizationName ||
    organization.name?.trim() ||
    messages.navOrganization.organizationUnknown
  const organizationMeta = currentOrganizationId
    ? messages.navOrganization.organizationMeta
    : messages.navOrganization.noActiveOrganizationMeta

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <span className="text-xs font-semibold">
                  {resolveOrganizationInitials(organizationName)}
                </span>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{organizationName}</span>
                <span className="truncate text-xs">{organizationMeta}</span>
              </div>
              <CaretUpDownIcon className="ml-auto size-4" />
              <span className="sr-only">{messages.navOrganization.label}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-64 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel>
              {messages.navOrganization.switchOrganizationLabel}
            </DropdownMenuLabel>
            {isLoadingMemberships ? (
              <DropdownMenuItem disabled>
                {messages.navOrganization.loadingOrganizationsLabel}
              </DropdownMenuItem>
            ) : null}
            {!isLoadingMemberships && activeMemberships.length === 0 ? (
              <DropdownMenuItem disabled>
                {messages.navOrganization.noOrganizationsLabel}
              </DropdownMenuItem>
            ) : null}
            {!isLoadingMemberships
              ? activeMemberships.map((membership) => {
                  const isCurrent =
                    membership.organizationId === currentOrganizationId
                  const isSwitching = switchingOrgId === membership.organizationId

                  return (
                    <DropdownMenuItem
                      key={membership.organizationId}
                      disabled={isCurrent || Boolean(switchingOrgId) || isCreating}
                      onSelect={(event) => {
                        event.preventDefault()
                        void handleSwitchOrganization(membership.organizationId)
                      }}
                    >
                      <span className="flex flex-1 items-center justify-between gap-2">
                        <span className="truncate">
                          {isSwitching
                            ? messages.navOrganization.switchingLabel
                            : membership.organizationName}
                        </span>
                        {isCurrent ? (
                          <span className="text-xs text-muted-foreground">
                            {messages.navOrganization.activeLabel}
                          </span>
                        ) : null}
                      </span>
                    </DropdownMenuItem>
                  )
                })
              : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isCreating || Boolean(switchingOrgId)}
              onSelect={(event) => {
                event.preventDefault()
                void handleCreateOrganization()
              }}
            >
              {isCreating
                ? messages.navOrganization.creatingOrganizationLabel
                : messages.navOrganization.createOrganizationActionLabel}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href={localizePathname({
                  pathname: "/console/organization",
                  locale: activeLocale,
                })}
              >
                <CheckCircleIcon />
                {messages.navOrganization.organizationMembersLabel}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href={localizePathname({
                  pathname: "/console/organization",
                  locale: activeLocale,
                })}
              >
                <CheckCircleIcon />
                {messages.navOrganization.organizationSettingsLabel}
              </Link>
            </DropdownMenuItem>
            {actionError ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>{actionError}</DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
