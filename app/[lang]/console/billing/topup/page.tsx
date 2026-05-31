"use client"

import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TopupFormEnhanced } from "@/components/billing/topup-form-enhanced"
import { ArrowLeftIcon } from "@phosphor-icons/react"

export default function TopupPage() {
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
              <TopupFormEnhanced />
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
                <li>Minimum topup amount is IDR 10,000</li>
                <li>Maximum topup amount is IDR 100,000,000</li>
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
