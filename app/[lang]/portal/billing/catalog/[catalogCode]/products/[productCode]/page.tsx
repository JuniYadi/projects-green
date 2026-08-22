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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ArrowLeftIcon,
  Copy,
  PlusIcon,
  TrashIcon,
  WarningIcon,
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

  // Dynamic Checkout / Provisioning Form Field Definitions
  type ProvisioningField = {
    id: string
    name: string
    label: string
    type: "text" | "number" | "email" | "url" | "select" | "radio"
    placeholder?: string
    required: boolean
    options?: string[] // For select and radio types
  }

  const [provisioningFields, setProvisioningFields] = useState<
    ProvisioningField[]
  >([])
  const [selectedFieldIndices, setSelectedFieldIndices] = useState<number[]>([])

  const [resourceEntries, setResourceEntries] = useState<
    Array<{ key: string; value: string }>
  >([])
  const [selectedResourceIndices, setSelectedResourceIndices] = useState<
    number[]
  >([])

  const [prices, setPrices] = useState<AddonPricingForm[]>([])
  const [defaultCurrency, setDefaultCurrency] = useState<string>("IDR")

  // Duplicate state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [duplicateCode, setDuplicateCode] = useState("")
  const [duplicateName, setDuplicateName] = useState("")
  const [isDuplicating, setIsDuplicating] = useState(false)
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

        const resObj = (p.resources ?? {}) as Record<string, unknown>
        // Parse dynamic custom form fields
        // Pure database driven: load whatever provisioningFields array is stored in DB
        if (Array.isArray(resObj.provisioningFields)) {
          setProvisioningFields(
            resObj.provisioningFields as ProvisioningField[]
          )
        } else {
          setProvisioningFields([])
        }

        // Filter out internal provisioning flags from the custom key-value quota list
        const reservedKeys = new Set([
          "provisioningFields",
          "deviceSetup",
          "requireDeviceSetup",
          "phoneRequired",
          "displayNameEnabled",
          "profileUrlEnabled",
        ])
        const entries = Object.entries(resObj)
          .filter(([k]) => !reservedKeys.has(k))
          .map(([k, v]) => ({
            key: k,
            value: typeof v === "object" ? JSON.stringify(v) : String(v),
          }))
        setResourceEntries(entries)
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

  const removePrice = useCallback((index: number) => {
    setPrices((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updatePrice = useCallback(
    (index: number, patch: Partial<AddonPricingForm>) => {
      setPrices((prev) =>
        prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
      )
    },
    []
  )

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
        resources: {
          provisioningFields,
          ...resourceEntries.reduce<Record<string, unknown>>(
            (acc, { key, value }) => {
              const trimmedKey = key.trim()
              if (!trimmedKey) return acc
              const trimmedVal = value.trim()
              const num = Number(trimmedVal)
              if (!Number.isNaN(num) && trimmedVal !== "") {
                acc[trimmedKey] = num
              } else if (trimmedVal === "true" || trimmedVal === "false") {
                acc[trimmedKey] = trimmedVal === "true"
              } else {
                try {
                  acc[trimmedKey] = JSON.parse(trimmedVal)
                } catch {
                  acc[trimmedKey] = trimmedVal
                }
              }
              return acc
            },
            {}
          ),
        },
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

  const openDuplicateDialog = () => {
    setDuplicateCode(`${productCode}_COPY`.toUpperCase())
    setDuplicateName(`${name || productCode} (Copy)`)
    setDuplicateDialogOpen(true)
  }

  const handleDuplicate = async () => {
    const code = duplicateCode.trim().toUpperCase()
    const newName = duplicateName.trim()
    if (!code || !newName) {
      toast.error("Product code and name are required.")
      return
    }
    if (code === productCode) {
      toast.error("New product code must be different from current product.")
      return
    }
    setIsDuplicating(true)
    try {
      const detail = await getAdminCatalogProductDetail(
        catalogCode,
        productCode
      )
      const p = detail.product
      await upsertAdminCatalogProduct(catalogCode, code, {
        name: newName,
        code,
        resources: p.resources,
        billingStrategy: p.billingStrategy,
        stockControl: p.stockControl,
        stockCount: p.stockCount,
        allowBackorder: p.allowBackorder,
        isActive: true,
        prices: (p.offers ?? []).map((offer) => ({
          billingPeriod: offer.billingPeriod,
          chargeUnit: offer.chargeUnit,
          periodPrice: Number.parseFloat(offer.periodPrice) || 0,
          currency: offer.currency,
          effectiveFrom: new Date().toISOString().slice(0, 10),
          effectiveTo: offer.effectiveTo,
          isActive: true,
        })),
      })
      toast.success(`Product "${newName}" (${code}) duplicated successfully.`)
      setDuplicateDialogOpen(false)
      router.push(
        `/portal/billing/catalog/${catalogCode.toLowerCase()}/products/${code.toLowerCase()}`
      )
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to duplicate product"
      toast.error(message)
    } finally {
      setIsDuplicating(false)
    }
  }

  // Bulk delete handlers
  const deleteSelectedFields = () => {
    if (selectedFieldIndices.length === 0) return
    const toRemove = new Set(selectedFieldIndices)
    setProvisioningFields((prev) => prev.filter((_, idx) => !toRemove.has(idx)))
    setSelectedFieldIndices([])
  }

  const toggleSelectAllFields = () => {
    if (selectedFieldIndices.length === provisioningFields.length) {
      setSelectedFieldIndices([])
    } else {
      setSelectedFieldIndices(provisioningFields.map((_, i) => i))
    }
  }

  const deleteSelectedResources = () => {
    if (selectedResourceIndices.length === 0) return
    const toRemove = new Set(selectedResourceIndices)
    setResourceEntries((prev) => prev.filter((_, idx) => !toRemove.has(idx)))
    setSelectedResourceIndices([])
  }

  const toggleSelectAllResources = () => {
    if (selectedResourceIndices.length === resourceEntries.length) {
      setSelectedResourceIndices([])
    } else {
      setSelectedResourceIndices(resourceEntries.map((_, i) => i))
    }
  }

  const pricingColumns = useMemo<ColumnDef<AddonPricingForm>[]>(
    () => [
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
            onValueChange={(value) =>
              updatePrice(row.index, { currency: value })
            }
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
    ],
    [updatePrice, removePrice]
  )

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
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={openDuplicateDialog}
                disabled={saving || deleting || isDuplicating}
              >
                <Copy className="mr-1.5 h-4 w-4" />
                Duplicate
              </Button>
              <AlertDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
              >
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={saving || deleting || isDuplicating}
                  >
                    <TrashIcon className="mr-1.5 h-4 w-4" />
                    Delete Product
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="sm:max-w-md">
                  <AlertDialogHeader className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                        <WarningIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <AlertDialogTitle className="text-lg font-semibold">
                          Delete product tier?
                        </AlertDialogTitle>
                        <p className="text-xs text-muted-foreground">
                          Plan code:{" "}
                          <span className="font-mono font-medium">
                            {productCode}
                          </span>
                        </p>
                      </div>
                    </div>
                    <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
                      This action will permanently delete product plan{" "}
                      <strong className="font-semibold text-foreground">
                        {product?.name || productCode}
                      </strong>{" "}
                      and all configured pricing terms.
                    </AlertDialogDescription>
                    <div className="rounded-md border border-amber-500/20 bg-amber-50/50 p-3 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                      <span className="font-semibold">Note:</span> If active
                      subscriptions are using this plan, deletion will be
                      blocked to protect historical ledger data. You should
                      deactivate (archive) the product instead.
                    </div>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="mt-4 gap-2 sm:gap-0">
                    <AlertDialogCancel disabled={deleting}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={(e) => {
                        e.preventDefault()
                        void handleDelete()
                      }}
                      disabled={deleting}
                    >
                      {deleting ? "Deleting..." : "Yes, Delete Plan"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
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

        {/* Device Provisioning & Checkout Configuration */}
        {/* Dynamic Checkout Form Builder */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Checkout & Provisioning Form Fields</CardTitle>
                <CardDescription>
                  Define dynamic custom form fields (text, number, email, URL,
                  dropdown, radio) that users must fill out when checking out
                  this plan.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {provisioningFields.length > 0 &&
                  selectedFieldIndices.length > 0 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={deleteSelectedFields}
                    >
                      <TrashIcon className="mr-1.5 h-4 w-4" />
                      Delete Selected ({selectedFieldIndices.length})
                    </Button>
                  )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setProvisioningFields((prev) => [
                      ...prev,
                      {
                        id: `field-${crypto.randomUUID()}`,
                        name: "",
                        label: "",
                        type: "text",
                        placeholder: "",
                        required: false,
                      },
                    ])
                  }
                >
                  <PlusIcon className="mr-1.5 h-4 w-4" />
                  Add Form Field
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {provisioningFields.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">
                No custom form fields configured. Checkout will proceed without
                prompting extra fields.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2 text-xs text-muted-foreground">
                  <label className="flex cursor-pointer items-center gap-2 font-medium">
                    <Checkbox
                      checked={
                        selectedFieldIndices.length > 0 &&
                        selectedFieldIndices.length ===
                          provisioningFields.length
                      }
                      onCheckedChange={toggleSelectAllFields}
                    />
                    Select All Fields ({provisioningFields.length})
                  </label>
                </div>
                {provisioningFields.map((field, idx) => (
                  <div
                    key={field.id || idx}
                    className="space-y-3 rounded-lg border bg-background p-3.5 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="pt-5">
                        <Checkbox
                          checked={selectedFieldIndices.includes(idx)}
                          onCheckedChange={(checked) =>
                            setSelectedFieldIndices((prev) =>
                              checked
                                ? [...prev, idx]
                                : prev.filter((i) => i !== idx)
                            )
                          }
                          aria-label={`Select field ${field.label || idx + 1}`}
                        />
                      </div>

                      <div className="min-w-[140px] flex-1 space-y-1">
                        <Label className="text-xs">Field Label *</Label>
                        <Input
                          value={field.label}
                          onChange={(e) =>
                            setProvisioningFields((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, label: e.target.value }
                                  : item
                              )
                            )
                          }
                          placeholder="e.g. Phone Number, Domain"
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="min-w-[140px] flex-1 space-y-1">
                        <Label className="text-xs">
                          Attribute Key / Name *
                        </Label>
                        <Input
                          value={field.name}
                          onChange={(e) =>
                            setProvisioningFields((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, name: e.target.value }
                                  : item
                              )
                            )
                          }
                          placeholder="e.g. phoneNumber, domain"
                          className="h-8 font-mono text-xs"
                        />
                      </div>

                      <div className="w-[130px] space-y-1">
                        <Label className="text-xs">Input Type</Label>
                        <Select
                          value={field.type}
                          onValueChange={(val: ProvisioningField["type"]) =>
                            setProvisioningFields((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, type: val } : item
                              )
                            )
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="url">Link / URL</SelectItem>
                            <SelectItem value="select">Dropdown</SelectItem>
                            <SelectItem value="radio">Radio Group</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2 pt-5">
                        <Switch
                          id={`req-${idx}`}
                          checked={field.required}
                          onCheckedChange={(checked) =>
                            setProvisioningFields((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, required: checked }
                                  : item
                              )
                            )
                          }
                        />
                        <Label htmlFor={`req-${idx}`} className="text-xs">
                          Required
                        </Label>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-5 h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          setProvisioningFields((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                          setSelectedFieldIndices((prev) =>
                            prev
                              .filter((i) => i !== idx)
                              .map((i) => (i > idx ? i - 1 : i))
                          )
                        }}
                        aria-label="Delete field"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Placeholder for text inputs or options for dropdown / radio */}
                    {field.type === "select" || field.type === "radio" ? (
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">
                          Comma-separated Options
                        </Label>
                        <Input
                          value={(field.options ?? []).join(", ")}
                          onChange={(e) => {
                            const opts = e.target.value
                              .split(",")
                              .map((o) => o.trim())
                              .filter(Boolean)
                            setProvisioningFields((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, options: opts } : item
                              )
                            )
                          }}
                          placeholder="e.g. Option A, Option B, Option C"
                          className="h-7 text-xs"
                        />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">
                          Placeholder Text
                        </Label>
                        <Input
                          value={field.placeholder ?? ""}
                          onChange={(e) =>
                            setProvisioningFields((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, placeholder: e.target.value }
                                  : item
                              )
                            )
                          }
                          placeholder="e.g. Enter value..."
                          className="h-7 text-xs"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        {/* Resource Specs & Quotas */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Resources & Quotas</CardTitle>
                <CardDescription>
                  Commercial quotas and specs allocated to this product tier
                  (e.g. devices, conversations, quotaIn, quotaOut,
                  dailyPerDevice).
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {resourceEntries.length > 0 &&
                  selectedResourceIndices.length > 0 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={deleteSelectedResources}
                    >
                      <TrashIcon className="mr-1.5 h-4 w-4" />
                      Delete Selected ({selectedResourceIndices.length})
                    </Button>
                  )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setResourceEntries((prev) => [
                      ...prev,
                      { key: "", value: "" },
                    ])
                  }
                >
                  <PlusIcon className="mr-1.5 h-4 w-4" />
                  Add Resource
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {resourceEntries.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">
                No resources or quotas configured for this plan tier. Click
                &quot;Add Resource&quot; to configure quotas.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b pb-2 text-xs text-muted-foreground">
                  <label className="flex cursor-pointer items-center gap-2 font-medium">
                    <Checkbox
                      checked={
                        selectedResourceIndices.length > 0 &&
                        selectedResourceIndices.length ===
                          resourceEntries.length
                      }
                      onCheckedChange={toggleSelectAllResources}
                    />
                    Select All Resources ({resourceEntries.length})
                  </label>
                </div>
                {resourceEntries.map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-md border bg-background p-2.5"
                  >
                    <div className="pt-5">
                      <Checkbox
                        checked={selectedResourceIndices.includes(idx)}
                        onCheckedChange={(checked) =>
                          setSelectedResourceIndices((prev) =>
                            checked
                              ? [...prev, idx]
                              : prev.filter((i) => i !== idx)
                          )
                        }
                        aria-label={`Select resource ${entry.key || idx + 1}`}
                      />
                    </div>

                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Key / Attribute
                      </Label>
                      <Input
                        value={entry.key}
                        onChange={(e) =>
                          setResourceEntries((prev) =>
                            prev.map((item, i) =>
                              i === idx
                                ? { ...item, key: e.target.value }
                                : item
                            )
                          )
                        }
                        placeholder="e.g. devices, quotaIn, conversations"
                        className="h-8 font-mono text-xs"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Allocated Value
                      </Label>
                      <Input
                        value={entry.value}
                        onChange={(e) =>
                          setResourceEntries((prev) =>
                            prev.map((item, i) =>
                              i === idx
                                ? { ...item, value: e.target.value }
                                : item
                            )
                          )
                        }
                        placeholder="e.g. 5, 1000, 500"
                        className="h-8 text-xs"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-5 h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        setResourceEntries((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                        setSelectedResourceIndices((prev) =>
                          prev
                            .filter((i) => i !== idx)
                            .map((i) => (i > idx ? i - 1 : i))
                        )
                      }}
                      aria-label="Remove resource"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
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
      {/* Modal Prompt for Duplicate Product */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Duplicate Product</DialogTitle>
            <DialogDescription>
              Create a clone of{" "}
              <span className="font-semibold text-foreground">
                {name || productCode}
              </span>
              . Enter a unique product code and name for the new copy.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleDuplicate()
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-2">
              <Label htmlFor="dup-product-code">New Product Code *</Label>
              <Input
                id="dup-product-code"
                value={duplicateCode}
                onChange={(e) => setDuplicateCode(e.target.value.toUpperCase())}
                placeholder="e.g. STARTER_V2"
                className="font-mono uppercase"
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Must be unique within the {catalogCode} catalog.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dup-product-name">New Product Name *</Label>
              <Input
                id="dup-product-name"
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                placeholder="e.g. Starter Plan (Copy)"
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDuplicateDialogOpen(false)}
                disabled={isDuplicating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isDuplicating}>
                {isDuplicating ? "Duplicating..." : "Create Copy"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  )
}
