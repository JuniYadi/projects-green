"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import Link from "next/link"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  WarningIcon,
  EyeIcon,
} from "@/components/ui/phosphor-icons"
import {
  getAdminCatalogProduct,
  publishCatalogProduct,
} from "@/lib/billing-client"
import type {
  CatalogProduct,
  CatalogProductDetailResponse,
  PublishCatalogProductInput,
} from "@/lib/billing-client"
import { CatalogBasicsTab } from "@/app/[lang]/portal/billing/catalog/[productCode]/catalog-basics-tab"
import { CatalogPlansTab } from "@/app/[lang]/portal/billing/catalog/[productCode]/catalog-plans-tab"
import { CatalogAddonsTab } from "@/app/[lang]/portal/billing/catalog/[productCode]/catalog-addons-tab"
import { CatalogProductDetailsTab } from "@/app/[lang]/portal/billing/catalog/[productCode]/catalog-product-details-tab"
import { CatalogPublishTab } from "@/app/[lang]/portal/billing/catalog/[productCode]/catalog-publish-tab"
import type {
  ProductBasicsForm,
  ProductPlanEditorForm,
  PlanAddonAttachmentForm,
  ProductPublishState,
  ProductEditorState,
  ProductPlanOfferForm,
} from "@/components/billing/admin/catalog/catalog-editor.types"
import {
  PRODUCT_OPTIONS,
  SUPPORTED_CURRENCIES,
  validateProductPlanIdentities,
  validateProductPublish,
} from "@/components/billing/admin/catalog/catalog-editor.types"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { toast } from "sonner"

const TAB_IDS = ["basics", "plans", "addons", "details", "publish"] as const

function safeReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null
  return value
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div className="space-y-1">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

function productToEditorState(
  product: CatalogProduct,
  currency: string
): ProductEditorState {
  const enabledCurrencies = [
    ...new Set([
      currency,
      ...product.plans.flatMap((plan) =>
        plan.offers.map((offer) => offer.currency)
      ),
    ]),
  ].filter((value): value is ProductBasicsForm["enabledCurrencies"][number] =>
    SUPPORTED_CURRENCIES.includes(
      value as (typeof SUPPORTED_CURRENCIES)[number]
    )
  )

  return {
    basics: {
      code: product.code as ProductBasicsForm["code"],
      name: product.name,
      description: product.description ?? "",
      currency,
      enabledCurrencies,
      isActive: product.isActive,
    },
    plans: product.plans.map((plan) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      resources: plan.resources,
      billingStrategy:
        (plan as unknown as { billingStrategy?: "PRO_RATA" | "FIXED_CYCLE" })
          .billingStrategy ?? "FIXED_CYCLE",
      stockControl:
        (plan as unknown as { stockControl?: "UNLIMITED" | "TRACKED" })
          .stockControl ?? "UNLIMITED",
      stockCount:
        (plan as unknown as { stockCount?: number | null }).stockCount ?? null,
      allowBackorder: Boolean(
        (plan as unknown as { allowBackorder?: boolean }).allowBackorder
      ),
      isActive: true,
      enabledTerms:
        plan.offers.length > 0
          ? [
              ...new Set(
                plan.offers.map(
                  (offer) =>
                    offer.billingPeriod as ProductPlanOfferForm["billingPeriod"]
                )
              ),
            ]
          : ["MONTHLY"],
      offers: plan.offers.map((offer): ProductPlanOfferForm => ({
        id: offer.id,
        billingPeriod:
          offer.billingPeriod as ProductPlanOfferForm["billingPeriod"],
        periodPrice: offer.periodPrice,
        currency: offer.currency,
        chargeUnit: offer.chargeUnit,
        effectiveFrom: offer.effectiveFrom,
        effectiveTo: offer.effectiveTo ?? "",
        isActive: true,
      })),
    })),
    addons: [],
    publishState: "draft",
    preview: false,
  }
}

