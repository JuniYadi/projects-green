import type { Metadata } from "next"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { PaymentMethodsList } from "./payment-methods-list"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const locale = resolveLocaleOrDefault((await params).lang)
  const t = getMessages(locale).console.billing.paymentMethods
  return { title: `${t.heading} | Console`, description: t.description }
}

export default async function PaymentMethodsPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const locale = resolveLocaleOrDefault((await params).lang)
  const t = getMessages(locale).console.billing.paymentMethods
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t.heading}</h1>
            <p className="text-sm text-muted-foreground">{t.description}</p>
          </div>
          <Button asChild size="sm">
            <Link href={`/${locale}/console/billing/topup`}>{t.addMethod}</Link>
          </Button>
        </div>
      </header>

      <PaymentMethodsList />
    </main>
  )
}
