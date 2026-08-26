"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { eden } from "@/lib/eden"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getMessages } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { formatBillingMoney } from "@/modules/billing/format-money"
import {
  ReceiptIcon,
  LifebuoyIcon,
  SquaresFourIcon,
  MegaphoneSimpleIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  ClockIcon,
  PlusIcon,
  BookOpenIcon,
  ShieldCheckIcon,
} from "@/components/ui/phosphor-icons"

type InvoiceSummary = {
  id: string
  invoiceNumber: string
  status: string
  totalAmountIdr: string
  currency: string
  issuedAt: string | null
  dueAt: string | null
  paymentUrl: string | null
}

type ServiceSummary = {
  id: string
  packageCode: string
  planCode: string
  status: string
  currentPeriodEnd: string | null
  cancelAtPeriodEnd?: boolean
}

type TicketSummary = {
  id: string
  subject: string
  status: string
  priority: string
  updatedAt: string
}

type DashboardState = {
  loading: boolean
  invoice: {
    data: InvoiceSummary | null
    error: boolean
  }
  services: {
    data: ServiceSummary[]
    error: boolean
  }
  tickets: {
    data: TicketSummary[]
    error: boolean
  }
}

const invoiceStatusBadgeVariant = (
  status: string
):
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "destructive"
  | "outline" => {
  switch (status.toUpperCase()) {
    case "PAID":
      return "success"
    case "PENDING":
    case "OPEN":
    case "DRAFT":
      return "warning"
    case "OVERDUE":
    case "UNCOLLECTIBLE":
    case "VOID":
      return "destructive"
    default:
      return "secondary"
  }
}

const serviceStatusBadgeVariant = (
  status: string
):
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "destructive"
  | "outline" => {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "success"
    case "SUSPENDED":
    case "PENDING":
      return "warning"
    case "CANCELLED":
    case "EXPIRED":
      return "destructive"
    default:
      return "secondary"
  }
}

const ticketStatusBadgeVariant = (
  status: string
):
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "destructive"
  | "outline" => {
  switch (status.toLowerCase()) {
    case "resolved":
    case "closed":
      return "secondary"
    case "in_progress":
    case "open":
      return "warning"
    case "waiting_response":
      return "default"
    default:
      return "outline"
  }
}

function formatDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return "-"
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return "-"
    return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
      dateStyle: "medium",
    }).format(d)
  } catch {
    return dateStr
  }
}

