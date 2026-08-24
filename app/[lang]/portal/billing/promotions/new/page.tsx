"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { eden } from "@/lib/eden"

import { ArrowLeftIcon } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  voucherKindLabel,
  type VoucherCreateInput,
  type VoucherDetailDTO,
  type VoucherInitialStatus,
  type VoucherKind,
} from "@/lib/billing-client"
import { VoucherAudienceTab } from "../[id]/voucher-audience-tab"
import { VoucherRulesTab } from "../[id]/voucher-rules-tab"
import { VoucherTypeTab } from "../[id]/voucher-type-tab"

type CodeMode = "RANDOM" | "PREFIX" | "STATIC"
type FieldErrors = Record<string, string[]>
type ExpiryPreset =
  | "7_DAYS"
  | "14_DAYS"
  | "30_DAYS"
  | "90_DAYS"
  | "1_YEAR"
  | "CUSTOM"

type DraftVoucher = {
  codeMode: CodeMode
  customCode: string
  prefix: string
  maxClaims: number
  expiryPreset: ExpiryPreset
  expiresAt: string
  amount: number
  targetWorkosUserId: string | null
  targetOrganizationId: string | null
  kind: VoucherKind
  status: VoucherInitialStatus
  discountType: "PERCENTAGE" | "FIXED" | null
  discountValue: number | null
  discountCurrency: string | null
  currencyPolicy:
    | "MATCH_CURRENCY_ONLY"
    | "CONVERT_AT_CHECKOUT"
    | "CONVERT_AT_REDEMPTION"
  firstCheckoutOnly: boolean
  allowUpgrade: boolean
  stackable: boolean
  minimumOrderAmount: number | null
  maximumDiscountAmount: number | null
  allowedPackageCodes: string[] | null
  allowedPlanCodes: string[] | null
  allowedBillingPeriods: string[] | null
}

const currentDateTimeLocal = () => {
  const now = new Date()
  const wibString = now.toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
  })
  return `${wibString}T00:00`
}

const getFutureDateFromDays = (days: number) => {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  const wibString = date.toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
  })
  return `${wibString}T00:00`
}

const formatWibDateTime = (isoOrLocalString?: string) => {
  if (!isoOrLocalString) return "-"
  const date = new Date(isoOrLocalString)
  if (Number.isNaN(date.getTime())) return "-"
  return `${date.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })} WIB`
}

