"use client"

import { getMessages } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { useParams } from "next/navigation"
import { DeployWizardV2 } from "@/modules/deploy/ui/deploy-wizard-v2"
import { DeployWizardProvider } from "@/modules/deploy/deploy.store"

export default function DeployPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const dashboardHref = localizePathname({
    pathname: "/console/app/manage",
    locale,
  })
  return (
    <DeployWizardProvider>
      <DeployWizardV2
        messages={messages.console.app.deployWizard}
        dashboardHref={dashboardHref}
      />
    </DeployWizardProvider>
  )
}
