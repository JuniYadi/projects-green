"use client"

import { useParams } from "next/navigation"
import { WhatsappOrganizationApiKeySelfService } from "@/modules/whatsapp/organization-api-keys/ui/organization-api-key-self-service"
import { useWhatsAppOnboarding } from "@/modules/whatsapp/onboarding/use-whatsapp-onboarding"
import { LockedFeatureTeaser } from "@/modules/whatsapp/onboarding/locked-feature-teaser"
import { FlightHudWidget } from "@/modules/whatsapp/onboarding/flight-hud-widget"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export default function ConsoleWhatsAppApiKeysPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const tLocked = messages.console.whatsapp.onboarding.lockedFeatures.apiKeys
  const onboarding = useWhatsAppOnboarding({ locale })

  if (onboarding.isFeatureLocked("api_keys")) {
    return (
      <>
        <LockedFeatureTeaser
          featureTitle={tLocked.title}
          featureDescription={tLocked.description}
          unlockLevel={3}
          prerequisiteDescription={tLocked.prerequisite}
          activeMissionHref="/console/whatsapp/messages"
          activeMissionLabel={tLocked.activeLabel}
          locale={locale}
        />
        <FlightHudWidget onboarding={onboarding} locale={locale} />
      </>
    )
  }

  return <WhatsappOrganizationApiKeySelfService />
}