export function ProductEditor({
  productCode: requestedProductCode,
  isNew,
}: Readonly<{
  productCode: string
  isNew: boolean
}>) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { lang } = useParams<{ lang: string }>()
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale)
  const productCode = requestedProductCode
  const selectedPlanId = searchParams.get("planId")
  const returnTo = safeReturnPath(searchParams.get("returnTo"))

  const [state, setState] = useState<ProductEditorState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [modifiedTabs, setModifiedTabs] = useState<Set<string>>(new Set())
  const [invalidTabs, setInvalidTabs] = useState<Set<string>>(new Set())
  const [showPreview, setShowPreview] = useState(false)

  const loadProduct = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (isNew) {
        // Check for unsaved draft recovery in localStorage
        const draftKey = `catalog-draft-${productCode}`
        const savedDraft = localStorage.getItem(draftKey)
        if (savedDraft) {
          setState(JSON.parse(savedDraft) as ProductEditorState)
          return
        }

        const baseOption =
          PRODUCT_OPTIONS.find((p) => p.value === productCode) ??
          PRODUCT_OPTIONS[0]
        setState({
          basics: {
            code: baseOption.value,
            name: baseOption.label,
            description: "",
            currency: "IDR",
            enabledCurrencies: ["IDR"],
            isActive: true,
          },
          plans: [],
          addons: [],
          publishState: "draft",
          preview: false,
        })
      } else {
        // Admin editing must include active plans that have no offers yet.
        const response: CatalogProductDetailResponse =
          await getAdminCatalogProduct(productCode)
        if (!response?.product) {
          setError(messages.pBillingAdminCatalogProductEditor.productNotFound)
          return
        }
        setState(productToEditorState(response.product, response.currency))
        // Clear any stale localStorage draft since server is authoritative
        const draftKey = `catalog-draft-${productCode}`
        localStorage.removeItem(draftKey)
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : messages.pBillingAdminCatalogProductEditor.failedToLoadProduct
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [productCode, isNew, messages])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProduct()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadProduct])

  if (loading) return <LoadingSkeleton />

  if (error) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      </main>
    )
  }

  if (!state) return null

  const activeTab =
    searchParams.get("tab") ?? (selectedPlanId ? "plans" : "basics")

  const tabLabels: Record<(typeof TAB_IDS)[number], string> = {
    basics: messages.pBillingAdminCatalogProductEditor.basics,
    plans: messages.pBillingAdminCatalogProductEditor.plans,
    addons: messages.pBillingAdminCatalogProductEditor.addons,
    details: messages.pBillingAdminCatalogProductEditor.productDetails,
    publish: messages.pBillingAdminCatalogProductEditor.publish,
  }

  const markModified = (tabId: string) => {
    setModifiedTabs((prev) => new Set([...prev, tabId]))
  }

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", value)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const updateBasics = (next: Partial<ProductBasicsForm>) => {
    setState((prev) =>
      prev ? { ...prev, basics: { ...prev.basics, ...next } } : prev
    )
    markModified("basics")
  }

  const updatePlans = (plans: ProductPlanEditorForm[]) => {
    setState((prev) => (prev ? { ...prev, plans } : prev))
    markModified("plans")
  }

  const updateAddons = (addons: PlanAddonAttachmentForm[]) => {
    setState((prev) => (prev ? { ...prev, addons } : prev))
    markModified("addons")
  }

  const updatePublish = (publishState: ProductPublishState) => {
    setState((prev) => (prev ? { ...prev, publishState } : prev))
    markModified("publish")
  }

  const hasUnsavedChanges = modifiedTabs.size > 0
  const publishValidation = validateProductPublish(
    state,
    state.basics.enabledCurrencies
  )
  const planIdentityErrors = validateProductPlanIdentities(state.plans)
  const hasPlanIdentityErrors = Object.keys(planIdentityErrors).length > 0

  const buildPublishPayload = (): PublishCatalogProductInput => {
    const now = new Date().toISOString()
    return {
      code: state.basics.code,
      name: state.basics.name,
      description: state.basics.description || undefined,
      isActive: state.basics.isActive,
      plans: state.plans
        .filter((plan) => plan.isActive)
        .map((plan) => ({
          code: plan.code,
          name: plan.name,
          resources: plan.resources,
          billingStrategy: plan.billingStrategy,
          stockControl: plan.stockControl,
          stockCount: plan.stockCount,
          allowBackorder: plan.allowBackorder,
          isActive: plan.isActive,
          offers: plan.offers
            .filter((offer) => offer.isActive)
            .map((offer) => ({
              regionId: undefined,
              billingPeriod: offer.billingPeriod,
              chargeUnit: offer.chargeUnit,
              periodPrice: Number(offer.periodPrice),
              currency: offer.currency,
              effectiveFrom: offer.effectiveFrom || now,
              effectiveTo: offer.effectiveTo || null,
              isActive: offer.isActive,
            })),
        })),
    }
  }

  const handleSaveDraft = async () => {
    if (hasPlanIdentityErrors) {
      setInvalidTabs((previous) => new Set([...previous, "plans"]))
      return
    }

    setSaving(true)
    try {
      const payload = buildPublishPayload()
      await publishCatalogProduct(productCode, payload)
      toast.success(messages.pBillingAdminCatalogProductEditor.productSaved)
      setModifiedTabs(new Set())
      // Clear any localStorage drafts
      localStorage.removeItem(`catalog-draft-${productCode}`)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : messages.pBillingAdminCatalogProductEditor.failedToSave
      toast.error(message)
      // Fall back to localStorage if server save fails
      const draftKey = `catalog-draft-${productCode}`
      localStorage.setItem(draftKey, JSON.stringify(state))
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!publishValidation.valid) {
      setInvalidTabs(new Set(publishValidation.invalidTabs))
      toast.error(
        messages.pBillingAdminCatalogProductEditor.completeEnabledPrices
      )
      return
    }
    setInvalidTabs(new Set())
    setPublishing(true)
    try {
      const payload = buildPublishPayload()
      await publishCatalogProduct(productCode, payload)
      const nextState: ProductEditorState = {
        ...state,
        publishState: "published",
      }
      setState(nextState)
      toast.success(messages.pBillingAdminCatalogProductEditor.productPublished)
      setModifiedTabs(new Set())
      // Clear localStorage draft
      localStorage.removeItem(`catalog-draft-${productCode}`)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : messages.pBillingAdminCatalogProductEditor.failedToPublish
      toast.error(message)
    } finally {
      setPublishing(false)
    }
  }

  const handlePreviewToggle = (enabled: boolean) => {
    setShowPreview(enabled)
    setState((prev) => (prev ? { ...prev, preview: enabled } : prev))
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={returnTo ?? `/${lang}/portal/billing/catalog`}>
            <Button variant="ghost" size="icon">
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              {state.basics.name || state.basics.code}
            </h1>
            <p className="text-sm text-muted-foreground">
              {messages.pBillingAdminCatalogProductEditor.productCodeLabel}{" "}
              <span className="font-mono">{state.basics.code}</span>
            </p>
            {returnTo && (
              <Link
                className="text-sm text-primary hover:underline"
                href={returnTo}
              >
                {messages.pBillingAdminCatalogProductEditor.backToVpnPackages}
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-xs">
              {messages.pBillingAdminCatalogProductEditor.unsavedChanges}
            </Badge>
          )}
          <Badge
            variant={
              state.publishState === "published"
                ? "default"
                : state.publishState === "archived"
                  ? "secondary"
                  : "outline"
            }
          >
            {state.publishState}
          </Badge>
        </div>
      </header>

      {/* Sticky action bar with tabs and save/publish actions */}
      <div className="sticky top-0 z-10 border-b bg-background/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              {TAB_IDS.map((tabId) => (
                <TabsTrigger key={tabId} value={tabId}>
                  {tabLabels[tabId]}
                  {(modifiedTabs.has(tabId) || invalidTabs.has(tabId)) && (
                    <Badge
                      variant={
                        invalidTabs.has(tabId) ? "destructive" : "secondary"
                      }
                      className="ml-1.5 h-4 min-w-[1.25rem] px-1 text-xs"
                    >
                      !
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePreviewToggle(!showPreview)}
            >
              <EyeIcon className="mr-2 h-4 w-4" />
              {showPreview
                ? messages.pBillingAdminCatalogProductEditor.edit
                : messages.pBillingAdminCatalogProductEditor.preview}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              disabled={saving || hasPlanIdentityErrors}
            >
              {saving
                ? messages.pBillingAdminCatalogProductEditor.saving
                : messages.pBillingAdminCatalogProductEditor.saveDraft}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  disabled={
                    publishing || !hasUnsavedChanges || !publishValidation.valid
                  }
                >
                  {publishing
                    ? messages.pBillingAdminCatalogProductEditor.publishing
                    : messages.pBillingAdminCatalogProductEditor.publish}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {
                      messages.pBillingAdminCatalogProductEditor
                        .publishProductTitle
                    }
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {
                      messages.pBillingAdminCatalogProductEditor
                        .publishProductDescription
                    }
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {messages.pBillingAdminCatalogProductEditor.cancel}
                  </AlertDialogCancel>
                  <AlertDialogAction onClick={handlePublish}>
                    {messages.pBillingAdminCatalogProductEditor.publish}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="hidden">
          {TAB_IDS.map((tabId) => (
            <TabsTrigger key={tabId} value={tabId} />
          ))}
        </TabsList>

        <TabsContent value="basics" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>
                {messages.pBillingAdminCatalogProductEditor.basics}
              </CardTitle>
              <CardDescription>
                {messages.pBillingAdminCatalogProductEditor.basicsDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!state.basics.name && (
                <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  <WarningIcon className="h-4 w-4" />
                  {
                    messages.pBillingAdminCatalogProductEditor
                      .productNameRequired
                  }
                </div>
              )}
              <CatalogBasicsTab basics={state.basics} onChange={updateBasics} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="plans" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>
                {messages.pBillingAdminCatalogProductEditor.plans}
              </CardTitle>
              <CardDescription>
                {messages.pBillingAdminCatalogProductEditor.plansDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CatalogPlansTab
                plans={state.plans}
                currencies={state.basics.enabledCurrencies}
                onChange={updatePlans}
                showPreview={showPreview}
                selectedPlanId={selectedPlanId}
                productCode={state.basics.code}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="addons" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>
                {messages.pBillingAdminCatalogProductEditor.addons}
              </CardTitle>
              <CardDescription>
                {messages.pBillingAdminCatalogProductEditor.addonsDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CatalogAddonsTab
                addons={state.addons}
                plans={state.plans}
                onChange={updateAddons}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>
                {messages.pBillingAdminCatalogProductEditor.productDetails}
              </CardTitle>
              <CardDescription>
                {
                  messages.pBillingAdminCatalogProductEditor
                    .productDetailsDescription
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CatalogProductDetailsTab
                basics={state.basics}
                onChange={updateBasics}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="publish" className="mt-0">
          <CatalogPublishTab
            publishState={state.publishState}
            onChange={updatePublish}
            hasUnsavedChanges={hasUnsavedChanges}
          />
        </TabsContent>
      </Tabs>
    </main>
  )
}
