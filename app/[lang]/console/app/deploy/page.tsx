"use client"

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { useParams } from "next/navigation"
import { DeployWizard } from "@/modules/deploy/ui/deploy-wizard"
import { DeployWizardProvider } from "@/modules/deploy/deploy.store"
import { LifecyclePageShell } from "@/modules/deploy/ui/lifecycle-page-shell"

export default function DeployPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  return (
    <DeployWizardProvider>
      <LifecyclePageShell
        title={messages.console.app.deploy.heading}
        description={messages.console.app.deploy.description}
      >
        <DeployWizard />
      </LifecyclePageShell>
    </DeployWizardProvider>
  )
}
