"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeftIcon } from "@phosphor-icons/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getAdminOrgDetail,
  type AdminOrgDetail,
} from "@/lib/billing-client"
import { BalanceTab } from "@/app/[lang]/portal/billing/org/[orgId]/tabs/balance-tab"
import { UsageTab } from "@/app/[lang]/portal/billing/org/[orgId]/tabs/usage-tab"
import { SettingsTab } from "@/app/[lang]/portal/billing/org/[orgId]/tabs/settings-tab"

type OrgOverviewDashboardProps = {
  lang: string
  orgId: string
  defaultPage?: string
}

const TABS = ["billing", "usage", "members", "settings"] as const
type TabValue = (typeof TABS)[number]

function formatCurrency(amount: string): string {
  return `Rp ${Number(amount).toLocaleString("id-ID")}`
}

export function OrgOverviewDashboard({
  lang,
  orgId,
  defaultPage,
}: OrgOverviewDashboardProps) {
  const initialTab: TabValue = TABS.includes(defaultPage as TabValue)
    ? (defaultPage as TabValue)
    : "billing"
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab)
  const [orgDetail, setOrgDetail] = useState<AdminOrgDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const validTab = TABS.includes(defaultPage as TabValue)
      ? (defaultPage as TabValue)
      : "billing"
    setActiveTab(validTab)
  }, [orgId, defaultPage])

  useEffect(() => {
    getAdminOrgDetail(orgId)
      .then(setOrgDetail)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false))
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
      <div className="space-y-4">
        <Link
          href={`/${lang}/portal/orgs`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Overview
        </Link>
        <Card>
          <CardContent className="py-6 text-center text-destructive">
            Failed to load organization: {error}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!orgDetail) {
    return (
      <div className="space-y-4">
        <Link
          href={`/${lang}/portal/orgs`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Overview
        </Link>
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            Organization not found.
          </CardContent>
        </Card>
      </div>
    )
  }

  const org = orgDetail.org

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/${lang}/portal/orgs`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Overview
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{org.orgName}</h1>
          <p className="text-sm text-muted-foreground">{org.orgId}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(org.balance)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {org.subscriptions.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Monthly Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(org.monthlySpend)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{org.contacts}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as TabValue)
          const params = new URLSearchParams(searchParams.toString())
          params.set("page", v)
          router.replace(`?${params.toString()}`, { scroll: false })
        }}
      >
        <TabsList className="flex-wrap">
          {TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="capitalize">
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          {activeTab === "billing" && (
            <BalanceTab
              lang={lang}
              orgId={orgId}
              orgDetail={orgDetail}
            />
          )}
          {activeTab === "usage" && <UsageTab orgId={orgId} />}
          {activeTab === "members" && (
            <Card>
              <CardHeader>
                <CardTitle>Members</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                {/* ponytail: members tab placeholder; add WorkOS-backed member list when needed */}
                Member management is available in the organization settings.{" "}
                <Link
                  href={`/${lang}/portal/settings/members`}
                  className="underline hover:text-foreground"
                >
                  Manage members
                </Link>
              </CardContent>
            </Card>
          )}
          {activeTab === "settings" && <SettingsTab orgId={orgId} />}
        </div>
      </Tabs>
    </div>
  )
}
