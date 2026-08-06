"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { eden } from "@/lib/eden"

import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "@phosphor-icons/react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import {
  voucherKindLabel,
  type VoucherCreateInput,
  type VoucherDetailDTO,
  type VoucherKind,
} from "@/lib/billing-client"
import { VoucherTypeTab } from "../[id]/voucher-type-tab"
import { VoucherAudienceTab } from "../[id]/voucher-audience-tab"
import { VoucherRulesTab } from "../[id]/voucher-rules-tab"
import { VoucherPreviewTab } from "../[id]/voucher-preview-tab"
import { VoucherPublishTab } from "../[id]/voucher-publish-tab"

const TAB_VALUES = ["type", "audience", "rules", "preview", "publish"] as const
type TabValue = (typeof TAB_VALUES)[number]

type DraftVoucher = {
  prefix: string
  maxClaims: number
  expiresAt: string
  amount: number
  currency: string
  targetWorkosUserId: string | null
  targetOrganizationId: string | null
  kind: VoucherKind
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

  function updateField(updates: Partial<DraftVoucher>) {
    setDraft((prev) => ({ ...prev, ...updates }))
  }

  const handleUpdate = (updates: Record<string, unknown>) => {
    updateField(updates as Partial<DraftVoucher>)
  }

  async function handleCreate(publish: boolean) {
    setIsCreating(true)
    setError(null)

    const validationErrors = validateDraft(draft)
    if (validationErrors.length > 0) {
      setError(validationErrors.join(" "))
      setIsCreating(false)
      return
    }

    try {
      const payload: VoucherCreateInput = {
        prefix: draft.prefix || undefined,
        maxClaims: draft.maxClaims,
        expiresAt: new Date(draft.expiresAt).toISOString(),
        amount: draft.amount,
        currency: draft.currency,
        targetWorkosUserId: draft.targetWorkosUserId ?? undefined,
        targetOrganizationId: draft.targetOrganizationId ?? undefined,
        kind: draft.kind,
        discountType: draft.discountType,
        discountValue: draft.discountValue,
        discountCurrency: draft.discountCurrency,
        currencyPolicy: draft.currencyPolicy,
        firstCheckoutOnly: draft.firstCheckoutOnly,
        allowUpgrade: draft.allowUpgrade,
        stackable: draft.stackable,
        minimumOrderAmount: draft.minimumOrderAmount,
        maximumDiscountAmount: draft.maximumDiscountAmount,
        allowedPackageCodes: draft.allowedPackageCodes,
        allowedPlanCodes: draft.allowedPlanCodes,
        allowedBillingPeriods: draft.allowedBillingPeriods,
      }

      if (publish) {
        payload.metadataJson = { _status: "ACTIVE" }
      } else {
        payload.metadataJson = { _status: "DISABLED" }
      }

      const { data } = await eden.api.vouchers.portal.post(payload as never)

      if (data?.ok) {
        const created = data.data as { id: string }
        router.push(`/portal/billing/promotions/${created.id}`)
      } else {
        setError(data?.message || "Failed to create voucher")
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      )
    } finally {
      setIsCreating(false)
    }
  }

  const voucherPreview = buildVoucherDetail(draft)

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/portal/billing/promotions">
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">New Voucher</h1>
            <p className="text-sm text-muted-foreground">
              {voucherKindLabel(draft.kind)}
            </p>
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Sticky Save / Create controls */}
      <div className="sticky top-0 z-10 -mx-6 border-b border-border bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
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
              onClick={() => void handleCreate(false)}
              disabled={isCreating}
            >
              {isCreating ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              onClick={() => void handleCreate(true)}
              disabled={isCreating}
            >
              {isCreating ? "Creating..." : "Create Voucher"}
            </Button>
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
      >
        <TabsContent value="type" className="space-y-4">
          <VoucherTypeTab voucher={voucherPreview} onUpdate={handleUpdate} />
        </TabsContent>

        <TabsContent value="audience" className="space-y-4">
          <VoucherAudienceTab
            voucher={voucherPreview}
            onUpdate={handleUpdate}
          />
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <VoucherRulesTab voucher={voucherPreview} onUpdate={handleUpdate} />
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <VoucherPreviewTab voucher={voucherPreview} />
        </TabsContent>

        <TabsContent value="publish" className="space-y-4">
          <VoucherPublishTab
            voucher={voucherPreview}
            onUpdate={handleUpdate}
            onSaveDraft={() => void handleCreate(false)}
            onPublish={() => void handleCreate(true)}
            isSaving={isCreating}
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
    status: "DISABLED",
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
    expiresAt: draft.expiresAt || new Date().toISOString(),
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

function validateDraft(draft: DraftVoucher): string[] {
  const errors: string[] = []

  if (!draft.expiresAt) {
    errors.push("Expiration date is required.")
  }
  if (draft.amount <= 0) {
    errors.push("Amount must be greater than 0.")
  }
  if (draft.maxClaims < 1) {
    errors.push("Max claims must be at least 1.")
  }
  if (draft.kind === "PRODUCT_PROMOTION") {
    if (!draft.discountType) {
      errors.push("Discount type is required for product promotions.")
    }
    if (!draft.discountValue || draft.discountValue <= 0) {
      errors.push("Discount value must be greater than 0.")
    }
  }

  return errors
}
