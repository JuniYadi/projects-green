"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  getSubscriptions,
  getInvoice,
  getCatalogProduct,
  cancelSubscription,
  reinstateSubscription,
  previewChangePlan,
  changePlan,
} from "@/lib/billing-client"
import type {
  BillingSubscriptions,
  InvoiceDetail,
  ChangePlanPreviewResult,
  SubscriptionItem,
  CatalogProduct,
} from "@/lib/billing-client"
import { ArrowLeftIcon } from "@phosphor-icons/react"
import Link from "next/link"

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A"
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateStr))
}

function formatCurrency(amount: string, currency = "IDR"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(Number.parseFloat(amount))
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "Active",
    SUSPENDED: "Suspended",
    CANCELLED: "Cancelled",
    PENDING: "Pending",
  }
  return map[status.toUpperCase()] ?? status
}

function getStatusVariant(status: string): string {
  const styles: Record<string, string> = {
    ACTIVE:
      "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400",
    SUSPENDED:
      "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    CANCELLED:
      "border-gray-500/20 bg-gray-500/10 text-gray-600 dark:text-gray-400",
    PENDING:
      "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  }
  return styles[status.toUpperCase()] ?? styles.CANCELLED
}

function getTermLabel(billingPeriod: string | null | undefined): string {
  if (billingPeriod === "MONTHLY") return "Monthly"
  if (billingPeriod === "QUARTERLY") return "Quarterly"
  if (billingPeriod === "SEMI_ANNUAL") return "Semi-annual"
  if (billingPeriod === "ANNUAL") return "Annual"
  return billingPeriod ?? "N/A"
}

type DialogState =
  | { type: "none" }
  | { type: "cancel" }
  | { type: "reinstate" }
  | {
      type: "change-plan"
      preview: ChangePlanPreviewResult | null
      loading: boolean
      previewError: string | null
      pricingId: string
    }

export default function SubscriptionDetailPage() {
  const params = useParams<{ id: string; lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const subscriptionId = params.id as string

  const [subscriptions, setSubscriptions] =
    useState<BillingSubscriptions | null>(null)
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [catalogProduct, setCatalogProduct] = useState<CatalogProduct | null>(
    null
  )
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Lifecycle action state
  const [dialog, setDialog] = useState<DialogState>({ type: "none" })
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [reinstateReason, setReinstateReason] = useState("")

  const d = messages.console.billing.subscriptions.detail

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const subsResult = await getSubscriptions()
        const current = subsResult.subscriptions.find(
          (subscription) => subscription.id === subscriptionId
        )
        const [invResult, catalogResult] = await Promise.all([
          getInvoice(subscriptionId),
          current
            ? getCatalogProduct(
                current.packageCode,
                current.currency ?? undefined
              )
                .then((result) => result.product)
                .catch(() => null)
            : Promise.resolve(null),
        ])
        if (!cancelled) {
          setSubscriptions(subsResult)
          setInvoice(invResult)
          setCatalogProduct(catalogResult)
        }
      } catch {
        if (!cancelled) {
          setError(messages.console.billing.subscriptions.errorDescription)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadData()
    return () => {
      cancelled = true
    }
  }, [subscriptionId, messages.console.billing.subscriptions.errorDescription])

  const sub = subscriptions?.subscriptions.find(
    (s) => s.id === subscriptionId
  ) as SubscriptionItem | undefined

  async function refreshSubscriptions() {
    try {
      const result = await getSubscriptions()
      setSubscriptions(result)
    } catch {
      // non-fatal — UI will show stale status briefly
    }
  }

  async function handleCancel() {
    setActionLoading(true)
    setActionError(null)
    try {
      await cancelSubscription(subscriptionId, {
        reason: cancelReason || undefined,
      })
      setDialog({ type: "none" })
      setCancelReason("")
      await refreshSubscriptions()
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Something went wrong while cancelling the subscription."
      )
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReinstate() {
    setActionLoading(true)
    setActionError(null)
    try {
      await reinstateSubscription(subscriptionId, {
        reason: reinstateReason || undefined,
      })
      setDialog({ type: "none" })
      setReinstateReason("")
      await refreshSubscriptions()
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Something went wrong while reinstating the subscription."
      )
    } finally {
      setActionLoading(false)
    }
  }

  async function handlePreviewPlan(pricingId: string) {
    setDialog({
      type: "change-plan",
      preview: null,
      loading: true,
      previewError: null,
      pricingId,
    })
    try {
      const preview = await previewChangePlan(subscriptionId, pricingId)
      setDialog((prev) =>
        prev.type === "change-plan"
          ? { ...prev, preview, loading: false }
          : prev
      )
    } catch (err) {
      setDialog((prev) =>
        prev.type === "change-plan"
          ? {
              ...prev,
              loading: false,
              previewError:
                err instanceof Error
                  ? err.message
                  : "Could not preview this plan change.",
            }
          : { type: "none" }
      )
    }
  }

  async function handleChangePlan() {
    if (dialog.type !== "change-plan") return
    setActionLoading(true)
    setActionError(null)
    try {
      await changePlan(subscriptionId, dialog.pricingId)
      setDialog({ type: "none" })
      await refreshSubscriptions()
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Something went wrong while changing the plan."
      )
    } finally {
      setActionLoading(false)
    }
  }

  if (isLoading) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <header className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </main>
    )
  }

  if (!sub) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium text-foreground">
              {messages.console.billing.invoiceNotFound}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              The subscription you are looking for does not exist.
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  const invoiceData = invoice?.invoice
  const changeOffers =
    catalogProduct?.plans.flatMap((plan) =>
      plan.offers.map((offer) => ({
        ...offer,
        planCode: plan.code,
        planName: plan.name,
      }))
    ) ?? []
  const isCancelled = sub.status === "CANCELLED"
  const isPendingCancellation = sub.cancelAtPeriodEnd === true
  const canCancel = sub.status === "ACTIVE" && !isPendingCancellation
  const canReinstate = isPendingCancellation && sub.status !== "CANCELLED"
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/console/billing/subscriptions">
              <ArrowLeftIcon className="mr-2 size-4" />
              {d.backTo}
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">{d.heading}</h1>
          <p className="text-sm text-muted-foreground">
            {sub.packageCode} / {sub.planCode}
          </p>
        </div>
      </header>

      <Tabs defaultValue="overview">
        <TabsList aria-label={d.heading}>
          <TabsTrigger value="overview">{d.tabs.overview}</TabsTrigger>
          <TabsTrigger value="billing">{d.tabs.billing}</TabsTrigger>
          <TabsTrigger value="manage">{d.tabs.manage}</TabsTrigger>
          <TabsTrigger value="addons">{d.tabs.addons}</TabsTrigger>
          <TabsTrigger value="activity">{d.tabs.activity}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                {sub.packageCode}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {d.overview.status}
                  </p>
                  <Badge className={getStatusVariant(sub.status)}>
                    {getStatusLabel(sub.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {d.overview.serviceStatus}
                  </p>
                  <Badge className={getStatusVariant(sub.status)}>
                    {getStatusLabel(sub.status)}
                  </Badge>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {d.overview.product}
                  </p>
                  <p className="font-medium">{sub.packageCode}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {d.overview.plan}
                  </p>
                  <p className="font-medium">{sub.planCode}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {d.overview.term}
                  </p>
                  <p className="font-medium">
                    {getTermLabel(sub.billingPeriod)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {d.overview.renewal}
                  </p>
                  <p className="font-medium">
                    {formatDate(sub.currentPeriodEnd)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {d.overview.invoiceState}
                  </p>
                  <p className="font-medium">{sub.invoiceStatus ?? "N/A"}</p>
                </div>
                {isPendingCancellation && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {d.overview.cancelPending}
                    </p>
                    <p className="font-medium text-yellow-600 dark:text-yellow-400">
                      {d.overview.cancelPendingLabel}
                    </p>
                  </div>
                )}
              </div>
              {sub.periodPrice && (
                <div>
                  <p className="text-xs text-muted-foreground">
                    {d.billing.amount}
                  </p>
                  <p className="font-medium">
                    {formatCurrency(sub.periodPrice, sub.currency ?? "IDR")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                {invoiceData?.invoiceNumber ?? d.billing.invoiceNumber}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {invoiceData ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {d.billing.status}
                      </p>
                      <Badge className={getStatusVariant(invoiceData.status)}>
                        {getStatusLabel(invoiceData.status)}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {d.billing.period}
                      </p>
                      <p className="font-medium">
                        {formatDate(invoiceData.periodStart)} –{" "}
                        {formatDate(invoiceData.periodEnd)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {d.billing.amount}
                      </p>
                      <p className="font-medium">
                        {formatCurrency(
                          invoiceData.totalAmountIdr,
                          invoiceData.currency
                        )}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {d.addons.message}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                {d.manage.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Plan / Term Change */}
              <div>
                <h3 className="mb-1 text-sm font-medium">
                  {d.manage.changePlan.title}
                </h3>
                <p className="mb-3 text-sm text-muted-foreground">
                  {d.manage.changePlan.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {changeOffers.length > 0 ? (
                    changeOffers.map((offer) => (
                      <Button
                        key={offer.id}
                        variant="outline"
                        size="sm"
                        disabled={
                          offer.id === sub.pricingId ||
                          sub.status === "CANCELLED" ||
                          isPendingCancellation
                        }
                        onClick={() => void handlePreviewPlan(offer.id)}
                      >
                        {offer.planName} · {getTermLabel(offer.billingPeriod)}
                      </Button>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No other published plans are available.
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t pt-4">
                {canCancel && (
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="mb-1 text-sm font-medium">
                        {d.manage.cancel.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {d.manage.cancel.description}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDialog({ type: "cancel" })}
                    >
                      {d.manage.cancel.button}
                    </Button>
                  </div>
                )}
                {canReinstate && (
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="mb-1 text-sm font-medium">
                        {d.manage.reinstate.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {d.manage.reinstate.description}
                      </p>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setDialog({ type: "reinstate" })}
                    >
                      {d.manage.reinstate.button}
                    </Button>
                  </div>
                )}
                {isCancelled && (
                  <p className="text-sm text-muted-foreground">
                    {d.manage.cancelledNote}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="addons" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                {d.addons.unavailable}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {d.addons.message}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {d.activity.noActivity}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Cancel Dialog */}
      <AlertDialog
        open={dialog.type === "cancel"}
        onOpenChange={(open) =>
          open ? setDialog({ type: "cancel" }) : setDialog({ type: "none" })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{d.manage.cancel.dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {d.manage.cancel.dialogDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder={d.manage.cancel.reasonPlaceholder}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="mt-3"
          />
          {actionError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {actionError}
            </p>
          )}
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel disabled={actionLoading}>
              {d.manage.cancel.cancelBtn}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleCancel()
              }}
              disabled={actionLoading}
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
            >
              {actionLoading
                ? d.manage.cancel.confirming
                : d.manage.cancel.confirmBtn}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reinstate Dialog */}
      <AlertDialog
        open={dialog.type === "reinstate"}
        onOpenChange={(open) =>
          open ? setDialog({ type: "reinstate" }) : setDialog({ type: "none" })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {d.manage.reinstate.dialogTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {d.manage.reinstate.dialogDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder={d.manage.reinstate.reasonPlaceholder}
            value={reinstateReason}
            onChange={(e) => setReinstateReason(e.target.value)}
            className="mt-3"
          />
          {actionError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {actionError}
            </p>
          )}
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel disabled={actionLoading}>
              {d.manage.reinstate.cancelBtn}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleReinstate()
              }}
              disabled={actionLoading}
            >
              {actionLoading
                ? d.manage.reinstate.confirming
                : d.manage.reinstate.confirmBtn}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Plan Dialog */}
      <AlertDialog
        open={dialog.type === "change-plan"}
        onOpenChange={(open) =>
          open ? setDialog(dialog) : setDialog({ type: "none" })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {d.manage.changePlan.dialogTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {d.manage.changePlan.dialogDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {dialog.type === "change-plan" && (
            <div className="mt-3 space-y-2">
              {dialog.loading && (
                <p className="text-sm text-muted-foreground">
                  {d.manage.changePlan.loadingPreview}
                </p>
              )}
              {dialog.previewError && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {dialog.previewError}
                </p>
              )}
              {dialog.preview && (
                <div className="space-y-1 rounded-md border bg-muted/50 p-3 text-sm">
                  <p>
                    <span className="font-medium">New plan:</span>{" "}
                    {dialog.preview.newPlanCode}
                  </p>
                  <p>
                    <span className="font-medium">Billing period:</span>{" "}
                    {getTermLabel(dialog.preview.newBillingPeriod)}
                  </p>
                  <p>
                    <span className="font-medium">Price:</span>{" "}
                    {formatCurrency(
                      dialog.preview.newPeriodPrice,
                      dialog.preview.newCurrency
                    )}
                  </p>
                  <p>
                    <span className="font-medium">Effective:</span>{" "}
                    {formatDate(dialog.preview.effectiveDate)}
                  </p>
                </div>
              )}
              {actionError && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {actionError}
                </p>
              )}
            </div>
          )}

          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel
              disabled={
                actionLoading ||
                (dialog.type === "change-plan" && dialog.loading)
              }
            >
              {d.manage.changePlan.cancelBtn}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleChangePlan()
              }}
              disabled={
                actionLoading ||
                (dialog.type === "change-plan" && dialog.loading) ||
                (dialog.type === "change-plan" && !dialog.preview)
              }
            >
              {actionLoading
                ? d.manage.changePlan.confirming
                : d.manage.changePlan.confirmBtn}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
