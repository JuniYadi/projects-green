"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { eden } from "@/lib/eden"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OverviewTab } from "./overview/overview-tab"
import { GatewaysTab } from "./gateways/gateways-tab"
import { BankAccountsTab } from "./bank-accounts/bank-accounts-tab"
import { CurrenciesTab } from "./currencies/currencies-tab"
import { ConfirmationsTab } from "./confirmations/confirmations-tab"

type TabValue =
  | "overview"
  | "gateways"
  | "bank-accounts"
  | "currencies"
  | "confirmations"

const TABS: { value: TabValue; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "gateways", label: "Gateways" },
  { value: "bank-accounts", label: "Bank Accounts" },
  { value: "currencies", label: "Currencies" },
  { value: "confirmations", label: "Confirmations" },
]

export function PaymentTabs({ defaultTab }: { defaultTab?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pendingConfirmations, setPendingConfirmations] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function fetchPendingConfirmations() {
      try {
        const { data } = await eden.api.portal.payments.confirmations.get()
        if (!cancelled && Array.isArray(data)) {
          setPendingConfirmations(data.length)
        }
      } catch {
        // The tab remains usable when the optional badge request fails.
      }
    }

    void fetchPendingConfirmations()

    return () => {
      cancelled = true
    }
  }, [])

  const rawTab = searchParams.get("tab") ?? defaultTab
  const activeTab =
    TABS.find((tab) => tab.value === rawTab)?.value ?? "overview"

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
              {tab.value === "confirmations" && pendingConfirmations > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-1.5 px-1.5 py-0 text-xs"
                >
                  {pendingConfirmations}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "gateways" && <GatewaysTab />}
      {activeTab === "bank-accounts" && <BankAccountsTab />}
      {activeTab === "currencies" && <CurrenciesTab />}
      {activeTab === "confirmations" && <ConfirmationsTab />}
    </div>
  )
}
