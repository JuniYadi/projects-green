"use client"

import { useSearchParams, useRouter } from "next/navigation"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OverviewTab } from "./overview/overview-tab"
import { GatewaysTab } from "./gateways/gateways-tab"
import { BankAccountsTab } from "./bank-accounts/bank-accounts-tab"
import { ConfirmationsTab } from "./confirmations/confirmations-tab"

type TabValue = "overview" | "gateways" | "bank-accounts" | "confirmations"

const TABS: { value: TabValue; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "gateways", label: "Gateways" },
  { value: "bank-accounts", label: "Bank Accounts" },
  { value: "confirmations", label: "Confirmations" },
]

export function PaymentTabs() {
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

      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "gateways" && <GatewaysTab />}
      {activeTab === "bank-accounts" && <BankAccountsTab />}
      {activeTab === "confirmations" && <ConfirmationsTab />}
    </div>
  )
}
