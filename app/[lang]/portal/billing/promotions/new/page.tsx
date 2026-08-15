"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { eden } from "@/lib/eden"

import { ArrowLeftIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import {
  voucherKindLabel,
  type VoucherCreateInput,
  type VoucherDetailDTO,
  type VoucherInitialStatus,
  type VoucherKind,
} from "@/lib/billing-client"
import { VoucherAudienceTab } from "../[id]/voucher-audience-tab"
import { VoucherPreviewTab } from "../[id]/voucher-preview-tab"
import { VoucherPublishTab } from "../[id]/voucher-publish-tab"
import { VoucherRulesTab } from "../[id]/voucher-rules-tab"
import { VoucherTypeTab } from "../[id]/voucher-type-tab"

const TAB_VALUES = ["type", "audience", "rules", "preview", "publish"] as const
type TabValue = (typeof TAB_VALUES)[number]
type FieldErrors = Record<string, string[]>

type DraftVoucher = {
  prefix: string
  maxClaims: number
  expiresAt: string
  amount: number
  currency: string
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

export default function NewVoucherPage() {
  const router = useRouter()
  const [draft, setDraft] = useState<DraftVoucher>({
    prefix: "",
    maxClaims: 1,
    expiresAt: "",
    amount: 0,
    currency: "IDR",
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
  const [activeTab, setActiveTab] = useState<TabValue>("type")
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

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

  const voucherPreview = buildVoucherDetail(draft)

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
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
              {voucherKindLabel(draft.kind)}
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

      <div className="sticky top-0 z-10 -mx-6 border-b border-border bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {TAB_VALUES.map((tab) => (
              <Button
                key={tab}
                variant={activeTab === tab ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab(tab)}
              >
                {tabLabel(tab)}
              </Button>
            ))}
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
              onClick={() => void handleCreate("ACTIVE")}
              disabled={isCreating}
            >
              {isCreating ? "Publishing..." : "Publish"}
            </Button>
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabValue)}
      >
        <TabsContent value="type" className="flex flex-col gap-4">
          <VoucherTypeTab
            voucher={voucherPreview}
            onUpdate={handleUpdate}
            fieldErrors={fieldErrors}
          />
        </TabsContent>

        <TabsContent value="audience" className="flex flex-col gap-4">
          <VoucherAudienceTab
            voucher={voucherPreview}
            onUpdate={handleUpdate}
          />
        </TabsContent>

        <TabsContent value="rules" className="flex flex-col gap-4">
          <VoucherRulesTab
            voucher={voucherPreview}
            onUpdate={handleUpdate}
            isNew
            fieldErrors={fieldErrors}
          />
        </TabsContent>

        <TabsContent value="preview" className="flex flex-col gap-4">
          <VoucherPreviewTab voucher={voucherPreview} />
        </TabsContent>

        <TabsContent value="publish" className="flex flex-col gap-4">
          <VoucherPublishTab
            voucher={voucherPreview}
            onUpdate={handleUpdate}
            onSaveDraft={() => void handleCreate("DISABLED")}
            onPublish={() => void handleCreate("ACTIVE")}
            isSaving={isCreating}
            fieldErrors={fieldErrors}
          />
        </TabsContent>
      </Tabs>
    </main>
  )
}

function tabLabel(tab: TabValue): string {
  switch (tab) {
    case "type":
      return "Type"
    case "audience":
      return "Audience"
    case "rules":
      return "Rules"
    case "preview":
      return "Preview"
    case "publish":
      return "Publish"
  }
}

function buildVoucherDetail(draft: DraftVoucher): VoucherDetailDTO {
  return {
    id: "new",
    code: draft.prefix ? `${draft.prefix}-XXXX` : "XXXX-XXXX",
    prefix: draft.prefix || null,
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
    prefix: draft.prefix || undefined,
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
  const candidate = unwrapErrorValue(value)
  if (!isRecord(candidate)) {
    return {
      ok: false,
      message: candidate instanceof Error ? candidate.message : undefined,
      fieldErrors: {},
    }
  }

  const fieldErrors = isRecord(candidate.fieldErrors)
    ? Object.fromEntries(
        Object.entries(candidate.fieldErrors).map(([key, messages]) => [
          key,
          Array.isArray(messages)
            ? messages.filter(
                (message): message is string => typeof message === "string"
              )
            : [],
        ])
      )
    : {}

  return {
    ok: candidate.ok === true,
    data: candidate.data,
    message:
      typeof candidate.message === "string" ? candidate.message : undefined,
    fieldErrors,
  }
}

function unwrapErrorValue(value: unknown): unknown {
  if (isRecord(value) && "value" in value) return value.value
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
