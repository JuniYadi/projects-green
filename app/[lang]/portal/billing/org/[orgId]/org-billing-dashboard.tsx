"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeftIcon } from "@phosphor-icons/react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getAdminOrgDetail,
  type AdminOrgDetail,
} from "@/lib/billing-client"
import { BalanceTab } from "./tabs/balance-tab"
import { TopupTab } from "./tabs/topup-tab"
import { InvoicesTab } from "./tabs/invoices-tab"
import { UsageTab } from "./tabs/usage-tab"
import { SubscriptionsTab } from "./tabs/subscriptions-tab"
import { AdjustmentsTab } from "./tabs/adjustments-tab"
import { AlertsTab } from "./tabs/alerts-tab"
import { ContactsTab } from "./tabs/contacts-tab"
import { SettingsTab } from "./tabs/settings-tab"

type OrgBillingDashboardProps = {
  lang: string
  orgId: string
}

const TABS = [
  "balance",
  "topup",
  "invoices",
  "usage",
  "subscriptions",
  "adjustments",
  "alerts",
  "contacts",
  "settings",
] as const

type TabValue = (typeof TABS)[number]

function formatCurrency(amount: string): string {
  return `Rp ${Number(amount).toLocaleString("id-ID")}`
}

export function OrgBillingDashboard({
  lang,
  orgId,
}: OrgBillingDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabValue>("balance")
  const [orgDetail, setOrgDetail] = useState<AdminOrgDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
          href={`/${lang}/portal/billing`}
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
          href={`/${lang}/portal/billing`}
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
          href={`/${lang}/portal/billing`}
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
        onValueChange={(v) => setActiveTab(v as TabValue)}
      >
        <TabsList className="flex-wrap">
          {TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="capitalize">
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          {activeTab === "balance" && (
            <BalanceTab
              lang={lang}
              orgId={orgId}
              orgDetail={orgDetail}
            />
          )}
          {activeTab === "topup" && <TopupTab orgId={orgId} />}
          {activeTab === "invoices" && (
            <InvoicesTab orgId={orgId} recentInvoices={org.recentInvoices} />
          )}
          {activeTab === "usage" && <UsageTab orgId={orgId} />}
          {activeTab === "subscriptions" && (
            <SubscriptionsTab orgId={orgId} />
          )}
          {activeTab === "adjustments" && (
            <AdjustmentsTab orgId={orgId} />
          )}
          {activeTab === "alerts" && <AlertsTab orgId={orgId} />}
          {activeTab === "contacts" && (
            <ContactsTab orgId={orgId} />
          )}
          {activeTab === "settings" && <SettingsTab orgId={orgId} />}
        </div>
      </Tabs>
    </div>
  )
}
