"use client"

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import Link from "next/link"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { eden } from "@/lib/eden"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeftIcon } from "@phosphor-icons/react"
import {
  VOUCHER_STATUS_COLORS,
  voucherKindLabel,
  type VoucherDetailDTO,
} from "@/lib/billing-client"
import { VoucherTypeTab } from "./voucher-type-tab"
import { VoucherAudienceTab } from "./voucher-audience-tab"
import { VoucherRulesTab } from "./voucher-rules-tab"
import { VoucherPreviewTab } from "./voucher-preview-tab"
import { VoucherPublishTab } from "./voucher-publish-tab"
import { VoucherClaimsTab } from "./voucher-claims-tab"

const TAB_VALUES = [
  "type",
  "audience",
  "rules",
  "preview",
  "publish",
  "claims",
] as const

type TabValue = (typeof TAB_VALUES)[number]

export default function VoucherEditorPage() {
  const params = useParams<{ id: string }>()
  const voucherId = params?.id as string
  const router = useRouter()
  const searchParams = useSearchParams()

  const tabParam = searchParams.get("tab") ?? "type"
  const activeTab = TAB_VALUES.includes(tabParam as TabValue)
    ? (tabParam as TabValue)
    : "type"

  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams.toString())
    next.set("tab", value)
    router.push(`?${next.toString()}`, { scroll: false })
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <VoucherEditorShell
        voucherId={voucherId}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
    </main>
  )
}

// ─── Shell that loads the voucher and renders tabs ──────────────────────────

type VoucherEditorShellProps = {
  voucherId: string
  activeTab: TabValue
  onTabChange: (value: string) => void
}

function VoucherEditorShell({
  voucherId,
  activeTab,
  onTabChange,
}: VoucherEditorShellProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pPortalBillingPromotionsPageClient

  const [voucher, setVoucher] = useState<NullableVoucher>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string[]>
  >({})

  const loadData = useCallback(async () => {
    if (!voucherId) return
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await eden.api.vouchers.portal[voucherId].get()

      if (!data) {
        setError(t.failedToLoadVoucher)
        return
      }
      if (!data.ok) {
        setError(data.message || t.failedToLoadVoucher)
        return
      }
      setVoucher(data.data as unknown as VoucherDetailDTO)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.unexpectedError)
    } finally {
      setIsLoading(false)
    }
  }, [voucherId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  const handleFieldUpdate = useCallback(
    (updates: Partial<Record<string, unknown>>) => {
      setVoucher((prev) => (prev ? { ...prev, ...updates } : prev))
    },
    []
  )

  const handleSave = useCallback(
    async (draft: boolean) => {
      if (!voucher || !voucherId) return

      const errors = validateVoucher(voucher, t)
      setValidationErrors(errors)
      if (Object.keys(errors).length > 0) return

      setIsSaving(true)
      try {
        const update = buildVoucherUpdate(voucher, draft)
        const response = await eden.api.vouchers.portal[voucherId].patch(
          update as never
        )
        const responseData = response.data as
          | { ok?: boolean; data?: VoucherDetailDTO; message?: string }
          | undefined
        if (responseData?.ok === false) {
          throw new Error(responseData.message || t.failedToSaveVoucher)
        }

        if (!draft && voucher.status !== "ACTIVE") {
          const publishResponse =
            await eden.api.vouchers.portal[voucherId].publish.post()
          const publishData = publishResponse.data as
            | { ok?: boolean; data?: VoucherDetailDTO; message?: string }
            | undefined
          if (publishData?.ok === false) {
            throw new Error(publishData.message || t.failedToSaveVoucher)
          }
          if (publishData?.data) setVoucher(publishData.data)
        } else if (responseData?.data) {
          setVoucher(responseData.data)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t.failedToSaveVoucher)
      } finally {
        setIsSaving(false)
      }
    },
    [t.failedToSaveVoucher, voucher, voucherId]
  )

  const handleDisable = useCallback(async () => {
    if (!voucherId) return
    setIsSaving(true)
    setError(null)
    try {
      const { data } = await eden.api.vouchers.portal[voucherId].disable.post()
      if (data && "ok" in data && data.ok) {
        setVoucher((prev) => (prev ? { ...prev, status: "DISABLED" } : prev))
      } else {
        setError(
          (data && "message" in data ? (data.message as string) : null) ||
            t.failedToDisableVoucher
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToDisableVoucher)
    } finally {
      setIsSaving(false)
    }
  }, [voucherId])

  const handleExpire = useCallback(async () => {
    if (!voucherId) return
    setIsSaving(true)
    setError(null)
    try {
      const { data } = await eden.api.vouchers.portal[voucherId].expire.post()
      if (data && "ok" in data && data.ok) {
        setVoucher((prev) => (prev ? { ...prev, status: "EXPIRED" } : prev))
      } else {
        setError(
          (data && "message" in data ? (data.message as string) : null) ||
            t.failedToExpireVoucher
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToExpireVoucher)
    } finally {
      setIsSaving(false)
    }
  }, [voucherId])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (!voucher) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm font-medium text-foreground">
            {t.voucherNotFoundTitle}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.voucherNotFoundDesc}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <VoucherEditorLayout
      voucher={voucher}
      activeTab={activeTab}
      onTabChange={onTabChange}
      onFieldUpdate={handleFieldUpdate}
      onSave={handleSave}
      onDisable={handleDisable}
      onExpire={handleExpire}
      isSaving={isSaving}
      validationErrors={validationErrors}
    />
  )
}

