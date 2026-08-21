"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  CurrencyDollar,
  Phone,
  Warning,
  PaperPlaneTilt,
  Info,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault, localizePathname } from "@/lib/i18n/pathname"

function formatPhone(phone: string): string {
  if (phone.startsWith("+")) return phone
  return `+${phone}`
}

function formatQuotaCredit(value: string): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return value

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatMessagePrice(value: string, currency: string | null): string {
  const amount = Number(value)
  if (!currency || !Number.isFinite(amount)) {
    return currency ? `${currency} ${value}` : value
  }

  try {
    return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${value}`
  }
}

export default function WhatsAppPricingPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const t = getMessages(locale).console.whatsapp
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string>("all")

  const {
    data: pricing,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["whatsapp", "messages", "pricing"],
    queryFn: async () => {
      const payload = await whatsappClient.messages.pricing()
      if (!payload.ok) throw new Error("Pricing information is unavailable")
      return payload
    },
    staleTime: 30_000,
  })

  const devices = pricing?.devices ?? []
  const filteredDevices =
    selectedDeviceId === "all"
      ? devices
      : devices.filter((d) => d.deviceId === selectedDeviceId)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t.pricing.heading}
          </h1>
          <p className="text-muted-foreground">{t.pricing.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link
              href={localizePathname({
                pathname: "/console/whatsapp/usage",
                locale,
              })}
            >
              {t.usage.heading}
            </Link>
          </Button>
          <Button asChild>
            <Link
              href={localizePathname({
                pathname: "/console/whatsapp/messages",
                locale,
              })}
            >
              <PaperPlaneTilt className="mr-2 size-4" />
              {t.messages.sendMessage}
            </Link>
          </Button>
        </div>
      </div>

      {/* Overview Info Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Quota Credit Policy
            </CardTitle>
            <Info className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Quota credits are deducted per outbound message based on the Meta
              category of the template (Marketing, Utility, Authentication, or
              Service).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">PAYG Overage</CardTitle>
            <CurrencyDollar
              className="size-4 text-muted-foreground"
              weight="fill"
            />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-6 w-32" />
            ) : error ? (
              <p className="text-xs text-destructive">
                Failed to load PAYG rates.
              </p>
            ) : pricing?.overage.configured &&
              pricing.overage.unitPrice !== null ? (
              <div>
                <p className="text-lg font-bold">
                  {formatMessagePrice(
                    pricing.overage.unitPrice,
                    pricing.overage.currency
                  )}
                  <span className="text-xs font-normal text-muted-foreground">
                    {" "}
                    / message
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Applied automatically after available monthly quota runs out.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Not configured for this WhatsApp plan.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category Rates per Device */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Device Category Rates</CardTitle>
            <CardDescription>
              Quota credits deducted per message category by WhatsApp device and
              country.
            </CardDescription>
          </div>
          {devices.length > 1 && (
            <div className="flex items-center gap-2">
              <Phone className="size-4 text-muted-foreground" />
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="rounded-md border bg-background px-3 py-1.5 text-sm"
                aria-label="Filter by WhatsApp device"
              >
                <option value="all">All Devices ({devices.length})</option>
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {formatPhone(d.phoneNumber)} ({d.country})
                  </option>
                ))}
              </select>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3" aria-label="Loading pricing details">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Warning className="mb-3 size-8 text-destructive" weight="fill" />
              <p className="text-sm font-medium text-destructive">
                Pricing information is unavailable right now.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => refetch()}
              >
                Try Again
              </Button>
            </div>
          ) : devices.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No active WhatsApp devices found with pricing rates.
            </div>
          ) : (
            <div className="space-y-6">
              {filteredDevices.map((device) => (
                <div
                  key={device.deviceId}
                  className="rounded-lg border bg-card p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                    <div className="flex items-center gap-2">
                      <Phone className="size-4 text-muted-foreground" />
                      <span className="font-semibold">
                        {formatPhone(device.phoneNumber)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        Country: {device.country}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        Rate Tier: {device.rateTier ?? "BASE"}
                      </Badge>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <caption className="sr-only">
                        WhatsApp pricing and quota breakdown for{" "}
                        {device.phoneNumber}
                      </caption>
                      <thead className="bg-muted/50 text-left text-muted-foreground">
                        <tr>
                          <th scope="col" className="px-4 py-2.5 font-medium">
                            Category
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-2.5 text-center font-medium"
                          >
                            Quota Deduction
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-2.5 text-right font-medium"
                          >
                            PAYG Overage / Msg
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {device.categories.map((category) => (
                          <tr
                            key={category.category}
                            className="border-t hover:bg-muted/30"
                          >
                            <th
                              scope="row"
                              className="px-4 py-2.5 text-left font-medium"
                            >
                              {category.category}
                            </th>
                            <td className="px-4 py-2.5 text-center font-semibold text-primary">
                              -{formatQuotaCredit(category.quotaCredit)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold">
                              {category.overagePrice
                                ? `Rp ${category.overagePrice}`
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
