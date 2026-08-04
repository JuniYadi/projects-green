"use client"

import { DeployWizardV2 } from "@/modules/deploy/ui/deploy-wizard-v2"
import { DeployWizardProvider } from "@/modules/deploy/deploy.store"

export default function DeployPage() {
  return (
    <DeployWizardProvider>
      <DeployWizardV2 />
    </DeployWizardProvider>
  )
}