// ─── Layout with header, tabs, sticky controls ──────────────────────────────

type VoucherEditorLayoutProps = {
  voucher: VoucherDetailDTO
  activeTab: TabValue
  onTabChange: (value: string) => void
  onFieldUpdate: (updates: Partial<Record<string, unknown>>) => void
  onSave: (draft: boolean) => void
  onDisable: () => void
  onExpire: () => void
  isSaving: boolean
  validationErrors: Record<string, string[]>
}

type NullableVoucher = VoucherDetailDTO | null

function VoucherEditorLayout({
  voucher,
  activeTab,
  onTabChange,
  onFieldUpdate,
  onSave,
  onDisable,
  onExpire,
  isSaving,
}: VoucherEditorLayoutProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pPortalBillingPromotionsPageClient

  const isExpired =
    voucher.status === "EXPIRED" || new Date(voucher.expiresAt) <= new Date()

  return (
    <>
      <header className="space-y-1">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/portal/billing/promotions">
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{voucher.code}</h1>
              <Badge
                variant="secondary"
                className={VOUCHER_STATUS_COLORS[voucher.status] ?? ""}
              >
                {voucher.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {voucherKindLabel(voucher.kind)} ·{" "}
              {t.claimsUsed
                .replace("{claimed}", String(voucher.claimedCount))
                .replace("{max}", String(voucher.maxClaims))}
            </p>
          </div>
        </div>
      </header>

      {/* Sticky Save / Publish / Status controls */}
      <div className="sticky top-0 z-10 -mx-6 border-b border-border bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-end gap-3">
          {voucher.status === "ACTIVE" && (
            <Button
              variant="outline"
              onClick={onDisable}
              disabled={isSaving}
              className="text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/20"
            >
              {isSaving ? t.updatingButton : t.deactivateButton}
            </Button>
          )}

          {voucher.status !== "EXPIRED" && isExpired && (
            <Button
              variant="destructive"
              onClick={onExpire}
              disabled={isSaving}
            >
              {isSaving ? t.updatingButton : t.markExpiredButton}
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => void onSave(true)}
            disabled={isSaving}
          >
            {isSaving ? t.savingButton : t.saveDraftButton}
          </Button>
          <Button onClick={() => void onSave(false)} disabled={isSaving}>
            {isSaving ? t.publishingButton : t.publishButton}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="type">{t.tabType}</TabsTrigger>
          <TabsTrigger value="audience">{t.tabAudience}</TabsTrigger>
          <TabsTrigger value="rules">{t.tabRules}</TabsTrigger>
          <TabsTrigger value="preview">{t.tabPreview}</TabsTrigger>
          <TabsTrigger value="publish">{t.tabPublish}</TabsTrigger>
          <TabsTrigger value="claims">{t.tabClaims}</TabsTrigger>
        </TabsList>

        <TabsContent value="type" className="space-y-4">
          <VoucherTypeTab voucher={voucher} onUpdate={onFieldUpdate} />
        </TabsContent>

        <TabsContent value="audience" className="space-y-4">
          <VoucherAudienceTab voucher={voucher} onUpdate={onFieldUpdate} />
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <VoucherRulesTab voucher={voucher} onUpdate={onFieldUpdate} />
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <VoucherPreviewTab voucher={voucher} />
        </TabsContent>

        <TabsContent value="publish" className="space-y-4">
          <VoucherPublishTab
            voucher={voucher}
            onUpdate={onFieldUpdate}
            onSaveDraft={() => void onSave(true)}
            onPublish={() => void onSave(false)}
            onDisable={onDisable}
            onExpire={onExpire}
            isSaving={isSaving}
          />
        </TabsContent>

        <TabsContent value="claims" className="space-y-4">
          <VoucherClaimsTab voucherId={voucher.id} claims={voucher.claims} />
        </TabsContent>
      </Tabs>
    </>
  )
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateVoucher(
  voucher: VoucherDetailDTO,
  t: Record<string, string>
): Record<string, string[]> {
  const errors: Record<string, string[]> = {}

  if (voucher.kind === "PRODUCT_PROMOTION") {
    if (!voucher.discountType) {
      errors.discountType = [t.discountTypeRequired]
    }
    if (!voucher.discountValue) {
      errors.discountValue = [t.discountValueRequired]
    }
  }

  if (
    voucher.discountType === "PERCENTAGE" &&
    voucher.discountValue !== null &&
    voucher.discountValue !== undefined
  ) {
    const val = Number(voucher.discountValue)
    if (val <= 0 || val > 100) {
      errors.discountValue = [t.percentageRangeError]
    }
  }

  if (
    voucher.discountType === "FIXED" &&
    voucher.discountValue !== null &&
    voucher.discountValue !== undefined
  ) {
    if (Number(voucher.discountValue) <= 0) {
      errors.discountValue = [t.fixedAmountMinError]
    }
  }

  if (voucher.maxClaims < 1) {
    errors.maxClaims = [t.maxClaimsMinError]
  }

  if (new Date(voucher.expiresAt) <= new Date()) {
    errors.expiresAt = [t.expiresAtFutureError]
  }

  return errors
}

function buildVoucherUpdate(
  voucher: VoucherDetailDTO,
  draft: boolean
): Record<string, unknown> {
  const update: Record<string, unknown> = {
    maxClaims: voucher.maxClaims,
    expiresAt: voucher.expiresAt,
    targetWorkosUserId: voucher.targetWorkosUserId,
    targetOrganizationId: voucher.targetOrganizationId,
    metadataJson: voucher.metadataJson,
  }

  if (draft) update.status = "DISABLED"

  if (voucher.kind === "BALANCE_CREDIT") {
    update.amount = Number(voucher.amount)
    update.currency = voucher.currency
  } else {
    update.discountType = voucher.discountType
    update.discountValue = Number(voucher.discountValue)
    update.discountCurrency = voucher.discountCurrency
    update.currencyPolicy = voucher.currencyPolicy
    update.firstCheckoutOnly = voucher.firstCheckoutOnly
    update.allowUpgrade = voucher.allowUpgrade
    update.stackable = voucher.stackable
    update.minimumOrderAmount = voucher.minimumOrderAmount
      ? Number(voucher.minimumOrderAmount)
      : null
    update.maximumDiscountAmount = voucher.maximumDiscountAmount
      ? Number(voucher.maximumDiscountAmount)
      : null
    update.allowedPackageCodes = voucher.allowedPackageCodes
    update.allowedPlanCodes = voucher.allowedPlanCodes
    update.allowedBillingPeriods = voucher.allowedBillingPeriods
  }

  return update
}
