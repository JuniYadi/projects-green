"use client"

import * as React from "react"
import { WhatsappOrganizationApiKeySelfService } from "@/modules/whatsapp/organization-api-keys/ui/organization-api-key-self-service"
import { useWhatsAppOnboarding } from "@/modules/whatsapp/onboarding/use-whatsapp-onboarding"
import { LockedFeatureTeaser } from "@/modules/whatsapp/onboarding/locked-feature-teaser"
import { FlightHudWidget } from "@/modules/whatsapp/onboarding/flight-hud-widget"

export default function ConsoleWhatsAppApiKeysPage() {
  const onboarding = useWhatsAppOnboarding()

  if (onboarding.isFeatureLocked("api_keys")) {
    return (
      <>
        <LockedFeatureTeaser
          featureTitle="Production API Keys"
          featureDescription="Create, scope, and rotate programmatic API keys for server-to-server WhatsApp messaging and automated integrations."
          unlockLevel={3}
          prerequisiteDescription="Send your first message and approve a template to unlock automated API keys and developer tools."
          activeMissionHref="/console/whatsapp/messages"
          activeMissionLabel="Complete Active Mission"
        />
        <FlightHudWidget onboarding={onboarding} />
      </>
    )
  }

  return <WhatsappOrganizationApiKeySelfService />
}
