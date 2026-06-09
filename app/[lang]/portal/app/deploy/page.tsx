import { DeployWizard } from "@/modules/deploy/ui/deploy-wizard"
import { DeployWizardProvider } from "@/modules/deploy/deploy.store"
import { LifecyclePageShell } from "@/modules/deploy/ui/lifecycle-page-shell"

type DeployPageProps = {
  params: Promise<{
    lang: string
  }>
}

export default async function DeployPage({ params }: DeployPageProps) {
  await params

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <DeployWizardProvider>
        <LifecyclePageShell
          title="Deploy Application"
          description="Build and release your application to Kubernetes."
        >
          <DeployWizard />
        </LifecyclePageShell>
      </DeployWizardProvider>
    </main>
  )
}
