"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PricingVariantsTable } from "@/components/billing/admin/pricing-variants-table"
import {
  deactivateAdminPricing,
  getAdminPricing,
  type AdminPricing,
} from "@/lib/billing-client"

export default function BillingPricingPage() {
  const searchParams = useSearchParams()
  const packageCode = searchParams.get("package") ?? undefined
  const planCode = searchParams.get("plan") ?? undefined
  const [pricing, setPricing] = useState<AdminPricing[]>([])
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
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Catalog-managed pricing</CardTitle>
          <CardDescription>
            Pricing is read-only here. Create and edit offers from the scoped
            Catalog plan editor so plans, currencies, terms, and add-ons stay in
            one authoring workflow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a
            className="text-sm font-medium text-primary underline underline-offset-4"
            href="/portal/billing/catalog"
          >
            Open Catalog
          </a>
        </CardContent>
      </Card>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading pricing…</p>
      ) : (
        <PricingVariantsTable pricing={pricing} onDeactivate={deactivate} />
      )}
    </main>
  )
}
