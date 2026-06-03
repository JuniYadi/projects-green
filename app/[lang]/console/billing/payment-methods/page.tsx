import type { Metadata } from "next"

import { PaymentMethodsList } from "./payment-methods-list"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Payment Methods | Console",
  description: "Manage your saved payment methods",
}

export default function PaymentMethodsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Payment Methods</h1>
            <p className="text-sm text-muted-foreground">
              Manage your saved bank accounts for top-ups and payments.
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/console/billing/topup">Add Payment Method</Link>
          </Button>
        </div>
      </header>

      <PaymentMethodsList />
    </main>
  )
}
