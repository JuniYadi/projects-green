"use client"

import { useState, useEffect } from "react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { formatBillingMoney } from "@/modules/billing/format-money"
import { toast } from "sonner"

// UI-local mock data for editing
const MOCK_ADDON_DETAIL: AddonDetail = {
  id: "addon-1",
  code: "EXTRA_STORAGE",
  name: "Extra Storage",
  description: "50 GB of additional SSD storage",
  billingMode: "RECURRING",
  isActive: true,
  prices: [
    {
      id: "price-1",
      billingPeriod: "MONTHLY",
      currency: "IDR",
      amount: "50000",
      effectiveFrom: "2025-01-01",
      effectiveTo: null,
      isActive: true,
    },
    {
      id: "price-2",
      billingPeriod: "QUARTERLY",
      currency: "IDR",
      amount: "145000",
      effectiveFrom: "2025-01-01",
      effectiveTo: null,
      isActive: true,
    },
  ],
  planAttachments: [
    {
      id: "att-1",
      planId: "plan-1",
      planCode: "STARTER",
      planName: "Starter",
      label: "Extra Storage",
      description: null,
      isRequired: false,
      displayOrder: 0,
      isActive: true,
    },
  ],
  createdAt: "2025-01-15T10:30:00.000Z",
  updatedAt: "2025-01-15T10:30:00.000Z",
}

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

  const [addon, setAddon] = useState<AddonForm | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [modified, setModified] = useState(false)

  useEffect(() => {
    let fetchTimer: number | undefined
    const timer = window.setTimeout(() => {
      if (isNew) {
        setAddon({
          id: `new-${crypto.randomUUID()}`,
          code: "",
          name: "",
          description: "",
          billingMode: "RECURRING",
          isActive: true,
          prices: [],
        })
        setLoading(false)
        return
      }

      // In a real implementation this would fetch from the backend by code.
      setLoading(true)
      fetchTimer = window.setTimeout(() => {
        setAddon(addonDetailToForm(MOCK_ADDON_DETAIL))
        setLoading(false)
      }, 150)
    }, 0)

    return () => {
      window.clearTimeout(timer)
      if (fetchTimer !== undefined) window.clearTimeout(fetchTimer)
    }
  }, [isNew])

  if (loading) return <LoadingSkeleton />
  if (!addon) return null

  const update = (next: Partial<AddonForm>) => {
    setAddon((prev) => (prev ? { ...prev, ...next } : prev))
    setModified(true)
  }

  const updatePricing = (index: number, next: Partial<AddonPricingForm>) => {
    if (!addon) return
    const prices = [...addon.prices]
    prices[index] = { ...prices[index], ...next }
    update({ prices })
  }

  const addPrice = () => {
    const newPrice: AddonPricingForm = {
      id: `price-new-${crypto.randomUUID()}`,
      billingPeriod: "MONTHLY",
      currency: "IDR",
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
    update({ isActive: false })
    toast.success("Add-on archived")
    setModified(false)
  }

  const priceValidations = addon.prices.map((price) => {
    const errors: string[] = []
    if (!price.amount || Number(price.amount) < 0) {
      errors.push("Amount is required and must be non-negative")
    }
    if (price.effectiveTo && price.effectiveTo < price.effectiveFrom) {
      errors.push("Effective 'to' must be after 'from'")
    }
    return errors
  })

  const hasErrors = priceValidations.some((e) => e.length > 0)

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
              <div className="flex items-center gap-2 pt-2">
                <Switch
                  checked={addon.isActive}
                  onCheckedChange={(checked) => update({ isActive: checked })}
                />
                <Label className="text-sm">Active</Label>
              </div>
            </CardContent>
          </Card>

          {MOCK_ADDON_DETAIL.planAttachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Attached to plans</CardTitle>
                <CardDescription>
                  Plans currently using this add-on.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Required</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_ADDON_DETAIL.planAttachments.map((att) => (
                      <TableRow key={att.id}>
                        <TableCell>
                          <span className="font-medium">{att.planName}</span>
                          <span className="text-xs text-muted-foreground">
                            {" "}
                            ({att.planCode})
                          </span>
                        </TableCell>
                        <TableCell>{att.label ?? "—"}</TableCell>
                        <TableCell>{att.isRequired ? "Yes" : "No"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Billing period</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Effective from</TableHead>
                      <TableHead>Effective to</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {addon.prices.map((price, index) => {
                      const errors = priceValidations[index] ?? []
                      return (
                        <TableRow
                          key={price.id}
                          className={
                            errors.length > 0 ? "bg-destructive/5" : undefined
                          }
                        >
                          <TableCell>
                            <Select
                              value={price.billingPeriod}
                              onValueChange={(value) =>
                                updatePricing(index, {
                                  billingPeriod:
                                    value as AddonPricingForm["billingPeriod"],
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
                          </TableCell>
                          <TableCell>
                            <Select
                              value={price.currency}
                              onValueChange={(value) =>
                                updatePricing(index, { currency: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SUPPORTED_CURRENCIES.map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {c}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={price.amount}
                              onChange={(e) =>
                                updatePricing(index, {
                                  amount: e.target.value,
                                })
                              }
                              aria-invalid={
                                !price.amount || Number(price.amount) < 0
                              }
                            />
                            {errors.includes(
                              "Amount is required and must be non-negative"
                            ) && (
                              <p className="mt-1 text-xs text-destructive">
                                {errors[0]}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={price.effectiveFrom}
                              onChange={(e) =>
                                updatePricing(index, {
                                  effectiveFrom: e.target.value,
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={price.effectiveTo}
                              onChange={(e) =>
                                updatePricing(index, {
                                  effectiveTo: e.target.value,
                                })
                              }
                              aria-invalid={Boolean(
                                price.effectiveTo &&
                                price.effectiveTo < price.effectiveFrom
                              )}
                            />
                            {errors.includes(
                              "Effective 'to' must be after 'from'"
                            ) && (
                              <p className="mt-1 text-xs text-destructive">
                                {errors[0]}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={price.isActive}
                              onCheckedChange={(checked) =>
                                updatePricing(index, { isActive: checked })
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removePrice(index)}
                              aria-label="Remove price"
                            >
                              <TrashIcon className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}

              {hasErrors && (
                <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  <WarningIcon className="h-4 w-4" />
                  Some pricing terms have validation errors.
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {addon.prices
                      .filter((p) => p.isActive)
                      .map((price) => (
                        <TableRow key={price.id}>
                          <TableCell>
                            {billingPeriodLabel(price.billingPeriod)}
                          </TableCell>
                          <TableCell>
                            {price.amount
                              ? formatBillingMoney(price.amount, price.currency)
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}
