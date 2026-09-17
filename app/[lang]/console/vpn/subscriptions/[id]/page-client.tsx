"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  startTransition,
} from "react"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { getVpnSubscription, type VpnSubscription } from "@/lib/vpn-client"
import {
  listMobileDevices,
  revokeMobileDevice,
  type MobileDeviceEntry,
} from "@/lib/vpn-mobile-client"
import {
  CopySimpleIcon,
  DeviceMobileIcon,
  ArrowLeftIcon,
} from "@phosphor-icons/react"
import Link from "next/link"

import {
  formatDate,
  subscriptionPriceLabel,
  VpnServerAccountsDetail,
} from "../../_components/vpn-my-services"
import { VpnDevicesList } from "../../_components/vpn-devices-list"

type PageState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | {
      phase: "ready"
      subscription: VpnSubscription
      devices: MobileDeviceEntry[]
    }

function maxDevicesFor(subscription: VpnSubscription): number {
  return (
    subscription.serverAccounts.filter(
      (account) => account.provisioningStatus === "ACTIVE"
    ).length * 2
  )
}

function activeDeviceCount(devices: MobileDeviceEntry[]): number {
  return devices.filter((d) => d.status === "ACTIVE").length
}

function StatusBadge({
  subscription,
  t,
}: {
  subscription: VpnSubscription
  t: Record<string, string>
}) {
  const status = subscription.cancelAtPeriodEnd
    ? "CANCELLING"
    : subscription.status
  const variant =
    status === "ACTIVE"
      ? "default"
      : status === "CANCELLING"
        ? "secondary"
        : subscription.status === "SUSPENDED"
          ? "secondary"
          : "destructive"

  return (
    <Badge variant={variant}>
      {status === "CANCELLING"
        ? t.statusCancelling
        : status === "ACTIVE"
          ? t.statusActive
          : status === "SUSPENDED"
            ? t.statusSuspended
            : status === "EXPIRED"
              ? t.statusExpired
              : status}
    </Badge>
  )
}

function InfoCard({
  label,
  value,
  subValue,
}: {
  label: string
  value: React.ReactNode
  subValue?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-base">{value}</CardTitle>
      </CardHeader>
      {subValue && (
        <CardContent className="pt-0 text-xs text-muted-foreground">
          {subValue}
        </CardContent>
      )}
    </Card>
  )
}

async function copySubscriptionId(
  id: string,
  t: Record<string, string>
): Promise<void> {
  try {
    await navigator.clipboard.writeText(id)
    toast.success(t.copied)
  } catch {
    try {
      const el = document.createElement("textarea")
      el.value = id
      el.style.position = "fixed"
      el.style.opacity = "0"
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
      toast.success(t.copied)
    } catch {
      toast.error(t.copyFailed)
    }
  }
}

export default function ConsoleVpnSubscriptionDetailPage() {
  const params = useParams<{ lang?: string; id: string }>()
  const subscriptionId = params.id
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pConsoleVpnSubscriptionsDetail

  const [state, setState] = useState<PageState>(
    subscriptionId
      ? { phase: "loading" }
      : { phase: "error", message: t.missingId }
  )

  const load = useCallback(async () => {
    if (!subscriptionId) return

    try {
      const [subscription, devices] = await Promise.all([
        getVpnSubscription(subscriptionId),
        listMobileDevices().catch(() => [] as MobileDeviceEntry[]),
      ])
      startTransition(() => {
        setState({
          phase: "ready",
          subscription,
          devices: devices.filter((d) => d.subscriptionId === subscriptionId),
        })
      })
    } catch {
      startTransition(() => {
        setState({
          phase: "error",
          message: t.loadFailed,
        })
      })
    }
  }, [subscriptionId])

  useEffect(() => {
    load()
  }, [load])

  const handleRevoke = useCallback(
    async (deviceId: string) => {
      try {
        await revokeMobileDevice(deviceId)
        toast.success(t.deviceRevoked)
        await load()
      } catch {
        toast.error(t.deviceRevokeFailed)
      }
    },
    [load, t]
  )

  const subscriptionsUrl = useMemo(() => {
    return params.lang
      ? `/${params.lang}/console/vpn/subscriptions`
      : "/console/vpn/subscriptions"
  }, [params.lang])

  if (state.phase === "loading") {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <header className="space-y-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </header>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </main>
    )
  }

  if (state.phase === "error") {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <p className="text-sm text-destructive">{state.message}</p>
        <Button asChild variant="outline" className="w-fit">
          <Link href={subscriptionsUrl}>
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            {t.backToSubscriptions}
          </Link>
        </Button>
      </main>
    )
  }

  const { subscription, devices } = state
  const maxDevices = maxDevicesFor(subscription)
  const activeDevices = activeDeviceCount(devices)

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div className="flex items-start justify-between gap-4">
        <header className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">
              {subscription.packageName}
            </h1>
            <StatusBadge subscription={subscription} t={t} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono" title={subscription.id}>
              {subscription.id.length > 24
                ? `${subscription.id.slice(0, 24)}…`
                : subscription.id}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5"
              onClick={() => void copySubscriptionId(subscription.id, t)}
              aria-label={t.copySubscriptionId}
            >
              <CopySimpleIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </header>
        <Button asChild variant="outline" size="sm">
          <Link href={subscriptionsUrl}>
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            {t.back}
          </Link>
        </Button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <InfoCard
          label={t.firstBuy}
          value={formatDate(subscription.createdAt)}
          subValue={
            subscription.firstPayment
              ? `${t.paidAmount} ${subscription.firstPayment.amount} ${subscription.firstPayment.currency}`
              : undefined
          }
        />
        <InfoCard
          label={t.renewPrice}
          value={subscriptionPriceLabel(subscription)}
        />
        <InfoCard
          label={t.nextPayment}
          value={formatDate(subscription.currentPeriodEnd)}
          subValue={
            subscription.cancelAtPeriodEnd
              ? t.cancelsAfterDate
              : `${activeDevices} ${t.ofWord} ${maxDevices} ${t.devicesConnected}`
          }
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">
          {t.serverAccounts}
        </h2>
        <VpnServerAccountsDetail subscription={subscription} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">
            {t.connectedDevices}
          </h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DeviceMobileIcon className="h-4 w-4" />
            {activeDevices} {t.ofWord} {maxDevices} {t.activeWord}
          </div>
        </div>
        <VpnDevicesList
          devices={devices}
          onRevoke={handleRevoke}
          revoking={null}
          defaultStatusFilter={"all"}
        />
      </section>
    </main>
  )
}
