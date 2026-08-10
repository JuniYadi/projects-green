"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams, useParams } from "next/navigation"

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
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
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
  CheckCircleIcon,
  WarningIcon,
} from "@/components/ui/phosphor-icons"
import type {
  AddonForm,
  AddonPricingForm,
  AddonDetail,
} from "@/components/billing/admin/catalog/catalog-editor.types"
import {
  BILLING_PERIODS,
  SERVICE_ADDON_BILLING_MODES,
  SUPPORTED_CURRENCIES,
} from "@/components/billing/admin/catalog/catalog-editor.types"
import { billingPeriodLabel } from "@/lib/billing-client"
import { useAdminAddonQuery } from "@/hooks/use-billing-data"
import {
  getMissingAddonPriceCells,
  isValidAddonPriceAmount,
} from "@/components/billing/admin/catalog/addon-pricing-validation"
import { formatBillingMoney } from "@/modules/billing/format-money"
import { toast } from "sonner"

const BILLING_MODE_LABELS: Record<string, string> = {
  RECURRING: "Recurring",
  ONE_TIME: "One-time",
  USAGE: "Usage",
}

function addonDetailToForm(detail: AddonDetail): AddonForm {
  return {
    id: detail.id,
    code: detail.code,
    name: detail.name,
    description: detail.description ?? "",
    billingMode: detail.billingMode,
    isActive: detail.isActive,
    prices: detail.prices.map((p) => ({
      id: p.id,
      billingPeriod: p.billingPeriod,
      currency: p.currency,
      amount: p.amount,
      effectiveFrom: p.effectiveFrom
        ? new Date(p.effectiveFrom).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      effectiveTo: p.effectiveTo
        ? new Date(p.effectiveTo).toISOString().slice(0, 10)
        : "",
      isActive: p.isActive,
    })),
  }
}

function isAddonForm(value: unknown): value is AddonForm {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const addon = value as Record<string, unknown>
  if (
    typeof addon.id !== "string" ||
    typeof addon.code !== "string" ||
    typeof addon.name !== "string" ||
    typeof addon.description !== "string" ||
    typeof addon.billingMode !== "string" ||
    typeof addon.isActive !== "boolean" ||
    !Array.isArray(addon.prices)
  ) {
    return false
  }

  return addon.prices.every((price) => {
    if (!price || typeof price !== "object" || Array.isArray(price))
      return false
    const pricing = price as Record<string, unknown>
    return (
      typeof pricing.id === "string" &&
      typeof pricing.billingPeriod === "string" &&
      typeof pricing.currency === "string" &&
      typeof pricing.amount === "string" &&
      typeof pricing.effectiveFrom === "string" &&
      typeof pricing.effectiveTo === "string" &&
      typeof pricing.isActive === "boolean"
    )
  })
}

