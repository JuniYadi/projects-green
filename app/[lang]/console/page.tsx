"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { eden } from "@/lib/eden"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getMessages } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  WalletIcon,
  CurrencyCircleDollarIcon,
  ReceiptIcon,
  LifebuoyIcon,
} from "@phosphor-icons/react"

type DashboardCard = {
  title: string
  icon: React.ReactNode
  value: string | null
  subtitle: string | null
  loading: boolean
  error: boolean
  href: string | null
}

const createInitialState = (): DashboardCard[] => [
  {
    title: "Current Balance",
    icon: <WalletIcon />,
    value: null,
    subtitle: null,
    loading: true,
    error: false,
    href: null,
  },
  {
    title: "Spent This Month",
    icon: <CurrencyCircleDollarIcon />,
    value: null,
    subtitle: null,
    loading: true,
    error: false,
    href: null,
  },
  {
    title: "Last Invoice",
    icon: <ReceiptIcon />,
    value: null,
    subtitle: null,
    loading: true,
    error: false,
    href: null,
  },
  {
    title: "Open Tickets",
    icon: <LifebuoyIcon />,
    value: null,
    subtitle: null,
    loading: true,
    error: false,
    href: null,
  },
]

export default function ConsolePage() {
  const [cards, setCards] = useState<DashboardCard[]>(createInitialState())
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)

  const fetchDashboardData = useCallback(async () => {
    const results = await Promise.allSettled([
      eden.api.billing.account.get().then((r) => r.data),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (eden.api as any).usage.get().then((r: any) => r.data),
      eden.api.billing.invoices
        .get({ $query: { limit: "1" } })
        .then((r) => r.data!),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (eden.api as any).support.tickets
        .get({ $query: { status: "open" } })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((r: any) => r.data),
    ])

    setCards([
      {
        title: messages.console.overview.currentBalance,
        icon: <WalletIcon />,
        value:
          results[0].status === "fulfilled" && results[0].value?.ok
            ? results[0].value.formattedBalance
            : null,
        subtitle:
          results[0].status === "fulfilled" && results[0].value?.ok
            ? `Account age: ${results[0].value.accountAge}`
            : null,
        loading: false,
        error: results[0].status !== "fulfilled" || !results[0].value?.ok,
        href: null,
      },
      {
        title: messages.console.overview.spentThisMonth,
        icon: <CurrencyCircleDollarIcon />,
        value:
          results[1].status === "fulfilled" && results[1].value?.success
            ? `IDR ${Number(results[1].value.data.totalSpend).toLocaleString("id-ID")}`
            : null,
        subtitle:
          results[1].status === "fulfilled" && results[1].value?.success
            ? `Period: ${results[1].value.data.period}`
            : null,
        loading: false,
        error: results[1].status !== "fulfilled" || !results[1].value?.success,
        href: null,
      },
      {
        title: messages.console.overview.lastInvoice,
        icon: <ReceiptIcon />,
        value:
          results[2].status === "fulfilled" &&
          results[2].value?.ok &&
          results[2].value.invoices?.length > 0
            ? `IDR ${results[2].value.invoices[0].totalAmountIdr}`
            : results[2].status === "fulfilled" && results[2].value?.ok
              ? messages.console.overview.noInvoicesYet
              : null,
        subtitle:
          results[2].status === "fulfilled" &&
          results[2].value?.ok &&
          results[2].value.invoices?.length > 0
            ? `Status: ${results[2].value.invoices[0].status}`
            : null,
        loading: false,
        error: results[2].status !== "fulfilled" || !results[2].value?.ok,
        href:
          results[2].status === "fulfilled" &&
          results[2].value?.ok &&
          results[2].value.invoices?.length > 0 &&
          results[2].value.invoices[0].id
            ? localizePathname({
                pathname: `/console/billing/invoices/${results[2].value.invoices[0].id}`,
                locale,
              })
            : localizePathname({
                pathname: "/console/billing/invoices",
                locale,
              }),
      },
      {
        title: messages.console.overview.openTickets,
        icon: <LifebuoyIcon />,
        value:
          results[3].status === "fulfilled" && results[3].value?.ok
            ? String(results[3].value.tickets?.length ?? 0)
            : null,
        subtitle:
          results[3].status === "fulfilled" && results[3].value?.ok
            ? messages.console.overview.awaitingResponse
            : null,
        loading: false,
        error: results[3].status !== "fulfilled" || !results[3].value?.ok,
        href: localizePathname({
          pathname: "/console/support-tickets?status=open",
          locale,
        }),
      },
    ])
  }, [locale])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchDashboardData()
  }, [fetchDashboardData])

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">
          {messages.console.overview.heading}
        </h1>
        <p className="text-sm text-muted-foreground">
          {messages.console.overview.description}
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const cardInner = (
            <Card
              className={
                !card.loading && !card.error && card.href
                  ? "h-full transition-colors hover:border-primary/50 hover:bg-accent/40"
                  : "h-full"
              }
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                {card.icon}
              </CardHeader>
              <CardContent>
                {card.loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-7 w-28" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ) : card.error ? (
                  <p className="text-sm text-muted-foreground">
                    {messages.console.overview.unavailable}
                  </p>
                ) : (
                  <>
                    <p className="text-2xl font-bold">{card.value}</p>
                    {card.subtitle && (
                      <p className="text-xs text-muted-foreground">
                        {card.subtitle}
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )

          if (!card.loading && !card.error && card.href) {
            return (
              <Link
                key={card.title}
                href={card.href}
                aria-label={card.title}
                className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {cardInner}
              </Link>
            )
          }

          return <div key={card.title}>{cardInner}</div>
        })}
      </section>
    </main>
  )
}
