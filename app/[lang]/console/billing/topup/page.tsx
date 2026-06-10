"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TopupFormEnhanced } from "@/components/billing/topup-form-enhanced"
import { getAccount } from "@/lib/billing-client"
import { ArrowLeftIcon } from "@phosphor-icons/react"

function formatLimit(value: number, currency: "IDR" | "USD"): string {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "id-ID", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(value)
}

export default function TopupPage() {
  const [currency, setCurrency] = useState<"IDR" | "USD">("IDR")

  useEffect(() => {
    let cancelled = false
    // Render with IDR default immediately, then update when account currency
    // resolves. No loading skeleton here — the flash from IDR → account
    // currency is imperceptible (<200ms) and avoids layout shift.
    void getAccount()
      .then((account) => {
        if (!cancelled && (account.currency === "IDR" || account.currency === "USD")) {
          setCurrency(account.currency)
        }
      })
      .catch(() => {
        // Keep IDR default on failure.
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
          <h1 className="text-2xl font-semibold">Top Up Balance</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Add funds to your billing account. Choose your preferred payment method.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Up Details</CardTitle>
            </CardHeader>
            <CardContent>
              <TopupFormEnhanced currency={currency} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">Manual Bank Transfer</h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>1. Create invoice using the form</p>
                  <p>2. Transfer to the destination account</p>
                  <p>3. Confirm payment on the next page</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Virtual Account</h4>
                <p className="text-sm text-muted-foreground">
                  Pay via your bank&apos;s virtual account. Instructions will be provided after invoice creation.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">QRIS</h4>
                <p className="text-sm text-muted-foreground">
                  Scan the QR code with any QRIS-enabled app. Quick and instant confirmation.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Important Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                <li>Minimum topup amount is {formatLimit(10000, currency)}</li>
                <li>Maximum topup amount is {formatLimit(100000000, currency)}</li>
                <li>Balance will be updated after payment verification</li>
                <li>For manual transfer, please confirm payment within 24 hours</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