const EXPIRY_PRESET_OPTIONS: {
  value: ExpiryPreset
  label: string
  days?: number
}[] = [
  { value: "7_DAYS", label: "7 Hari", days: 7 },
  { value: "14_DAYS", label: "14 Hari", days: 14 },
  { value: "30_DAYS", label: "30 Hari (1 Bulan)", days: 30 },
  { value: "90_DAYS", label: "90 Hari (3 Bulan)", days: 90 },
  { value: "1_YEAR", label: "1 Tahun", days: 365 },
  { value: "CUSTOM", label: "Custom / Advance" },
]
export default function NewVoucherPage() {
  const router = useRouter()
  const [draft, setDraft] = useState<DraftVoucher>({
    codeMode: "RANDOM",
    customCode: "",
    prefix: "",
    maxClaims: 1,
    expiryPreset: "30_DAYS",
    expiresAt: getFutureDateFromDays(30),
    amount: 0,
    targetWorkosUserId: null,
    targetOrganizationId: null,
    kind: "BALANCE_CREDIT",
    status: "DISABLED",
    discountType: null,
    discountValue: null,
    discountCurrency: null,
    currencyPolicy: "MATCH_CURRENCY_ONLY",
    firstCheckoutOnly: false,
    allowUpgrade: false,
    stackable: false,
    minimumOrderAmount: null,
    maximumDiscountAmount: null,
    allowedPackageCodes: null,
    allowedPlanCodes: null,
    allowedBillingPeriods: null,
  })

  const [activeTab, setActiveTab] = useState<"general" | "audience">("general")
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [confirmStatus, setConfirmStatus] =
    useState<VoucherInitialStatus>("ACTIVE")

  function updateField(updates: Partial<DraftVoucher>) {
    setDraft((previous) => ({ ...previous, ...updates }))
    setFieldErrors((previous) => {
      const next = { ...previous }
      for (const field of Object.keys(updates)) delete next[field]
      return next
    })
    setError(null)
  }

  const handleUpdate = (updates: Record<string, unknown>) => {
    updateField(updates as Partial<DraftVoucher>)
  }

  const codePreview = useMemo(() => {
    if (draft.codeMode === "STATIC") {
      return draft.customCode.trim().toUpperCase() || "DISCOUNT100"
    }
    if (draft.codeMode === "PREFIX") {
      const prefix = draft.prefix.trim().toUpperCase() || "PROMO"
      return `${prefix}-XXXXXX`
    }
    return "XXXXXXXX (Random 8 Chars)"
  }, [draft.codeMode, draft.customCode, draft.prefix])

  const voucherPreview = useMemo(
    () => buildVoucherDetail(draft, codePreview),
    [draft, codePreview]
  )

  const handleOpenPreview = (status: VoucherInitialStatus) => {
    const nextDraft = { ...draft, status }
    const validationErrors = validateDraft(nextDraft)
    setFieldErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      setError(formatFieldErrors(validationErrors))
      return
    }

    setConfirmStatus(status)
    setPreviewModalOpen(true)
  }

  async function handleCreate(status: VoucherInitialStatus) {
    const nextDraft = { ...draft, status }
    setDraft(nextDraft)
    setIsCreating(true)
    setError(null)

    const validationErrors = validateDraft(nextDraft)
    setFieldErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) {
      setError(formatFieldErrors(validationErrors))
      setIsCreating(false)
      setPreviewModalOpen(false)
      return
    }

    try {
      const payload = buildCreatePayload(nextDraft)
      const result = (await eden.api.vouchers.portal.post(
        payload as never
      )) as unknown as {
        data?: unknown
        error?: unknown
      }
      const response = readApiResponse(result.data ?? result.error)

      if (response.ok) {
        const created = response.data as { id: string }
        setPreviewModalOpen(false)
        router.push(`/portal/billing/promotions/${created.id}`)
        return
      }

      setFieldErrors(response.fieldErrors)
      setError(response.message || "Failed to create promotion.")
    } catch (requestError) {
      const response = readApiResponse(requestError)
      setFieldErrors(response.fieldErrors)
      setError(response.message || "An unexpected error occurred.")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      {/* Header */}
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link
              href="/portal/billing/promotions"
              aria-label="Back to promotions"
            >
              <ArrowLeftIcon />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">New Promotion</h1>
            <p className="text-sm text-muted-foreground">
              {voucherKindLabel(draft.kind)} &bull; Create and configure a new
              voucher
            </p>
          </div>
        </div>
      </header>

      {error && (
        <div
          className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Action Bar */}
      <div className="sticky top-0 z-10 -mx-6 border-b border-border bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              Code: {codePreview}
            </Badge>
            <Badge
              variant={
                draft.kind === "PRODUCT_PROMOTION" ? "default" : "secondary"
              }
              className="text-xs"
            >
              {voucherKindLabel(draft.kind)}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => void handleCreate("DISABLED")}
              disabled={isCreating}
            >
              {isCreating ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              onClick={() => handleOpenPreview("ACTIVE")}
              disabled={isCreating}
            >
              Preview &amp; Publish
            </Button>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "general" | "audience")}
      >
        <TabsList className="mb-2 grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="general">Details &amp; Rules</TabsTrigger>
          <TabsTrigger value="audience">Target Audience</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="flex flex-col gap-6">
          {/* Card 1: Code Generation Rules */}
          <Card>
            <CardHeader>
              <CardTitle>Voucher Code Generation</CardTitle>
              <CardDescription>
                Choose how the voucher code will be formatted.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <label
                  htmlFor="mode-random"
                  className={`flex cursor-pointer flex-col justify-between rounded-lg border p-4 transition-all ${
                    draft.codeMode === "RANDOM"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="codeMode"
                      id="mode-random"
                      value="RANDOM"
                      checked={draft.codeMode === "RANDOM"}
                      onChange={() => updateField({ codeMode: "RANDOM" })}
                      className="mt-0.5 h-4 w-4 text-primary"
                    />
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">
                        1. Full Random
                      </div>
                      <div className="text-xs text-muted-foreground">
                        8 alphanumeric random characters.
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 font-mono text-[11px] text-muted-foreground">
                    e.g. K8A9Z2X1
                  </div>
                </label>

                <label
                  htmlFor="mode-prefix"
                  className={`flex cursor-pointer flex-col justify-between rounded-lg border p-4 transition-all ${
                    draft.codeMode === "PREFIX"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="codeMode"
                      id="mode-prefix"
                      value="PREFIX"
                      checked={draft.codeMode === "PREFIX"}
                      onChange={() => updateField({ codeMode: "PREFIX" })}
                      className="mt-0.5 h-4 w-4 text-primary"
                    />
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">
                        2. Prefix + Random
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Targeted prefix + 6 random chars.
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 font-mono text-[11px] text-muted-foreground">
                    e.g. PMI-A7B8C9
                  </div>
                </label>

                <label
                  htmlFor="mode-static"
                  className={`flex cursor-pointer flex-col justify-between rounded-lg border p-4 transition-all ${
                    draft.codeMode === "STATIC"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="codeMode"
                      id="mode-static"
                      value="STATIC"
                      checked={draft.codeMode === "STATIC"}
                      onChange={() => updateField({ codeMode: "STATIC" })}
                      className="mt-0.5 h-4 w-4 text-primary"
                    />
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">
                        3. Static Custom Code
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Exact uppercase code for mass promos.
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 font-mono text-[11px] text-muted-foreground">
                    e.g. DISCOUNT100
                  </div>
                </label>
              </div>

              {draft.codeMode === "PREFIX" && (
                <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4">
                  <Label htmlFor="voucher-prefix">
                    Prefix Code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="voucher-prefix"
                    value={draft.prefix}
                    onChange={(e) =>
                      updateField({
                        prefix: e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, ""),
                      })
                    }
                    placeholder="e.g. PMI, SMAN1, TELKOM"
                    maxLength={10}
                    className="font-mono uppercase"
                    aria-invalid={Boolean(fieldErrors.prefix?.length)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Only uppercase letters and numbers (max 10 chars). Result:{" "}
                    <span className="font-mono font-semibold text-foreground">
                      {codePreview}
                    </span>
                  </p>
                  {fieldErrors.prefix?.map((err, i) => (
                    <p key={i} className="text-xs text-destructive">
                      {err}
                    </p>
                  ))}
                </div>
              )}

              {draft.codeMode === "STATIC" && (
                <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4">
                  <Label htmlFor="voucher-custom-code">
                    Custom Exact Code{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="voucher-custom-code"
                    value={draft.customCode}
                    onChange={(e) =>
                      updateField({
                        customCode: e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9-]/g, ""),
                      })
                    }
                    placeholder="e.g. DISCOUNT100, MERDEKA80"
                    maxLength={32}
                    className="font-mono uppercase"
                    aria-invalid={Boolean(fieldErrors.customCode?.length)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Uppercase alphanumeric and optional hyphens (3-32 chars).
                  </p>
                  {fieldErrors.customCode?.map((err, i) => (
                    <p key={i} className="text-xs text-destructive">
                      {err}
                    </p>
                  ))}
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-10">
                <div className="flex flex-col gap-2 lg:col-span-3">
                  <Label htmlFor="voucher-max-claims">
                    Max Total Claims <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="voucher-max-claims"
                    type="number"
                    min={1}
                    value={draft.maxClaims}
                    onChange={(e) =>
                      updateField({ maxClaims: Number(e.target.value) })
                    }
                    aria-invalid={Boolean(fieldErrors.maxClaims?.length)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum claims across all customers.
                  </p>
                  {fieldErrors.maxClaims?.map((err, i) => (
                    <p key={i} className="text-xs text-destructive">
                      {err}
                    </p>
                  ))}
                </div>

                <div className="flex flex-col gap-2 lg:col-span-7">
                  <Label>
                    Masa Berlaku (Expiration){" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {EXPIRY_PRESET_OPTIONS.map((preset) => {
                      const isSelected = draft.expiryPreset === preset.value
                      return (
                        <Button
                          key={preset.value}
                          type="button"
                          size="sm"
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => {
                            if (preset.days) {
                              updateField({
                                expiryPreset: preset.value,
                                expiresAt: getFutureDateFromDays(preset.days),
                              })
                            } else {
                              updateField({ expiryPreset: "CUSTOM" })
                            }
                          }}
                          className="text-xs"
                        >
                          {preset.label}
                        </Button>
                      )
                    })}
                  </div>

                  {draft.expiryPreset === "CUSTOM" ? (
                    <div className="mt-2 flex flex-col gap-1.5">
                      <Label
                        htmlFor="voucher-expires-at"
                        className="text-xs text-muted-foreground"
                      >
                        Pilih Tanggal &amp; Waktu Spesifik:
                      </Label>
                      <Input
                        id="voucher-expires-at"
                        type="datetime-local"
                        min={currentDateTimeLocal()}
                        value={draft.expiresAt}
                        onChange={(e) =>
                          updateField({
                            expiresAt: e.target.value,
                            expiryPreset: "CUSTOM",
                          })
                        }
                        aria-invalid={Boolean(fieldErrors.expiresAt?.length)}
                      />
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Berlaku hingga:{" "}
                      <span className="font-semibold text-foreground">
                        {formatWibDateTime(draft.expiresAt)}
                      </span>
                    </p>
                  )}
                  {fieldErrors.expiresAt?.map((err, i) => (
                    <p key={i} className="text-xs text-destructive">
                      {err}
                    </p>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Promotion Type & Value */}
          <VoucherTypeTab
            voucher={voucherPreview}
            onUpdate={handleUpdate}
            fieldErrors={fieldErrors}
          />

          {/* Card 3: Product Rules (for Product Promotion) */}
          <VoucherRulesTab
            voucher={voucherPreview}
            onUpdate={handleUpdate}
            isNew
            fieldErrors={fieldErrors}
          />
        </TabsContent>

        <TabsContent value="audience" className="flex flex-col gap-4">
          <VoucherAudienceTab
            voucher={voucherPreview}
            onUpdate={handleUpdate}
          />
        </TabsContent>
      </Tabs>

      {/* Confirmation & Preview Modal */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Promotion Publication</DialogTitle>
            <DialogDescription>
              Review the promotion details before making it active.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Voucher Code</span>
                <span className="font-mono font-bold text-foreground">
                  {codePreview}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium text-foreground">
                  {voucherKindLabel(draft.kind)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Benefit</span>
                <span className="font-semibold text-primary">
                  {draft.kind === "BALANCE_CREDIT"
                    ? `${draft.currency} ${draft.amount.toLocaleString("id-ID")}`
                    : draft.discountType === "PERCENTAGE"
                      ? `${draft.discountValue}% OFF`
                      : `${draft.discountCurrency || "IDR"} ${draft.discountValue?.toLocaleString("id-ID")}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Claims</span>
                <span className="text-foreground">
                  {draft.maxClaims} claim(s)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expires At</span>
                <span className="text-foreground">
                  {formatWibDateTime(draft.expiresAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target Audience</span>
                <span className="text-foreground">
                  {draft.targetOrganizationId
                    ? "Specific Organization"
                    : draft.targetWorkosUserId
                      ? "Specific User"
                      : "Public (All Users)"}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPreviewModalOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleCreate("DISABLED")}
              disabled={isCreating}
            >
              Save as Draft
            </Button>
            <Button
              onClick={() => void handleCreate(confirmStatus)}
              disabled={isCreating}
            >
              {isCreating ? "Publishing..." : "Confirm & Publish Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function buildVoucherDetail(
  draft: DraftVoucher,
  codePreview: string
): VoucherDetailDTO {
  return {
    id: "new",
    code: codePreview,
    prefix: draft.codeMode === "PREFIX" ? draft.prefix || null : null,
    status: draft.status,
    kind: draft.kind,
    discountType: draft.discountType,
    discountValue: draft.discountValue?.toString() ?? null,
    discountCurrency: draft.discountCurrency,
    currencyPolicy: draft.currencyPolicy,
    firstCheckoutOnly: draft.firstCheckoutOnly,
    allowUpgrade: draft.allowUpgrade,
    stackable: draft.stackable,
    minimumOrderAmount: draft.minimumOrderAmount?.toString() ?? null,
    maximumDiscountAmount: draft.maximumDiscountAmount?.toString() ?? null,
    maxClaims: draft.maxClaims,
    claimedCount: 0,
    expiresAt: draft.expiresAt,
    amount: draft.amount.toString(),
    currency: draft.currency,
    targetWorkosUserId: draft.targetWorkosUserId,
    targetOrganizationId: draft.targetOrganizationId,
    allowedPackageCodes: draft.allowedPackageCodes,
    allowedPlanCodes: draft.allowedPlanCodes,
    allowedBillingPeriods: draft.allowedBillingPeriods,
    createdByWorkosUserId: "",
    metadataJson: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    claims: [],
  }
}

function buildCreatePayload(draft: DraftVoucher): VoucherCreateInput {
  const common = {
    ...(draft.codeMode === "STATIC" && draft.customCode.trim()
      ? { code: draft.customCode.trim().toUpperCase() }
      : {}),
    ...(draft.codeMode === "PREFIX" && draft.prefix.trim()
      ? { prefix: draft.prefix.trim().toUpperCase() }
      : {}),
    maxClaims: draft.maxClaims,
    expiresAt: new Date(draft.expiresAt).toISOString(),
    status: draft.status,
    targetWorkosUserId: draft.targetWorkosUserId ?? undefined,
    targetOrganizationId: draft.targetOrganizationId ?? undefined,
  }

  if (draft.kind === "BALANCE_CREDIT") {
    return {
      ...common,
      kind: "BALANCE_CREDIT",
      amount: draft.amount,
      currency: draft.currency,
    }
  }
  const packageCodes = draft.allowedPackageCodes ?? []
  const planCodes = draft.allowedPlanCodes ?? []

  return {
    ...common,
    kind: "PRODUCT_PROMOTION",
    discountType: draft.discountType as "PERCENTAGE" | "FIXED",
    discountValue: draft.discountValue as number,
    currencyPolicy: draft.currencyPolicy,
    firstCheckoutOnly: draft.firstCheckoutOnly,
    allowUpgrade: draft.allowUpgrade,
    stackable: draft.stackable,
    ...(draft.discountCurrency
      ? { discountCurrency: draft.discountCurrency }
      : {}),
    ...(draft.minimumOrderAmount !== null
      ? { minimumOrderAmount: draft.minimumOrderAmount }
      : {}),
    ...(draft.maximumDiscountAmount !== null
      ? { maximumDiscountAmount: draft.maximumDiscountAmount }
      : {}),
    allowedPackageCodes: packageCodes,
    allowedPlanCodes: planCodes,
    allowedBillingPeriods: draft.allowedBillingPeriods ?? [],
  }
}

function validateDraft(draft: DraftVoucher): FieldErrors {
  const errors: FieldErrors = {}

  const addError = (field: string, message: string) => {
    errors[field] ??= []
    errors[field].push(message)
  }

  if (draft.codeMode === "PREFIX" && !draft.prefix.trim()) {
    addError("prefix", "Prefix code is required when using prefix mode.")
  }

  if (draft.codeMode === "STATIC") {
    if (!draft.customCode.trim()) {
      addError("customCode", "Custom code is required.")
    } else if (
      draft.customCode.trim().length < 3 ||
      draft.customCode.trim().length > 32
    ) {
      addError("customCode", "Custom code must be between 3 and 32 characters.")
    }
  }

  if (!draft.expiresAt) {
    addError("expiresAt", "Expiration date is required.")
  } else {
    const expiresAt = new Date(draft.expiresAt)
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      addError("expiresAt", "Expiration date must be in the future.")
    }
  }

  if (draft.maxClaims < 1) {
    addError("maxClaims", "Max claims must be at least 1.")
  }

  if (draft.kind === "BALANCE_CREDIT") {
    if (draft.amount <= 0) {
      addError("amount", "Credit amount must be greater than 0.")
    }
    return errors
  }

  if (!draft.discountType) {
    addError("discountType", "Discount type is required.")
  }
  if (!draft.discountValue || draft.discountValue <= 0) {
    addError("discountValue", "Discount value must be greater than 0.")
  }
  if (
    draft.discountType === "PERCENTAGE" &&
    draft.discountValue !== null &&
    draft.discountValue > 100
  ) {
    addError("discountValue", "Percentage discount cannot exceed 100%.")
  }
  if (draft.discountType === "FIXED" && !draft.discountCurrency) {
    addError(
      "discountCurrency",
      "Discount currency is required for fixed discounts."
    )
  }
  if (draft.minimumOrderAmount !== null && !draft.discountCurrency) {
    addError(
      "minimumOrderAmount",
      "Minimum order amount requires a discount currency."
    )
  }
  if (draft.maximumDiscountAmount !== null && draft.discountType === "FIXED") {
    addError(
      "maximumDiscountAmount",
      "Maximum discount amount applies only to percentage discounts."
    )
  }

  const hasEligiblePackage = Boolean(draft.allowedPackageCodes?.length)
  const hasEligiblePlan = Boolean(draft.allowedPlanCodes?.length)
  if (!hasEligiblePackage && !hasEligiblePlan) {
    addError(
      "allowedPackageCodes",
      "Select at least one eligible product package or plan."
    )
  }
  if (!draft.allowedBillingPeriods?.length) {
    addError(
      "allowedBillingPeriods",
      "Select at least one allowed billing period."
    )
  }

  return errors
}

function formatFieldErrors(errors: FieldErrors): string {
  return Object.values(errors).flat().join(" ")
}

function readApiResponse(value: unknown): {
  ok: boolean
  data?: unknown
  message?: string
  fieldErrors: FieldErrors
} {
  const candidate =
    typeof value === "object" && value !== null && "value" in value
      ? (value as { value: unknown }).value
      : value

  if (typeof candidate !== "object" || candidate === null) {
    return {
      ok: false,
      message: candidate instanceof Error ? candidate.message : undefined,
      fieldErrors: {},
    }
  }

  const record = candidate as Record<string, unknown>
  const rawFieldErrors =
    typeof record.fieldErrors === "object" && record.fieldErrors !== null
      ? (record.fieldErrors as Record<string, unknown>)
      : {}

  const fieldErrors = Object.fromEntries(
    Object.entries(rawFieldErrors).map(([key, messages]) => [
      key,
      Array.isArray(messages)
        ? messages.filter(
            (message): message is string => typeof message === "string"
          )
        : [],
    ])
  )

  return {
    ok: record.ok === true,
    data: record.data,
    message: typeof record.message === "string" ? record.message : undefined,
    fieldErrors,
  }
}
