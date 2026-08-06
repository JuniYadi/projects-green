"use client"

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
        setError("Failed to load voucher")
        return
      }
      if (!data.ok) {
        setError(data.message || "Failed to load voucher")
        return
      }
      setVoucher(data.data as unknown as VoucherDetailDTO)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      )
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

      const errors = validateVoucher(voucher)
      setValidationErrors(errors)
      if (Object.keys(errors).length > 0) return

      setIsSaving(true)
      try {
        const update = {
          ...voucher,
          status: draft ? "DISABLED" : "ACTIVE",
        }
        await eden.api.vouchers.portal[voucherId].patch(update as never)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save voucher")
      } finally {
        setIsSaving(false)
      }
    },
    [voucher, voucherId]
  )

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
            Voucher not found.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            The voucher you are looking for does not exist.
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
  isSaving,
}: VoucherEditorLayoutProps) {
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
              {voucherKindLabel(voucher.kind)} · {voucher.claimedCount} /{" "}
              {voucher.maxClaims} claims used
            </p>
          </div>
        </div>
      </header>

      {/* Sticky Save / Publish controls */}
      <div className="sticky top-0 z-10 -mx-6 border-b border-border bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => void onSave(true)}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Draft"}
          </Button>
          <Button onClick={() => void onSave(false)} disabled={isSaving}>
            {isSaving ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="type">Type</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="publish">Publish</TabsTrigger>
          <TabsTrigger value="claims">Claims</TabsTrigger>
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

function validateVoucher(voucher: VoucherDetailDTO): Record<string, string[]> {
  const errors: Record<string, string[]> = {}

  if (voucher.kind === "PRODUCT_PROMOTION") {
    if (!voucher.discountType) {
      errors.discountType = ["Discount type is required for product promotions"]
    }
    if (!voucher.discountValue) {
      errors.discountValue = [
        "Discount value is required for product promotions",
      ]
    }
  }

  if (
    voucher.discountType === "PERCENTAGE" &&
    voucher.discountValue !== null &&
    voucher.discountValue !== undefined
  ) {
    const val = Number(voucher.discountValue)
    if (val <= 0 || val > 100) {
      errors.discountValue = ["Percentage must be between 1 and 100"]
    }
  }

  if (
    voucher.discountType === "FIXED" &&
    voucher.discountValue !== null &&
    voucher.discountValue !== undefined
  ) {
    if (Number(voucher.discountValue) <= 0) {
      errors.discountValue = ["Fixed amount must be greater than 0"]
    }
  }

  if (voucher.maxClaims < 1) {
    errors.maxClaims = ["Max claims must be at least 1"]
  }

  if (new Date(voucher.expiresAt) <= new Date()) {
    errors.expiresAt = ["Expiration date must be in the future"]
  }

  return errors
}
