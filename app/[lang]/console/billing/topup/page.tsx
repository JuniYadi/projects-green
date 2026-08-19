"use client"

import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TopupFormEnhanced } from "@/components/billing/topup-form-enhanced"
import { getAccount } from "@/lib/billing-client"
import { ArrowLeftIcon } from "@phosphor-icons/react"

interface CurrencyConfig {
  symbol: string
  ratePerBase: number
  baseCode: string
  presets: number[]
  minTopup: number
  maxTopup: number
}

function formatCurrency(value: number, currency: "IDR" | "USD"): string {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "id-ID", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(value)
}

function TopupFormSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="space-y-6" aria-label={loadingLabel}>
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-9" />
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

function ImportantNotesSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="space-y-2" aria-label={loadingLabel}>
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-4 w-full" />
      ))}
    </div>
  )
}

export default function TopupPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const billing = messages.console.billing
  const [currency, setCurrency] = useState<"IDR" | "USD">("IDR")
  const [isLoadingCurrency, setIsLoadingCurrency] = useState(true)
  const [currencyConfig, setCurrencyConfig] = useState<CurrencyConfig | null>(
    null
  )
  useEffect(() => {
    let cancelled = false
    void getAccount()
      .then((account) => {
        if (
          !cancelled &&
          (account.currency === "IDR" || account.currency === "USD")
        ) {
          setCurrency(account.currency)
        }
      })
      .catch(() => {
        // Keep IDR default on failure.
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingCurrency(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/console/billing">
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">{billing.topUpHeading}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {billing.topUpDescription}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {billing.topUpDetails}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingCurrency ? (
                <TopupFormSkeleton loadingLabel={billing.topUpDetails} />
              ) : (
                <TopupFormEnhanced
                  currency={currency}
                  onConfigChange={setCurrencyConfig}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {billing.paymentInstructions}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">{billing.manualBankTransfer}</h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{billing.transferInstructions}</p>
                  <p>{billing.topUpInstructionDetail}</p>
                  <p>{billing.confirmPayment}</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">{billing.virtualAccount}</h4>
                <p className="text-sm text-muted-foreground">
                  {billing.autoUpdateDesc}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">{billing.qris}</h4>
                <p className="text-sm text-muted-foreground">
                  {billing.paymentOptions}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {billing.importantNotes}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingCurrency ? (
                <ImportantNotesSkeleton loadingLabel={billing.importantNotes} />
              ) : (
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  <li>
                    {billing.minTopUp.replace(
                      "{amount}",
                      currencyConfig
                        ? formatCurrency(currencyConfig.minTopup, currency)
                        : "—"
                    )}
                  </li>
                  <li>
                    {billing.maxTopUp.replace(
                      "{amount}",
                      currencyConfig
                        ? formatCurrency(currencyConfig.maxTopup, currency)
                        : "—"
                    )}
                  </li>
                  <li>{billing.balanceUpdatedAfterVerification}</li>
                  <li>{billing.manualTransfer24h}</li>
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
