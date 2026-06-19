"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PlusIcon } from "@phosphor-icons/react"
import { AdjustmentTable } from "@/components/billing/admin/adjustment-table"
import { AdjustmentForm } from "@/components/billing/admin/adjustment-form"
import {
  getAdminAdjustments,
  type AdminAdjustment,
} from "@/lib/billing-client"

type AdjustmentsTabProps = {
  orgId: string
}

export function AdjustmentsTab({ orgId }: AdjustmentsTabProps) {
  const [adjustments, setAdjustments] = useState<AdminAdjustment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => {
    getAdminAdjustments({ orgId })
      .then((res) => setAdjustments(res.adjustments))
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [orgId])

  function handleRefresh() {
    setIsLoading(true)
    setError(null)
    getAdminAdjustments({ orgId })
      .then((res) => setAdjustments(res.adjustments))
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false))
  }

  if (isLoading) {
    return <Skeleton className="h-64" />
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-destructive">
          Failed to load adjustments: {error}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <CardTitle className="text-base font-medium">Adjustments</CardTitle>
        <Button
          size="sm"
          onClick={() => setFormOpen(true)}
        >
          <PlusIcon className="mr-1 h-4 w-4" />
          New Adjustment
        </Button>
      </div>

      <AdjustmentTable adjustments={adjustments} />

      <AdjustmentForm
        open={formOpen}
        onOpenChange={setFormOpen}
        tenantId={orgId}
        onSuccess={handleRefresh}
      />
    </div>
  )
}
