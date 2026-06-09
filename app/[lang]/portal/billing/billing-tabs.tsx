"use client"

import { useSearchParams, useRouter } from "next/navigation"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OverviewTab } from "./tabs/overview-tab"
import { UsageTab } from "./tabs/usage-tab"
import { SubscriptionsTab } from "./tabs/subscriptions-tab"
import { AdjustmentsTab } from "./tabs/adjustments-tab"

type TabValue = "overview" | "usage" | "subscriptions" | "adjustments"

const TABS: { value: TabValue; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "usage", label: "Usage" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "adjustments", label: "Adjustments" },
]

export function BillingTabs({ lang }: { lang: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const activeTab = (searchParams.get("tab") as TabValue) ?? "overview"

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", value)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {activeTab === "overview" && <OverviewTab lang={lang} />}
      {activeTab === "usage" && <UsageTab lang={lang} />}
      {activeTab === "subscriptions" && <SubscriptionsTab />}
      {activeTab === "adjustments" && <AdjustmentsTab />}
    </div>
  )
}