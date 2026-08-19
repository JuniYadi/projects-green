"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"

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
import { DataTable } from "@/components/data-table"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  WarningIcon,
  InfoIcon,
} from "@/components/ui/phosphor-icons"
import {
  getAdminCatalogProductDetail,
  upsertAdminCatalogProduct,
  deleteAdminCatalogProduct,
  billingPeriodLabel,
} from "@/lib/billing-client"
import type { CatalogPlan } from "@/lib/billing-client"
import {
  BILLING_PERIODS,
  SUPPORTED_CURRENCIES,
} from "@/components/billing/admin/catalog/catalog-editor.types"
import type { AddonPricingForm } from "@/components/billing/admin/catalog/catalog-editor.types"
import {
  getMissingAddonPriceCells,
  isValidAddonPriceAmount,
} from "@/components/billing/admin/catalog/addon-pricing-validation"
import { toast } from "sonner"

export default function ProductDetailPage() {
  const router = useRouter()
  const { catalogCode: rawCatalog, productCode: rawProduct } = useParams<{
    catalogCode: string
    productCode: string
  }>()
  const catalogCode = (rawCatalog || "").toUpperCase()
  const productCode = (rawProduct || "").toUpperCase()
  const isNew = productCode === "NEW"

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
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

  const [prices, setPrices] = useState<AddonPricingForm[]>([])
  const [defaultCurrency, setDefaultCurrency] = useState<string>("IDR")

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

        const initialPrices: AddonPricingForm[] = (p.offers ?? []).map(
          (offer) => ({
            id: offer.id,
            billingPeriod: offer.billingPeriod,
            currency: offer.currency,
            amount: offer.periodPrice,
            effectiveFrom: offer.effectiveFrom
              ? offer.effectiveFrom.slice(0, 10)
              : new Date().toISOString().slice(0, 10),
            effectiveTo: offer.effectiveTo
              ? offer.effectiveTo.slice(0, 10)
              : "",
            isActive: true,
          })
        )
        setPrices(initialPrices)
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load product"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [catalogCode, productCode, isNew])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProduct()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadProduct])

  const addPrice = () => {
    const today = new Date().toISOString().slice(0, 10)
    setPrices((prev) => [
      ...prev,
      {
        id: `price-${crypto.randomUUID()}`,
        billingPeriod: "MONTHLY",
        currency: defaultCurrency,
        amount: "",
        effectiveFrom: today,
        effectiveTo: "",
        isActive: true,
      },
    ])
  }

  const removePrice = (index: number) => {
    setPrices((prev) => prev.filter((_, i) => i !== index))
  }

  const updatePrice = (index: number, patch: Partial<AddonPricingForm>) => {
    setPrices((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    )
  }

  const priceValidations = useMemo(() => {
    return prices.map((price) => {
      const errors: string[] = []
      if (!isValidAddonPriceAmount(price.amount)) {
        errors.push("Amount must be a positive number.")
      }
      if (
        price.effectiveTo &&
        price.effectiveFrom &&
        price.effectiveTo <= price.effectiveFrom
      ) {
        errors.push("Effective to must be after effective from.")
      }
      return errors
    })
  }, [prices])

  const enabledBillingPeriods = useMemo(
    () => [...new Set(prices.map((p) => p.billingPeriod))],
    [prices]
  )

  const missingPriceCells = useMemo(
    () =>
      getMissingAddonPriceCells(
        prices,
        enabledBillingPeriods,
        SUPPORTED_CURRENCIES
      ),
    [prices, enabledBillingPeriods]
  )

  const hasPricingErrors = useMemo(() => {
    if (prices.length === 0) return true
    return (
      priceValidations.some((e) => e.length > 0) || missingPriceCells.length > 0
    )
  }, [prices.length, priceValidations, missingPriceCells])

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

    if (prices.length === 0) {
      toast.error("At least one pricing term is required.")
      return
    }

    if (hasPricingErrors) {
      toast.error(
        "Please fix pricing table validation errors before saving product."
      )
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
        prices: prices.map((p) => ({
          billingPeriod: p.billingPeriod,
          currency: p.currency,
          periodPrice: Number(p.amount) || 0,
          effectiveFrom: p.effectiveFrom || new Date().toISOString(),
          effectiveTo: p.effectiveTo || null,
          isActive: p.isActive,
        })),
      })
      toast.success(
        isNew ? "Product created successfully" : "Product updated successfully"
      )
      if (isNew) {
        router.push(
          `/portal/billing/catalog/${catalogCode.toLowerCase()}/products/${targetCode.toLowerCase()}`
        )
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

  const handleDelete = async () => {
    if (isNew) return
    setDeleting(true)
    try {
      await deleteAdminCatalogProduct(catalogCode, productCode)
      toast.success("Product deleted successfully")
      router.push(
        `/portal/billing/catalog/${catalogCode.toLowerCase()}/products`
      )
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete product"
      toast.error(message)
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  const pricingColumns: ColumnDef<AddonPricingForm>[] = [
    {
      accessorKey: "billingPeriod",
      header: "Billing period",
      cell: ({ row }) => (
        <Select
          value={row.original.billingPeriod}
          onValueChange={(value) =>
            updatePrice(row.index, {
              billingPeriod: value as AddonPricingForm["billingPeriod"],
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BILLING_PERIODS.map((period) => (
              <SelectItem key={period} value={period}>
                {billingPeriodLabel(period)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      accessorKey: "currency",
      header: "Currency",
      cell: ({ row }) => (
        <Select
          value={row.original.currency}
          onValueChange={(value) => updatePrice(row.index, { currency: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_CURRENCIES.map((currency) => (
              <SelectItem key={currency} value={currency}>
                {currency}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => (
        <Input
          type="number"
          min="0"
          step="0.01"
          value={row.original.amount}
          onChange={(event) =>
            updatePrice(row.index, { amount: event.target.value })
          }
          aria-invalid={!isValidAddonPriceAmount(row.original.amount)}
        />
      ),
    },
    {
      accessorKey: "effectiveFrom",
      header: "Effective from",
      cell: ({ row }) => (
        <Input
          type="date"
          value={row.original.effectiveFrom}
          onChange={(event) =>
            updatePrice(row.index, { effectiveFrom: event.target.value })
          }
        />
      ),
    },
    {
      accessorKey: "effectiveTo",
      header: "Effective to",
      cell: ({ row }) => (
        <Input
          type="date"
          value={row.original.effectiveTo}
          onChange={(event) =>
            updatePrice(row.index, {
              effectiveTo: event.target.value,
            })
          }
        />
      ),
    },
    {
      accessorKey: "isActive",
      header: "Active",
      cell: ({ row }) => (
        <Switch
          checked={row.original.isActive}
          onCheckedChange={(checked) =>
            updatePrice(row.index, { isActive: checked })
          }
        />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => removePrice(row.index)}
          aria-label="Remove price"
        >
          <TrashIcon className="h-4 w-4 text-destructive" />
        </Button>
      ),
    },
  ]

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
          {!isNew && (
            <AlertDialog
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
            >
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={saving || deleting}
                >
                  Delete Product
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete product tier?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete product plan{" "}
                    <strong>{productCode}</strong> and its pricing terms if no
                    subscriptions reference it. If subscriptions exist, deletion
                    will be blocked to preserve historical ledger integrity and
                    you should deactivate (archive) the product instead.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
                    onClick={(e) => {
                      e.preventDefault()
                      void handleDelete()
                    }}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting..." : "Delete Plan"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <Button onClick={handleSave} disabled={saving || deleting}>
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

      {/* WhatsApp Domain Boundary Helper */}
      {catalogCode === "WHATSAPP" && (
        <div className="flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
          <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              WhatsApp Catalog SKU vs. Device Provisioning Boundary
            </p>
            <p className="text-xs">
              This product tier defines commercial quotas, throughput specs, and
              subscription pricing. Customer-specific phone numbers, Meta
              credentials, display names, and avatars are captured at checkout
              and managed under the tenant&apos;s Console Device Profile (
              <span className="font-mono">
                /console/whatsapp/devices/[deviceId]
              </span>
              ), not here in the catalog.
            </p>
          </div>
        </div>
      )}

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

      {/* Per-Product Pricing Table (Addon Parity) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pricing Terms</CardTitle>
              <CardDescription>
                Configure multi-currency recurring pricing per billing period
                for this product tier.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">
                  Default currency
                </Label>
                <Select
                  value={defaultCurrency}
                  onValueChange={setDefaultCurrency}
                >
                  <SelectTrigger className="h-8 w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((curr) => (
                      <SelectItem key={curr} value={curr}>
                        {curr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={addPrice}>
                <PlusIcon className="mr-2 h-4 w-4" />
                Add Term
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {prices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pricing terms configured. Add a term to publish this product.
            </p>
          ) : (
            <>
              {missingPriceCells.length > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                  <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">Missing currency pricing:</p>
                    <ul className="list-inside list-disc">
                      {missingPriceCells.map((cell) => (
                        <li key={`${cell.billingPeriod}-${cell.currency}`}>
                          {billingPeriodLabel(cell.billingPeriod)} (
                          {cell.currency})
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <DataTable
                tableId="product-pricing-table"
                columns={pricingColumns}
                data={prices}
                searchableColumns={[]}
                searchPlaceholder="Filter terms..."
                emptyMessage="No pricing terms configured."
              />
            </>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
