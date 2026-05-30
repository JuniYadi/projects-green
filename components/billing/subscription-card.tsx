import { GlobeIcon, RocketLaunchIcon } from "@phosphor-icons/react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type SubscriptionItem = {
  id: string
  packageCode: string
  planCode: string
  regionCode: string
  billingMode: string
  type: string
  status: string
  allocatedConfig: Record<string, unknown> | null
  monthlyRateIdr: string
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

const packageConfig: Record<string, PackageInfo> = {
  WHATSAPP: {
    label: "WhatsApp",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-5 w-5"
      >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
    description: "WhatsApp Business messaging",
  },
  VPN: {
    label: "VPN",
    icon: <GlobeIcon className="h-5 w-5" />,
    description: "Virtual Private Network",
  },
  APP_HOSTING: {
    label: "App Hosting",
    icon: <RocketLaunchIcon className="h-5 w-5" />,
    description: "Application hosting platform",
  },
}

const statusStyles: Record<string, string> = {
  ACTIVE: "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400",
  SUSPENDED:
    "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  CANCELLED:
    "border-gray-500/20 bg-gray-500/10 text-gray-600 dark:text-gray-400",
}

function formatCurrency(amountIdr: string): string {
  const amount = Number.parseFloat(amountIdr)
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A"

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(dateStr))
}

export function SubscriptionCard({ subscription, className }: SubscriptionCardProps) {
  const packageInfo = packageConfig[subscription.packageCode] ?? {
    label: subscription.packageCode,
    icon: <RocketLaunchIcon className="h-5 w-5" />,
    description: subscription.packageCode,
  }

  const statusStyle = statusStyles[subscription.status] ?? statusStyles.CANCELLED

  return (
    <Card className={cn("", className)}>
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
          {subscription.status}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{packageInfo.description}</p>

        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Plan</span>
            <span className="font-medium">{subscription.planCode}</span>
          </div>

          {subscription.packageCode === "WHATSAPP" && (
            <>
              {subscription.quotaIn != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Quota In</span>
                  <span className="font-medium">
                    {subscription.quotaIn.toLocaleString("id-ID")}
                  </span>
                </div>
              )}
              {subscription.quotaOut != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Quota Out</span>
                  <span className="font-medium">
                    {subscription.quotaOut.toLocaleString("id-ID")}
                  </span>
                </div>
              )}
            </>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Monthly Rate</span>
            <span className="font-medium">
              {formatCurrency(subscription.monthlyRateIdr)}
            </span>
          </div>

          {subscription.currentPeriodEnd && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Next Billing</span>
              <span className="font-medium">
                {formatDate(subscription.currentPeriodEnd)}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