function readAddonDraft(addonCode?: string): AddonForm | null {
  if (!addonCode || typeof window === "undefined") return null

  try {
    const saved = window.localStorage.getItem(`addon-draft-${addonCode}`)
    if (!saved) return null
    const parsed: unknown = JSON.parse(saved)
    return isAddonForm(parsed) ? parsed : null
  } catch {
    return null
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export default function AddonEditorPage() {
  const params = useParams<{ lang: string; addonCode?: string }>()
  const searchParams = useSearchParams()
  const addonCode = params?.addonCode
  const isNew = searchParams.get("new") === "true" || !addonCode

  const addonQuery = useAdminAddonQuery(addonCode)
  const initialAddon = isNew
    ? {
        id: `new-${addonCode ?? crypto.randomUUID()}`,
        code: "",
        name: "",
        description: "",
        billingMode: "RECURRING" as AddonForm["billingMode"],
        isActive: true,
        prices: [],
      }
    : addonQuery.data?.addon
      ? addonDetailToForm(addonQuery.data.addon as AddonDetail)
      : null
  const [draft, setDraft] = useState<AddonForm | null>(() =>
    readAddonDraft(addonCode)
  )
  const [saving, setSaving] = useState(false)
  const [modified, setModified] = useState(false)
  const [defaultCurrency, setDefaultCurrency] = useState("IDR")
  const loading = !isNew && addonQuery.isLoading
  const addon = draft ?? initialAddon

  if (loading) return <LoadingSkeleton />
  if (!addon) return null

  const update = (next: Partial<AddonForm>) => {
    setDraft((prev) => ({ ...(prev ?? addon), ...next }))
    setModified(true)
  }

  const updatePricing = (index: number, next: Partial<AddonPricingForm>) => {
    const prices = [...addon.prices]
    prices[index] = { ...prices[index], ...next }
    update({ prices })
  }

  const addPrice = () => {
    const newPrice: AddonPricingForm = {
      id: `price-new-${crypto.randomUUID()}`,
      billingPeriod: "MONTHLY",
      currency: defaultCurrency,
      amount: "",
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: "",
      isActive: true,
    }
    update({ prices: [...addon.prices, newPrice] })
  }

  const removePrice = (index: number) => {
    update({ prices: addon.prices.filter((_, i) => i !== index) })
  }

  const handleSaveDraft = async () => {
    if (!addon.name.trim() || !addon.code.trim()) {
      toast.error("Code and name are required")
      return
    }
    setSaving(true)
    try {
      const draftKey = `addon-draft-${addon.code || addon.id}`
      localStorage.setItem(draftKey, JSON.stringify(addon))
      toast.success("Draft saved")
      setModified(false)
    } catch {
      toast.error("Failed to save draft")
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    const archivedAddon = { ...addon, isActive: false }
    try {
      const draftKey = `addon-draft-${archivedAddon.code || archivedAddon.id}`
      localStorage.setItem(draftKey, JSON.stringify(archivedAddon))
      setDraft(archivedAddon)
      toast.success("Add-on archived")
      setModified(false)
    } catch {
      toast.error("Failed to archive add-on")
    }
  }

  const priceValidations = addon.prices.map((price) => {
    const errors: string[] = []
    if (!isValidAddonPriceAmount(price.amount)) {
      errors.push("Amount is required and must be positive")
    }
    if (price.effectiveTo && price.effectiveTo < price.effectiveFrom) {
      errors.push("Effective 'to' must be after 'from'")
    }
    return errors
  })

  const enabledBillingPeriods = Array.from(
    new Set(addon.prices.map((price) => price.billingPeriod))
  )
  const missingPriceCells = getMissingAddonPriceCells(
    addon.prices,
    enabledBillingPeriods,
    SUPPORTED_CURRENCIES
  )
  const hasErrors =
    priceValidations.some((e) => e.length > 0) || missingPriceCells.length > 0

  const pricingColumns: ColumnDef<AddonPricingForm>[] = [
    {
      accessorKey: "billingPeriod",
      header: "Billing period",
      cell: ({ row }) => (
        <Select
          value={row.original.billingPeriod}
          onValueChange={(value) =>
            updatePricing(row.index, {
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
            updatePricing(row.index, { currency: value })
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
            updatePricing(row.index, { amount: event.target.value })
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
            updatePricing(row.index, { effectiveFrom: event.target.value })
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
            updatePricing(row.index, { effectiveTo: event.target.value })
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
            updatePricing(row.index, { isActive: checked })
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

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/portal/billing/catalog/addons">
            <Button variant="ghost" size="icon">
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              {addon.name || addon.code || "New add-on"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Code:{" "}
              <span className="font-mono">{addon.code || "(unspecified)"}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={addon.isActive ? "default" : "secondary"}>
            {addon.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </header>

      {/* Sticky actions */}
      <div className="sticky top-0 z-10 border-b bg-background/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center justify-end gap-3">
          {!addon.isActive && <Badge variant="secondary">Archived</Badge>}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={saving || !modified}
          >
            {saving ? "Saving…" : "Save draft"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={saving}>
                Archive
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive add-on?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will deactivate the add-on. Existing subscriptions will
                  retain their attached add-ons, but new subscriptions will not
                  offer it.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="text-destructive-foreground bg-destructive"
                  onClick={handleArchive}
                >
                  Archive
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-4 md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Identity</CardTitle>
              <CardDescription>Add-on code and naming.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="addon-code">Code *</Label>
                <Input
                  id="addon-code"
                  value={addon.code}
                  onChange={(e) =>
                    update({ code: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g. EXTRA_STORAGE"
                  aria-invalid={!addon.code.trim()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addon-name">Name *</Label>
                <Input
                  id="addon-name"
                  value={addon.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="Add-on display name"
                  aria-invalid={!addon.name.trim()}
                />
              </div>
              <div className="space-y-2">
                <Label>Billing mode</Label>
                <Select
                  value={addon.billingMode}
                  onValueChange={(value) =>
                    update({
                      billingMode: value as AddonForm["billingMode"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_ADDON_BILLING_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {BILLING_MODE_LABELS[mode] ?? mode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="addon-description">Description</Label>
                <Textarea
                  id="addon-description"
                  value={addon.description}
                  onChange={(e) => update({ description: e.target.value })}
                  placeholder="What does this add-on provide?"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Default currency</Label>
                <Select
                  value={defaultCurrency}
                  onValueChange={setDefaultCurrency}
                >
                  <SelectTrigger aria-label="Default currency">
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
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Switch
                  checked={addon.isActive}
                  onCheckedChange={(checked) => update({ isActive: checked })}
                />
                <Label className="text-sm">Active</Label>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 md:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pricing terms</CardTitle>
                  <CardDescription>
                    Configure multi-currency pricing per billing period.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={addPrice}>
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Add term
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {addon.prices.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No pricing terms configured. Add a term to price this add-on.
                </p>
              ) : (
                <DataTable
                  tableId="addon-pricing-terms"
                  columns={pricingColumns}
                  data={addon.prices}
                  searchableColumns={["billingPeriod", "currency", "amount"]}
                  searchPlaceholder="Search pricing terms..."
                  emptyMessage="No pricing terms configured."
                />
              )}

              {hasErrors && (
                <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  <WarningIcon className="h-4 w-4" />
                  <span>
                    {missingPriceCells.length > 0
                      ? `Missing prices: ${missingPriceCells.map((cell) => `${cell.billingPeriod}/${cell.currency}`).join(", ")}`
                      : "Some pricing terms have validation errors."}
                  </span>
                </div>
              )}

              {addon.prices.length > 0 && !hasErrors && (
                <div className="mt-4 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircleIcon className="h-4 w-4" />
                  All pricing terms valid
                </div>
              )}
            </CardContent>
          </Card>

          {addon.prices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pricing preview</CardTitle>
                <CardDescription>
                  How this add-on will appear to customers.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  tableId="addon-pricing-preview"
                  columns={[
                    {
                      accessorKey: "billingPeriod",
                      header: "Period",
                      cell: ({ row }) =>
                        billingPeriodLabel(row.original.billingPeriod),
                    },
                    {
                      id: "price",
                      header: "Price",
                      accessorFn: (row) => row.amount,
                      cell: ({ row }) =>
                        row.original.amount
                          ? formatBillingMoney(
                              row.original.amount,
                              row.original.currency
                            )
                          : "—",
                    },
                  ]}
                  data={addon.prices.filter((price) => price.isActive)}
                  searchableColumns={["billingPeriod", "currency", "amount"]}
                  searchPlaceholder="Search preview..."
                  emptyMessage="No active prices."
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}
