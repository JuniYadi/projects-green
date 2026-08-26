import Link from "next/link"
import { useParams } from "next/navigation"
import { GlobeIcon, RocketLaunchIcon } from "@/components/ui/phosphor-icons"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
type SubscriptionItem = {
  id: string
  packageCode: string
  planCode: string
  regionCode: string
  billingMode: string
  type: string
  status: string
  allocatedConfig: Record<string, unknown> | null
  monthlyRateIdr?: string
  periodPrice?: string | null
  billingPeriod?: string | null
  currentPeriodEnd: string | null
  quotaIn?: number | null
  quotaOut?: number | null
  dailyPerDevice?: number | null
}

type SubscriptionCardProps = {
  subscription: SubscriptionItem
  className?: string
}

type PackageInfo = {
  label: string
  icon: React.ReactNode
  description: string
}

const packageIcons: Record<string, React.ReactNode> = {
  WHATSAPP: <GlobeIcon className="h-5 w-5" />,
  VPN: <GlobeIcon className="h-5 w-5" />,
  APP_HOSTING: <RocketLaunchIcon className="h-5 w-5" />,
}

const statusStyles: Record<string, string> = {
  ACTIVE:
    "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400",
  SUSPENDED:
    "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  CANCELLED:
    "border-gray-500/20 bg-gray-500/10 text-gray-600 dark:text-gray-400",
}

function formatCurrency(amount: string, currency = "IDR"): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(Number.parseFloat(amount))
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A"

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(dateStr))
}

export function SubscriptionCard({
  subscription,
  className,
}: SubscriptionCardProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const t = getMessages(locale).console.billing.subscriptions
  const packageInfo: PackageInfo =
    subscription.packageCode === "WHATSAPP"
      ? {
          label: t.packageWhatsApp,
          icon: packageIcons.WHATSAPP,
          description: t.packageWhatsAppDescription,
        }
      : subscription.packageCode === "VPN"
        ? {
            label: t.packageVpn,
            icon: packageIcons.VPN,
            description: t.packageVpnDescription,
          }
        : subscription.packageCode === "APP_HOSTING"
          ? {
              label: t.packageAppHosting,
              icon: packageIcons.APP_HOSTING,
              description: t.packageAppHostingDescription,
            }
          : {
              label: subscription.packageCode,
              icon: <RocketLaunchIcon className="h-5 w-5" />,
              description: subscription.packageCode,
            }

  const statusStyle =
    statusStyles[subscription.status] ?? statusStyles.CANCELLED
  const statusLabels: Record<string, string> = {
    ACTIVE: t.statusFilterActive,
    SUSPENDED: t.statusFilterSuspended,
    CANCELLED: t.statusFilterCancelled,
    PENDING: t.statusFilterPending,
  }
  const statusLabel =
    statusLabels[subscription.status.toUpperCase()] ?? subscription.status
  const termLabels: Record<string, string> = {
    MONTHLY: t.termMonthly,
    QUARTERLY: t.termQuarterly,
    SEMI_ANNUAL: t.termSemiAnnual,
    ANNUAL: t.termAnnual,
  }
  const termLabel =
    termLabels[subscription.billingPeriod ?? ""] ??
    subscription.billingPeriod ??
    t.notAvailable
  return (
    <Card
      className={cn("transition-colors hover:border-primary/50", className)}
    >
      <Link
        href={`/${locale}/console/billing/subscriptions/${subscription.id}`}
        className="block focus-visible:outline-hidden"
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            {packageInfo.icon}
            <CardTitle className="text-base font-medium">
              {packageInfo.label}
            </CardTitle>
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
              statusStyle
            )}
          >
            {statusLabel}
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {packageInfo.description}
          </p>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.columnPlan}</span>
              <span className="font-medium">{subscription.planCode}</span>
            </div>
            {subscription.packageCode === "WHATSAPP" && (
              <>
                {subscription.quotaIn != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t.columnQuotaIn}
                    </span>
                    <span className="font-medium">
                      {subscription.quotaIn.toLocaleString("id-ID")}
                    </span>
                  </div>
                )}
                {subscription.quotaOut != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t.columnQuotaOut}
                    </span>
                    <span className="font-medium">
                      {subscription.quotaOut.toLocaleString("id-ID")}
                    </span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {termLabel} {t.cardPeriodPrice}
              </span>
              <span className="font-medium">
                {formatCurrency(
                  subscription.periodPrice ?? subscription.monthlyRateIdr ?? "0"
                )}
              </span>
            </div>
            {subscription.currentPeriodEnd && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t.columnRenewal}</span>
                <span className="font-medium">
                  {formatDate(subscription.currentPeriodEnd)}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Link>
    </Card>
  )
}