export default function ConsolePage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.console.overview

  const [state, setState] = useState<DashboardState>({
    loading: true,
    invoice: { data: null, error: false },
    services: { data: [], error: false },
    tickets: { data: [], error: false },
  })

  const fetchDashboardData = useCallback(async () => {
    type SupportTicketsApi = {
      "support-tickets": {
        get: () => Promise<{
          data?: {
            ok: boolean
            tickets?: Array<{
              id: string
              subject: string
              status: string
              priority: string
              updatedAt?: string
              createdAt?: string
            }>
          }
        }>
      }
    }

    const results = await Promise.allSettled([
      // 0: Latest invoice
      eden.api.billing.invoices
        .get({ $query: { limit: "1" } })
        .then((r) => r.data),
      // 1: Subscriptions / Services
      eden.api.billing.subscriptions.get().then((r) => r.data),
      // 2: Support tickets
      (eden.api as unknown as SupportTicketsApi)["support-tickets"]
        .get()
        .then((r) => r.data),
    ])
    const invoiceResult = results[0]
    const serviceResult = results[1]
    const ticketResult = results[2]

    let latestInvoice: InvoiceSummary | null = null
    let invoiceError = false

    if (invoiceResult.status === "fulfilled" && invoiceResult.value?.ok) {
      const invs = invoiceResult.value.invoices
      if (invs && invs.length > 0) {
        const inv = invs[0]
        latestInvoice = {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          status: inv.status,
          totalAmountIdr: inv.totalAmountIdr,
          currency: inv.currency ?? "IDR",
          issuedAt: inv.issuedAt ?? inv.createdAt ?? null,
          dueAt: inv.dueAt ?? inv.dueDate ?? null,
          paymentUrl: inv.paymentUrl ?? null,
        }
      }
    } else {
      invoiceError = true
    }

    let servicesList: ServiceSummary[] = []
    let servicesError = false

    if (serviceResult.status === "fulfilled" && serviceResult.value?.ok) {
      servicesList = (serviceResult.value.subscriptions || []).map((s) => ({
        id: s.id,
        packageCode: s.packageCode,
        planCode: s.planCode,
        status: s.status,
        currentPeriodEnd: s.currentPeriodEnd,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      }))
    } else {
      servicesError = true
    }

    let ticketsList: TicketSummary[] = []
    let ticketsError = false

    if (ticketResult.status === "fulfilled" && ticketResult.value?.ok) {
      ticketsList = (ticketResult.value.tickets || []).map(
        (t: {
          id: string
          subject: string
          status: string
          priority: string
          updatedAt?: string
          createdAt?: string
        }) => ({
          id: t.id,
          subject: t.subject,
          status: t.status,
          priority: t.priority,
          updatedAt: t.updatedAt ?? t.createdAt ?? new Date().toISOString(),
        })
      )
    } else {
      ticketsError = true
    }

    setState({
      loading: false,
      invoice: { data: latestInvoice, error: invoiceError },
      services: { data: servicesList, error: servicesError },
      tickets: { data: ticketsList, error: ticketsError },
    })
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchDashboardData()
  }, [fetchDashboardData])

  const activeServices = state.services.data.filter(
    (s) => s.status.toUpperCase() === "ACTIVE"
  )
  const openTickets = state.tickets.data.filter(
    (t) =>
      t.status.toLowerCase() !== "closed" &&
      t.status.toLowerCase() !== "resolved"
  )

  const isInvoicePayable =
    state.invoice.data &&
    ["OPEN", "PENDING", "OVERDUE"].includes(
      state.invoice.data.status.toUpperCase()
    )

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{t.heading}</h1>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* SECTION 1: LATEST INVOICE */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ReceiptIcon className="size-5 text-muted-foreground" />
                <CardTitle className="text-base font-medium">
                  {t.invoices.title}
                </CardTitle>
              </div>
              {state.invoice.data && (
                <Badge
                  variant={invoiceStatusBadgeVariant(state.invoice.data.status)}
                >
                  {state.invoice.data.status}
                </Badge>
              )}
            </div>
            <CardDescription>{t.invoices.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {state.loading ? (
              <div className="space-y-3">
                <Skeleton className="h-7 w-36" />
                <Skeleton className="h-4 w-48" />
              </div>
            ) : state.invoice.error ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <WarningCircleIcon className="size-4 text-destructive" />
                <span>{t.invoices.failedToLoad}</span>
              </div>
            ) : state.invoice.data ? (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">
                    #{state.invoice.data.invoiceNumber}
                  </span>
                  <span className="text-xl font-bold">
                    {formatBillingMoney(
                      state.invoice.data.totalAmountIdr,
                      state.invoice.data.currency
                    )}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {state.invoice.data.dueAt
                    ? t.invoices.dueOn.replace(
                        "{date}",
                        formatDate(state.invoice.data.dueAt, locale)
                      )
                    : state.invoice.data.issuedAt
                      ? t.invoices.issuedOn.replace(
                          "{date}",
                          formatDate(state.invoice.data.issuedAt, locale)
                        )
                      : null}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {t.invoices.noInvoiceTitle}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.invoices.noInvoiceDesc}
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex items-center justify-between border-t pt-4">
            {state.invoice.data ? (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link
                    href={localizePathname({
                      pathname: "/console/billing/invoices",
                      locale,
                    })}
                  >
                    {t.invoices.viewAll}
                  </Link>
                </Button>
                {isInvoicePayable ? (
                  <Button size="sm" asChild>
                    <Link
                      href={
                        state.invoice.data.paymentUrl ||
                        localizePathname({
                          pathname: `/console/billing/invoices/${state.invoice.data.id}`,
                          locale,
                        })
                      }
                    >
                      {t.invoices.payNowCta}
                      <ArrowRightIcon className="size-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={localizePathname({
                        pathname: `/console/billing/invoices/${state.invoice.data.id}`,
                        locale,
                      })}
                    >
                      {t.invoices.viewDetailsCta}
                    </Link>
                  </Button>
                )}
              </>
            ) : (
              <Button variant="outline" size="sm" asChild className="w-full">
                <Link
                  href={localizePathname({
                    pathname: "/console/billing/invoices",
                    locale,
                  })}
                >
                  {t.invoices.viewInvoicesCta}
                </Link>
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* SECTION 2: ACTIVE SERVICES */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SquaresFourIcon className="size-5 text-muted-foreground" />
                <CardTitle className="text-base font-medium">
                  {t.services.title}
                </CardTitle>
              </div>
              {!state.loading && !state.services.error && (
                <Badge
                  variant={activeServices.length > 0 ? "success" : "secondary"}
                >
                  {t.services.activeCount.replace(
                    "{count}",
                    String(activeServices.length)
                  )}
                </Badge>
              )}
            </div>
            <CardDescription>{t.services.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {state.loading ? (
              <div className="space-y-3">
                <Skeleton className="h-7 w-36" />
                <Skeleton className="h-4 w-48" />
              </div>
            ) : state.services.error ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <WarningCircleIcon className="size-4 text-destructive" />
                <span>{t.services.failedToLoad}</span>
              </div>
            ) : state.services.data.length > 0 ? (
              <div className="space-y-2">
                {state.services.data.slice(0, 2).map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 p-2.5 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-foreground">
                        {service.packageCode} • {service.planCode}
                      </div>
                      {service.currentPeriodEnd && (
                        <div className="text-muted-foreground">
                          {t.services.renewsOn.replace(
                            "{date}",
                            formatDate(service.currentPeriodEnd, locale)
                          )}
                        </div>
                      )}
                    </div>
                    <Badge variant={serviceStatusBadgeVariant(service.status)}>
                      {service.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {t.services.noServicesTitle}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.services.noServicesDesc}
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex items-center justify-between border-t pt-4">
            <Button variant="outline" size="sm" asChild className="w-full">
              <Link
                href={localizePathname({
                  pathname:
                    state.services.data.length > 0
                      ? "/console/billing/subscriptions"
                      : "/console/billing/services/whatsapp",
                  locale,
                })}
              >
                {state.services.data.length > 0
                  ? t.services.manageAll
                  : t.services.browseServicesCta}
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        {/* SECTION 3: SUPPORT TICKETS */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LifebuoyIcon className="size-5 text-muted-foreground" />
                <CardTitle className="text-base font-medium">
                  {t.support.title}
                </CardTitle>
              </div>
              {!state.loading && !state.tickets.error && (
                <Badge
                  variant={openTickets.length > 0 ? "warning" : "secondary"}
                >
                  {t.support.openCount.replace(
                    "{count}",
                    String(openTickets.length)
                  )}
                </Badge>
              )}
            </div>
            <CardDescription>{t.support.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {state.loading ? (
              <div className="space-y-3">
                <Skeleton className="h-7 w-36" />
                <Skeleton className="h-4 w-48" />
              </div>
            ) : state.tickets.error ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <WarningCircleIcon className="size-4 text-destructive" />
                <span>{t.support.failedToLoad}</span>
              </div>
            ) : state.tickets.data.length > 0 ? (
              <div className="space-y-2">
                {state.tickets.data.slice(0, 2).map((ticket) => (
                  <Link
                    key={ticket.id}
                    href={localizePathname({
                      pathname: `/console/support-tickets/${ticket.id}`,
                      locale,
                    })}
                    className="flex items-center justify-between rounded-lg border border-border/60 p-2.5 text-xs transition-colors hover:bg-muted/50"
                  >
                    <div className="space-y-0.5 pr-2">
                      <div className="line-clamp-1 font-semibold text-foreground">
                        {ticket.subject}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <ClockIcon className="size-3" />
                        <span>
                          {t.support.lastUpdated.replace(
                            "{date}",
                            formatDate(ticket.updatedAt, locale)
                          )}
                        </span>
                      </div>
                    </div>
                    <Badge variant={ticketStatusBadgeVariant(ticket.status)}>
                      {ticket.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {t.support.noTicketsTitle}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.support.noTicketsDesc}
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex items-center justify-between border-t pt-4">
            <Button variant="ghost" size="sm" asChild>
              <Link
                href={localizePathname({
                  pathname: "/console/support-tickets",
                  locale,
                })}
              >
                {t.support.viewAll}
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link
                href={localizePathname({
                  pathname: "/console/support-tickets/new",
                  locale,
                })}
              >
                <PlusIcon className="size-4" />
                {t.support.createTicketCta}
              </Link>
            </Button>
          </CardFooter>
        </Card>

        {/* SECTION 4: ANNOUNCEMENTS & SYSTEM UPDATES */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MegaphoneSimpleIcon className="size-5 text-muted-foreground" />
                <CardTitle className="text-base font-medium">
                  {t.announcements.title}
                </CardTitle>
              </div>
              <Badge variant="success" className="gap-1">
                <CheckCircleIcon className="size-3" />
                <span>Operational</span>
              </Badge>
            </div>
            <CardDescription>{t.announcements.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-2 rounded-lg border border-border/60 bg-card p-3">
              <div className="flex items-start gap-2.5">
                <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-foreground">
                    {t.announcements.platformStatusTitle}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.announcements.platformStatusDesc}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-xs font-semibold text-foreground">
                {t.announcements.noAnnouncementsTitle}
              </p>
              <p className="text-xs text-muted-foreground">
                {t.announcements.noAnnouncementsDesc}
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex items-center justify-between border-t pt-4">
            <Button variant="outline" size="sm" asChild className="w-full">
              <Link
                href={localizePathname({
                  pathname: "/console/docs",
                  locale,
                })}
              >
                <BookOpenIcon className="size-4" />
                {t.announcements.viewDocsCta}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}
