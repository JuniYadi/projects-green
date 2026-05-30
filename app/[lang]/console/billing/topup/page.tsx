"use client"

import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TopupForm } from "@/components/billing/topup-form"
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
          Add funds to your billing account using manual bank transfer.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Up Form</CardTitle>
          </CardHeader>
          <CardContent>
            <TopupForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Bank Transfer Details</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Bank: Bank Central Asia (BCA)</p>
                <p>Account Number: 123-456-7890</p>
                <p>Account Name: PT Thunder AI Indonesia</p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Important Notes</h4>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                <li>Minimum topup amount is IDR 10,000</li>
                <li>Maximum topup amount is IDR 1,000,000</li>
                <li>Include your Reference ID in the transfer remarks</li>
                <li>Balance will be updated within 1-2 business days</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
