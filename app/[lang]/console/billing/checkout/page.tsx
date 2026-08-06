"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  ArrowLeftIcon,
  ArrowCounterClockwise,
  WalletIcon,
} from "@phosphor-icons/react"

import { submitCheckout } from "./checkout-client"
import type { CheckoutResult } from "./checkout-client"

function formatCurrency(amount: string, currency: string): string {
  const value = Number(amount) / 100
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "id-ID", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(value)
}

function formatDate(iso: string | null): string {
  if (!iso) return "N/A"
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso))
}

function isRetryable(errorCode: string): boolean {
  return (
    errorCode === "INSUFFICIENT_BALANCE" || errorCode === "ORDER_NOT_CHARGEABLE"
  )
}

export default function CheckoutPage() {
  const searchParams = useSearchParams()
  const pricingId = searchParams.get("pricingId") ?? ""
  const productName = searchParams.get("product") ?? ""
  const planName = searchParams.get("plan") ?? ""
  const billingPeriod = searchParams.get("billingPeriod") ?? ""
  const price = searchParams.get("price") ?? ""
  const currency = searchParams.get("currency") ?? "IDR"

  const [quote, setQuote] = useState<CheckoutResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [idempotencyKey] = useState(
    () =>
      `checkout:${pricingId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`
  )

  const hasPricing = Boolean(pricingId)

  const handleCheckout = async (): Promise<void> => {
    if (!pricingId) return
    setIsLoading(true)
    setError(null)
    setQuote(null)

    try {
      const result = await submitCheckout({
        pricingId,
        idempotencyKey,
      })
      setQuote(result)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRetry = (): void => {
    setError(null)
    setQuote(null)
    void handleCheckout()
  }

  const handleAddBalance = (): void => {
    window.location.href = "/console/billing/topup"
  }

  const handleChooseAnother = (): void => {
    window.location.href = "/console/billing"
  }

  const isSuccess = quote?.ok === true
  const isFailure = quote?.ok === false
  const retryable = isFailure && quote && isRetryable(quote.error)

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/console/billing">
            <ArrowLeftIcon className="size-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Checkout</h1>
          <p className="text-sm text-muted-foreground">
            Review and confirm your subscription order
          </p>
        </div>
      </header>

      {!hasPricing && (
        <Alert variant="destructive">
          <AlertDescription>
            No pricing plan was selected. Please choose a plan from the catalog
            before checking out.
          </AlertDescription>
        </Alert>
      )}

      {hasPricing && !quote && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Product</span>
              <span>{productName || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Plan</span>
              <span>{planName || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Billing Period</span>
              <span>{billingPeriod || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Price</span>
              <span>{price ? formatCurrency(price, currency) : "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span className="text-muted-foreground">Not available</span>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span>First Payment</span>
              <span>{price ? formatCurrency(price, currency) : "—"}</span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="confirmation"
                  checked={confirmed}
                  onCheckedChange={(checked) => setConfirmed(checked === true)}
                />
                <Label htmlFor="confirmation">
                  I confirm this purchase and agree to the recurring billing
                  terms.
                </Label>
              </div>

              <Button
                onClick={() => void handleCheckout()}
                disabled={!confirmed || isLoading}
                className="w-full"
              >
                Confirm Purchase
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card>
          <CardContent className="py-6">
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {isSuccess && quote && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="text-green-700 dark:text-green-300">
              Order Confirmed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order ID</span>
              <span className="font-mono text-xs">{quote.orderId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">{quote.status}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(quote.subtotal, quote.currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span>0</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>First Payment</span>
              <span>{formatCurrency(quote.firstPayment, quote.currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Next Renewal</span>
              <span>{formatDate(quote.nextRenewal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Currency</span>
              <span>{quote.currency}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Billing Period</span>
              <span>{quote.billingPeriod}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Period</span>
              <span>
                {formatDate(quote.periodStart)} — {formatDate(quote.periodEnd)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {isFailure && quote && (
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive">Order Failed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{quote.message}</AlertDescription>
            </Alert>

            <div className="flex flex-col gap-2">
              {retryable && (
                <>
                  <Button onClick={handleRetry} className="w-full">
                    <ArrowCounterClockwise className="mr-2 size-4" />
                    Retry
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleAddBalance}
                    className="w-full"
                  >
                    <WalletIcon className="mr-2 size-4" />
                    Add Balance
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                onClick={handleChooseAnother}
                className="w-full"
              >
                Choose Another Plan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && !quote && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </main>
  )
}
