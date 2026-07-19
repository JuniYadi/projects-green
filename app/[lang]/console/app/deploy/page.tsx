"use client"

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { useParams } from "next/navigation"
import { DeployWizardV2 } from "@/modules/deploy/ui/deploy-wizard-v2"
import { DeployWizardProvider } from "@/modules/deploy/deploy.store"

export default function DeployPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  return (
    <DeployWizardProvider>
      <DeployWizardV2
        title={messages.console.app.deploy.heading}
        description={messages.console.app.deploy.description}
      />
    </DeployWizardProvider>
  )
}
