"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeftIcon } from "@/components/ui/phosphor-icons"
import {
  getAdminCatalogProductDetail,
  upsertAdminCatalogProduct,
} from "@/lib/billing-client"
import type { CatalogPlan } from "@/lib/billing-client"
import { toast } from "sonner"

export default function ProductDetailPage() {
  const { catalogCode: rawCatalog, productCode: rawProduct } = useParams<{
    catalogCode: string
    productCode: string
  }>()
  const catalogCode = (rawCatalog || "").toUpperCase()
  const productCode = (rawProduct || "").toUpperCase()
  const isNew = productCode === "NEW"

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [product, setProduct] = useState<CatalogPlan | null>(null)
  const [customCode, setCustomCode] = useState("")

  const [name, setName] = useState("")
  const [billingStrategy, setBillingStrategy] = useState<
    "PRO_RATA" | "FIXED_CYCLE"
  >("FIXED_CYCLE")
  const [stockControl, setStockControl] = useState<"UNLIMITED" | "TRACKED">(
    "UNLIMITED"
  )
  const [stockCount, setStockCount] = useState<number>(0)
  const [allowBackorder, setAllowBackorder] = useState(false)
  const [isActive, setIsActive] = useState(true)

  const loadProduct = useCallback(async () => {
    if (!catalogCode || !productCode || isNew) return
    setLoading(true)
    try {
      const response = await getAdminCatalogProductDetail(
        catalogCode,
        productCode
      )
      if (response.product) {
        const p = response.product
        setProduct(p)
        setName(p.name)
        setBillingStrategy(p.billingStrategy ?? "FIXED_CYCLE")
        setStockControl(p.stockControl ?? "UNLIMITED")
        setStockCount(p.stockCount ?? 0)
        setAllowBackorder(Boolean(p.allowBackorder))
        setIsActive(p.isActive ?? true)
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load product"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [catalogCode, productCode])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProduct()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadProduct])

  const handleSave = async () => {
    const targetCode = isNew ? customCode.trim().toUpperCase() : productCode
    if (!targetCode) {
      toast.error("Product code is required")
      return
    }
    if (!name.trim()) {
      toast.error("Product name is required")
      return
    }

    setSaving(true)
    try {
      await upsertAdminCatalogProduct(catalogCode, targetCode, {
        name: name.trim(),
        billingStrategy,
        stockControl,
        stockCount: stockControl === "TRACKED" ? stockCount : null,
        allowBackorder,
        isActive,
      })
      toast.success(
        isNew ? "Product created successfully" : "Product updated successfully"
      )
      if (isNew) {
        window.location.href = `/portal/billing/catalog/${catalogCode.toLowerCase()}/products/${targetCode.toLowerCase()}`
      } else {
        void loadProduct()
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save product"
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/portal/billing/catalog/${catalogCode.toLowerCase()}/products`}
          >
            <Button
              variant="ghost"
              size="icon"
              aria-label="Back to products list"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              {isNew
                ? `New ${catalogCode} Product`
                : product?.name || productCode}
            </h1>
            <p className="text-sm text-muted-foreground">
              Catalog: <span className="font-semibold">{catalogCode}</span>
              {!isNew && (
                <>
                  {" "}
                  · Code: <span className="font-mono">{productCode}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? isNew
                ? "Creating..."
                : "Saving..."
              : isNew
                ? "Create Product"
                : "Save changes"}
          </Button>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Product Identity */}
        <Card>
          <CardHeader>
            <CardTitle>Product Identity</CardTitle>
            <CardDescription>General naming and active status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isNew && (
              <div className="space-y-2">
                <Label htmlFor="new-product-code">Product Code *</Label>
                <Input
                  id="new-product-code"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                  placeholder="e.g. STARTER, PRO, DEDICATED"
                  className="font-mono uppercase"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="product-name">Product Name *</Label>
              <Input
                id="product-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Product display name"
              />
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <p className="text-sm font-medium">Active in Catalog</p>
                <p className="text-xs text-muted-foreground">
                  Controls whether customers can view and checkout this product.
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </CardContent>
        </Card>

        {/* Billing & Stock Control */}
        <Card>
          <CardHeader>
            <CardTitle>Billing & Inventory</CardTitle>
            <CardDescription>
              Proration rules and stock allocation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs">Billing Strategy</Label>
              <div className="flex gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="billingStrategy"
                    value="FIXED_CYCLE"
                    checked={billingStrategy === "FIXED_CYCLE"}
                    onChange={() => setBillingStrategy("FIXED_CYCLE")}
                  />
                  Fixed Cycle (Full Term)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="billingStrategy"
                    value="PRO_RATA"
                    checked={billingStrategy === "PRO_RATA"}
                    onChange={() => setBillingStrategy("PRO_RATA")}
                  />
                  Pro-rata (Calendar Month)
                </label>
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">
                    Inventory Tracking
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Enforce available slots at checkout
                  </p>
                </div>
                <Switch
                  checked={stockControl === "TRACKED"}
                  onCheckedChange={(checked) =>
                    setStockControl(checked ? "TRACKED" : "UNLIMITED")
                  }
                />
              </div>

              {stockControl === "TRACKED" && (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="space-y-1">
                    <Label htmlFor="stock-count" className="text-xs">
                      Available Stock Count
                    </Label>
                    <Input
                      id="stock-count"
                      type="number"
                      min={0}
                      value={stockCount}
                      onChange={(e) =>
                        setStockCount(Number.parseInt(e.target.value, 10) || 0)
                      }
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={allowBackorder}
                      onChange={(e) => setAllowBackorder(e.target.checked)}
                    />
                    Allow backorder when out of stock
                  </label>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
