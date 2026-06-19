"use client"

import { useSearchParams, useRouter } from "next/navigation"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RulesTable } from "./rules-table"
import { MatrixTable } from "./matrix-table"
import { Recommendations } from "./recommendations"
import { LogViewer } from "./log-viewer"

type TabValue = "rules" | "matrix" | "recommendations" | "logs"

const TABS: { value: TabValue; label: string }[] = [
  { value: "rules", label: "Detection Rules" },
  { value: "matrix", label: "Runtime Matrix" },
  { value: "recommendations", label: "AI Suggestions" },
  { value: "logs", label: "Inspection Logs" },
]

export function DetectorTabs({ defaultTab }: { defaultTab?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const rawTab = searchParams.get("tab") ?? defaultTab
  const activeTab = TABS.find((tab) => tab.value === rawTab)?.value ?? "rules"

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

      {activeTab === "rules" && <RulesTable />}
      {activeTab === "matrix" && <MatrixTable />}
      {activeTab === "recommendations" && <Recommendations />}
      {activeTab === "logs" && <LogViewer />}
    </div>
  )
}
