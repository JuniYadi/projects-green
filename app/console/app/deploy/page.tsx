import { DeployWizard } from "@/modules/deploy/ui/deploy-wizard"

export default function DeployPage() {
  return (
    <main className="mx-auto w-full max-w-5xl p-4 md:p-6">
      <DeployWizard />
    </main>
  )
}
