"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlusIcon } from "@phosphor-icons/react"

import { AdjustmentTable } from "@/components/billing/admin/adjustment-table"
import { AdjustmentForm } from "@/components/billing/admin/adjustment-form"
import { getAdminAdjustments, getAccount } from "@/lib/billing-client"
import type { AdminAdjustment } from "@/lib/billing-client"

export function AdjustmentsTab() {
  const [adjustments, setAdjustments] = useState<AdminAdjustment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [tenantId, setTenantId] = useState<string>("")

  useEffect(() => {
    async function loadData() {
      try {
        // Load adjustments
        const adjustResponse = await getAdminAdjustments()
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
  }, [])

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