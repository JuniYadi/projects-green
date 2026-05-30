"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { PlusIcon, ExportIcon } from "@phosphor-icons/react"

import { AdjustmentTable } from "@/components/billing/admin/adjustment-table"
import { AdjustmentForm } from "@/components/billing/admin/adjustment-form"
import { getAdminAdjustments, getAccount } from "@/lib/billing-client"
import type { AdminAdjustment } from "@/lib/billing-client"

function exportToCsv(adjustments: AdminAdjustment[]) {
  const headers = ["Date", "Type", "Amount", "Currency", "Reason", "Admin"]
  const rows = adjustments.map((a) => [
    a.createdAt,
    a.type,
    a.amountIdr,
    a.currency,
    a.reason || "",
    a.createdByWorkosUserId || "System",
  ])
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `adjustments-${new Date().toISOString().split("T")[0]}.csv`
  a.click()
}

export function AdjustmentsTab() {
  const [adjustments, setAdjustments] = useState<AdminAdjustment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [tenantId, setTenantId] = useState<string>("")
  const [selectedType, setSelectedType] = useState<string>("ALL")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true)
        // Load adjustments with filters
        const adjustResponse = await getAdminAdjustments({
          type: selectedType !== "ALL" ? (selectedType as "CREDIT" | "DEBIT" | "WRITEOFF") : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        })
        setAdjustments(adjustResponse.adjustments)

        // Load account for tenantId
        const accountResponse = await getAccount()
        setTenantId(accountResponse.tenantId)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load adjustments"
        )
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [selectedType, startDate, endDate])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          {error}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2 items-center">
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="CREDIT">Credit</SelectItem>
              <SelectItem value="DEBIT">Debit</SelectItem>
              <SelectItem value="WRITEOFF">Writeoff</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[150px]"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[150px]"
          />
        </div>
        <Button variant="outline" onClick={() => exportToCsv(adjustments)}>
          <ExportIcon className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setIsFormOpen(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          New Adjustment
        </Button>
      </div>

      <AdjustmentTable adjustments={adjustments} />

      {tenantId && (
        <AdjustmentForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          tenantId={tenantId}
          onSuccess={() => {
            // Reload adjustments after successful creation
            getAdminAdjustments()
              .then((res) => setAdjustments(res.adjustments))
              .catch(console.error)
          }}
        />
      )}
    </div>
  )
}
