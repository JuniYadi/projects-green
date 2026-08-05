"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  PricingVariantForm,
  type PricingVariantFormValue,
} from "@/components/billing/admin/pricing-variant-form"
import { PricingVariantsTable } from "@/components/billing/admin/pricing-variants-table"
import {
  createAdminPricing,
  deactivateAdminPricing,
  getAdminPricing,
  type AdminPricing,
} from "@/lib/billing-client"

export default function BillingPricingPage() {
  const searchParams = useSearchParams()
  const packageCode = searchParams.get("package") ?? undefined
  const planCode = searchParams.get("plan") ?? undefined
  const [pricing, setPricing] = useState<AdminPricing[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getAdminPricing({
        packageCode,
        planCode,
        includeInactive: true,
      })
      setPricing(response.data)
      setError(null)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load pricing."
      )
    } finally {
      setLoading(false)
    }
  }, [packageCode, planCode])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])
  const save = async (value: PricingVariantFormValue) => {
    await createAdminPricing(value)
    setShowForm(false)
    await load()
  }
  const deactivate = async (id: string) => {
    if (!window.confirm("Deactivate this pricing variant?")) return
    await deactivateAdminPricing(id)
    await load()
  }
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pricing</h1>
          <p className="text-muted-foreground">
            Manage complete-period offers across products.
          </p>
        </div>
        <Button onClick={() => setShowForm((visible) => !visible)}>
          {showForm ? "Close" : "Add pricing"}
        </Button>
      </header>
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New pricing variant</CardTitle>
            <CardDescription>
              Price for entire period; catalog edits never change charged
              orders.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PricingVariantForm onSubmit={save} />
          </CardContent>
        </Card>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading pricing…</p>
      ) : (
        <PricingVariantsTable pricing={pricing} onDeactivate={deactivate} />
      )}
    </main>
  )
}
