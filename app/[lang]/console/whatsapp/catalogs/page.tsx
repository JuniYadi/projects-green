"use client"

import { ShoppingBagOpen } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useParams } from "next/navigation"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getMessages } from "@/lib/i18n/messages"
import { useWhatsAppOnboarding } from "@/modules/whatsapp/onboarding/use-whatsapp-onboarding"
import { LockedFeatureTeaser } from "@/modules/whatsapp/onboarding/locked-feature-teaser"
import { FlightHudWidget } from "@/modules/whatsapp/onboarding/flight-hud-widget"

export default function CatalogsPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const tLocked = messages.console.whatsapp.onboarding.lockedFeatures.catalogs
  const onboarding = useWhatsAppOnboarding({ locale })

  if (onboarding.isFeatureLocked("catalogs")) {
    return (
      <>
        <LockedFeatureTeaser
          featureTitle={tLocked.title}
          featureDescription={tLocked.description}
          unlockLevel={2}
          prerequisiteDescription={tLocked.prerequisite}
          activeMissionHref="/console/whatsapp/messages"
          activeMissionLabel={tLocked.activeLabel}
          locale={locale}
        />
        <FlightHudWidget onboarding={onboarding} locale={locale} />
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <h1 className="text-2xl font-bold">
            {messages.console.whatsapp.catalogs.heading}
          </h1>
          <Badge variant="secondary">
            {locale === "id" ? "Segera Hadir" : "Coming soon"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {messages.console.whatsapp.catalogs.description}
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShoppingBagOpen className="size-6" weight="duotone" />
            </div>
            <div>
              <CardTitle>
                {locale === "id"
                  ? "Katalog WhatsApp & Commerce"
                  : "WhatsApp Catalogs & Commerce"}
              </CardTitle>
              <CardDescription className="mt-1">
                {locale === "id"
                  ? "Tampilkan produk dan permudah pelanggan berbelanja."
                  : "Showcase products and make it easier for customers to shop."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center px-6 py-14 text-center">
          <Badge className="mb-4">
            {locale === "id" ? "Segera Hadir" : "Coming soon"}
          </Badge>
          <h2 className="text-xl font-semibold tracking-tight">
            {locale === "id"
              ? "Integrasi Commerce sedang disiapkan"
              : "Commerce integration is on its way"}
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {locale === "id"
              ? "Kami sedang menyiapkan cara mudah untuk menghubungkan Facebook Commerce Manager, menyinkronkan produk, dan membagikannya dalam percakapan WhatsApp. Fitur ini akan tersedia pada pembaruan mendatang."
              : "We’re preparing a simple way to connect Facebook Commerce Manager, sync your products, and share them in WhatsApp conversations. This will be available in an upcoming release."}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
