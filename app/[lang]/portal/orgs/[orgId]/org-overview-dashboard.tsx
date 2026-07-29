"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getAdminOrgDetail, type AdminOrgDetail } from "@/lib/billing-client"
import { BalanceTab } from "@/app/[lang]/portal/billing/org/[orgId]/tabs/balance-tab"
import { OverviewTab } from "./overview-tab"
import { UsageTab } from "@/app/[lang]/portal/billing/org/[orgId]/tabs/usage-tab"
import { SubscriptionsTab } from "@/app/[lang]/portal/billing/org/[orgId]/tabs/subscriptions-tab"
import { AdjustmentsTab } from "@/app/[lang]/portal/billing/org/[orgId]/tabs/adjustments-tab"
import { MembersTable } from "@/app/[lang]/portal/admin/organizations/[id]/members-table"
import { SupportTicketsPortal } from "@/app/[lang]/portal/support-tickets/support-tickets-portal"

type OrgOverviewDashboardProps = {
  lang: string
  orgId: string
  defaultPage?: string
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "billing", label: "Billing" },
  { key: "invoices", label: "Invoices" },
  { key: "usage", label: "Usage" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "adjustments", label: "Adjustments" },
  { key: "members", label: "Members" },
  { key: "support", label: "Support Tickets" },
] as const

type TabKey = (typeof TABS)[number]["key"]

export function OrgOverviewDashboard({
  lang,
  orgId,
  defaultPage,
}: OrgOverviewDashboardProps) {
  const router = useRouter()
  const [orgDetail, setOrgDetail] = useState<AdminOrgDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const validKeys = TABS.map((t) => t.key)

  const activeTab: TabKey = (
    validKeys.includes(defaultPage as TabKey) ? defaultPage : "overview"
  ) as TabKey

  useEffect(() => {
    let cancelled = false
    getAdminOrgDetail(orgId)
      .then((detail) => {
        if (!cancelled) setOrgDetail(detail)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [orgId])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-destructive">
          Failed to load organization: {error}
        </CardContent>
      </Card>
    )
  }

  if (!orgDetail) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          Organization not found.
        </CardContent>
      </Card>
    )
  }

  const org = orgDetail.org

  return (
    <div className="space-y-6">
      {/* Compact header (no balance — BalanceTab owns that) */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{org.orgName}</h1>
        <p className="text-sm text-muted-foreground">
          {org.orgId} · {org.status} · {org.currency}
        </p>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          router.replace(`?page=${v}`, { scroll: false })
        }}
      >
        <TabsList className="flex-wrap">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          {activeTab === "overview" && (
            <OverviewTab _lang={lang} orgId={orgId} orgDetail={orgDetail} />
          )}
          {activeTab === "billing" && (
            <BalanceTab lang={lang} orgId={orgId} orgDetail={orgDetail} />
          )}
          {activeTab === "usage" && <UsageTab orgId={orgId} />}
          {activeTab === "subscriptions" && <SubscriptionsTab orgId={orgId} />}
          {activeTab === "adjustments" && <AdjustmentsTab orgId={orgId} />}
          {activeTab === "members" && <MembersTable organizationId={orgId} />}
          {activeTab === "support" && (
            <SupportTicketsPortal lang={lang} organizationId={orgId} />
          )}
        </div>
      </Tabs>
    </div>
  )
}
