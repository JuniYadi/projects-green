"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { AppMessages } from "@/lib/i18n/messages/types"
import {
  useSubscriptionsQuery,
  useInvoiceQuery,
  cancelBillingSubscription,
} from "@/hooks/use-billing-data"
import { formatKey } from "@/lib/format-key"
import type { SubscriptionItem } from "@/lib/billing-client"
import { ArrowLeftIcon } from "@phosphor-icons/react"
import Link from "next/link"

function formatDate(
  dateStr: string | null,
  fallback: string,
  locale = "en"
): string {
  if (!dateStr) return fallback
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateStr))
}

function formatCurrency(
  amount: string,
  currency = "IDR",
  locale = "en"
): string {
  return new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(Number.parseFloat(amount))
}
function getStatusLabel(
  status: string,
  t: AppMessages["console"]["billing"]["subscriptions"]
): string {
  const map: Record<string, string> = {
    ACTIVE: t.statusFilterActive,
    SUSPENDED: t.statusFilterSuspended,
    CANCELLED: t.statusFilterCancelled,
    PENDING: t.statusFilterPending,
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

function getTermLabel(
  billingPeriod: string | null | undefined,
  t: AppMessages["console"]["billing"]["subscriptions"]
): string {
  const map: Record<string, string> = {
    MONTHLY: t.termMonthly,
    QUARTERLY: t.termQuarterly,
    SEMI_ANNUAL: t.termSemiAnnual,
    ANNUAL: t.termAnnual,
  }
  return map[billingPeriod ?? ""] ?? billingPeriod ?? t.notAvailable
}

type DialogState = { type: "none" } | { type: "cancel" }

export default function SubscriptionDetailPage() {
  const params = useParams<{ id: string; lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const subscriptionId = params.id as string
  const d = messages.console.billing.subscriptions.detail

  const queryClient = useQueryClient()
  const subscriptionsQuery = useSubscriptionsQuery()
  const subscriptions = subscriptionsQuery.data
  const sub = subscriptions?.subscriptions.find(
    (subscription) => subscription.id === subscriptionId
  ) as SubscriptionItem | undefined
  const invoiceQuery = useInvoiceQuery(sub?.billingInvoiceId ?? undefined)
  const invoice = invoiceQuery.data
  const isLoading = subscriptionsQuery.isLoading || invoiceQuery.isLoading
  const error =
    subscriptionsQuery.error instanceof Error
      ? subscriptionsQuery.error.message
      : subscriptionsQuery.error
        ? messages.console.billing.subscriptions.errorDescription
        : null

  // Lifecycle action state
  const [dialog, setDialog] = useState<DialogState>({ type: "none" })
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState("")

  async function refreshSubscriptions() {
    await queryClient.invalidateQueries({
      queryKey: ["billing", "subscriptions"],
    })
  }

  async function handleCancel() {
    setActionLoading(true)
    setActionError(null)
    try {
      await cancelBillingSubscription(subscriptionId, cancelReason || undefined)
      setDialog({ type: "none" })
      setCancelReason("")
      await refreshSubscriptions()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : d.manage.cancel.cancelError
      )
    } finally {
      setActionLoading(false)
    }
  }

  if (isLoading) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
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
              {d.notFoundDescription}
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  const invoiceData = invoice?.invoice
  const isPendingCancellation = sub.cancelAtPeriodEnd === true
  const canCancel = sub.status === "ACTIVE" && !isPendingCancellation
  // Extract custom parameters & form responses
  const config = (sub.allocatedConfig ?? {}) as Record<string, unknown>
  const checkoutQuote = config.checkoutQuote as
    | Record<string, unknown>
    | undefined
  const formEntries = Object.entries(config).filter(
    ([key, val]) =>
      key !== "_provisioningFields" &&
      key !== "checkoutQuote" &&
      key !== "addons" &&
      key !== "device" &&
      key !== "deviceIds" &&
      key !== "allowanceByDevice" &&
      key !== "invoiceLineId" &&
      key !== "planId" &&
      key !== "userId" &&
      key !== "workosUserId" &&
      key !== "voucher" &&
      val !== null &&
      val !== undefined &&
      typeof val !== "object"
  )

  // Product-specific quick links
  let serviceDashboardUrl: string | null = null
  let serviceLabel = d.openService
  if (sub.packageCode === "WHATSAPP") {
    serviceDashboardUrl = `/${locale}/console/whatsapp/dashboard`
    serviceLabel = d.whatsappConsole
  } else if (sub.packageCode === "VPN") {
    serviceDashboardUrl = localizePathname({
      pathname: "/console/vpn/profiles",
      locale,
    })
    serviceLabel = locale === "id" ? "Buka Profil VPN" : "Open VPN Profiles"
  } else if (sub.packageCode === "APP_HOSTING") {
    serviceDashboardUrl = `/${locale}/console/app`
    serviceLabel = d.applications
  }

  // Extract key form values like phone number, business name, display name
  const rawPhone = (config.phoneNumber ??
    config.companyPhoneNumber ??
    "") as string
  const rawDisplayName = (config.displayName ??
    config.businessName ??
    "") as string

  // Extract core user data
  const orderDate = sub.currentPeriodStart
    ? formatDate(sub.currentPeriodStart, d.notFound, locale)
    : "-"
  const renewalDate = formatDate(sub.currentPeriodEnd, "-", locale)
  const firstSubtotal = checkoutQuote?.subtotal
    ? formatCurrency(
        String(checkoutQuote.subtotal),
        sub.currency ?? "IDR",
        locale
      )
    : sub.periodPrice
      ? formatCurrency(sub.periodPrice, sub.currency ?? "IDR", locale)
      : "-"
  const nextRecurringPrice = formatCurrency(
    sub.periodPrice ?? sub.monthlyRateIdr ?? "0",
    sub.currency ?? "IDR",
    locale
  )
  const billingCycle = getTermLabel(
    sub.billingPeriod,
    messages.console.billing.subscriptions
  )
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      {/* Header with Title and Actions */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-3" asChild>
            <Link href={`/${locale}/console/billing/subscriptions`}>
              <ArrowLeftIcon className="mr-2 size-4" />
              {d.backToSubscriptions}
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {sub.packageCode === "WHATSAPP"
                ? "WhatsApp Business"
                : sub.packageCode}
            </h1>
            <Badge className={getStatusVariant(sub.status)}>
              {getStatusLabel(
                sub.status,
                messages.console.billing.subscriptions
              )}
            </Badge>
            <Badge variant="outline">
              {sub.planCode} {d.overview.plan}
            </Badge>
          </div>
          {rawPhone && (
            <p className="text-sm font-medium text-primary">
              {rawPhone} {rawDisplayName ? `(${rawDisplayName})` : ""}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {serviceDashboardUrl && (
            <Button asChild size="sm">
              <Link href={serviceDashboardUrl}>{serviceLabel}</Link>
            </Button>
          )}
          {invoiceData?.id && (
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/${locale}/console/billing/invoices/${invoiceData.id}`}
              >
                {d.invoiceLink}
              </Link>
            </Button>
          )}
        </div>
      </header>

      {/* Section 1: Rincian Langganan & Perpanjangan */}
      <Card>
        <div className="border-b px-5 py-3">
          <h2 className="text-sm font-semibold">{d.overviewSection}</h2>
        </div>
        <CardContent className="p-5">
          <dl className="divide-y divide-border/60 text-sm">
            <div className="grid grid-cols-1 py-2 sm:grid-cols-3">
              <dt className="text-muted-foreground">{d.firstOrderDate}</dt>
              <dd className="font-medium text-foreground sm:col-span-2">
                {orderDate}
              </dd>
            </div>
            <div className="grid grid-cols-1 py-2 sm:grid-cols-3">
              <dt className="text-muted-foreground">{d.firstOrderCost}</dt>
              <dd className="font-medium text-foreground sm:col-span-2">
                {firstSubtotal}{" "}
                <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                  ({sub.invoiceStatus ?? "PAID"})
                </span>
              </dd>
            </div>
            <div className="grid grid-cols-1 py-2 sm:grid-cols-3">
              <dt className="text-muted-foreground">{d.nextRenewalDate}</dt>
              <dd className="font-semibold text-primary sm:col-span-2">
                {renewalDate}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {d.autoDebitNote}
                </span>
              </dd>
            </div>
            <div className="grid grid-cols-1 py-2 sm:grid-cols-3">
              <dt className="text-muted-foreground">{d.renewalCost}</dt>
              <dd className="font-bold text-foreground sm:col-span-2">
                {nextRecurringPrice} / {billingCycle.toLowerCase()}
              </dd>
            </div>
            <div className="grid grid-cols-1 py-2 sm:grid-cols-3">
              <dt className="text-muted-foreground">{d.planAndCycle}</dt>
              <dd className="font-medium text-foreground sm:col-span-2">
                {sub.planCode} · {billingCycle}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Section 2: Data Formulir Pendaftaran Saat Order */}
      <Card>
        <div className="border-b px-5 py-3">
          <h2 className="text-sm font-semibold">{d.signupFormData}</h2>
        </div>
        <CardContent className="p-5">
          {formEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {d.noAdditionalFormData}
            </p>
          ) : (
            <dl className="divide-y divide-border/60 text-sm">
              {formEntries.map(([key, val]) => (
                <div key={key} className="grid grid-cols-1 py-2 sm:grid-cols-3">
                  <dt className="text-muted-foreground">{formatKey(key)}</dt>
                  <dd className="font-mono text-xs font-medium break-all text-foreground sm:col-span-2">
                    {String(val).startsWith("http") ? (
                      <a
                        href={String(val)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline hover:text-primary/80"
                      >
                        {d.viewLinksDocuments}
                      </a>
                    ) : (
                      String(val)
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Pembatalan Langganan */}
      {canCancel && (
        <div className="flex items-center justify-between rounded-xl border border-border/80 bg-card p-4">
          <div>
            <h3 className="text-sm font-medium text-foreground">
              {d.cancelAutoRenewalTitle}
            </h3>
            <p className="text-xs text-muted-foreground">
              {d.cancelAutoRenewalDescription}
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDialog({ type: "cancel" })}
          >
            {d.cancelAutoRenewalButton}
          </Button>
        </div>
      )}

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
    </main>
  )
}
