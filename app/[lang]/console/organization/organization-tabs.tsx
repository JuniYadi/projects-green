"use client"

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams, useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MembersList } from "@/app/[lang]/portal/settings/members/members-list"
import { InvitationsView } from "@/app/[lang]/portal/settings/invitations/invitations-view"
import { OwnershipView } from "@/app/[lang]/portal/settings/ownership/ownership-view"

const TABS = ["members", "invitations", "ownership"] as const
type OrganizationTab = (typeof TABS)[number]

const DEFAULT_TAB: OrganizationTab = "members"

const isOrganizationTab = (value: string | null): value is OrganizationTab =>
  value !== null && (TABS as readonly string[]).includes(value)

type OrganizationTabsProps = {
  organizationId: string
}

export function OrganizationTabs({ organizationId }: OrganizationTabsProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tabParam = searchParams.get("tab")
  const activeTab = isOrganizationTab(tabParam) ? tabParam : DEFAULT_TAB

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("tab", value)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-6">
      <TabsList className="h-9">
        <TabsTrigger value="members" className="px-3 text-sm">
          {messages.console.organization.members}
        </TabsTrigger>
        <TabsTrigger value="invitations" className="px-3 text-sm">
          {messages.console.organization.invitations}
        </TabsTrigger>
        <TabsTrigger value="ownership" className="px-3 text-sm">
          {messages.console.organization.ownership}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="members" className="text-sm">
        <MembersList organizationId={organizationId} />
      </TabsContent>
      <TabsContent value="invitations" className="text-sm">
        <InvitationsView organizationId={organizationId} />
      </TabsContent>
      <TabsContent value="ownership" className="text-sm">
        <OwnershipView organizationId={organizationId} />
      </TabsContent>
    </Tabs>
  )
}
