import { enMessages } from "@/lib/i18n/messages/en"
import type { DeployWizardMessages } from "@/lib/i18n/messages/types"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  GitBranch,
  GithubLogo,
} from "@/components/ui/phosphor-icons"
import type {
  Branch,
  DeploySourceType,
  Owner,
  Repository,
} from "@/modules/deploy/deploy.types"

type StepConnectV2Props = {
  messages?: DeployWizardMessages
  sourceType: DeploySourceType
  owner: Owner | null
  repository: Repository | null
  branch: Branch | null
  canProceed: boolean
  onBack: () => void
  onNext: () => void
}

export function StepConnectV2({
  sourceType,
  owner,
  repository,
  branch,
  canProceed,
  onBack,
  onNext,
  messages: providedMessages,
}: StepConnectV2Props) {
  const messages = providedMessages ?? enMessages.console.app.deployWizard
  const isTemplate = sourceType === "template"

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
          {messages.connect.eyebrow}
        </p>
        <h2 className="text-xl font-bold">
          {isTemplate
            ? messages.connect.templateHeading
            : messages.connect.repositoryHeading}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isTemplate
            ? messages.connect.templateDescription
            : messages.connect.repositoryDescription}
        </p>
      </div>

      <section className="rounded-xl border border-border bg-muted/20 p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-3 text-primary">
            {isTemplate ? (
              <CheckCircle className="h-6 w-6" />
            ) : (
              <GithubLogo className="h-6 w-6" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            {isTemplate ? (
              <>
                <p className="font-semibold">
                  {messages.connect.templateDeployment}
                </p>
                <p className="text-sm text-muted-foreground">
                  {messages.connect.templateSummary}
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">
                  {owner?.name ?? messages.connect.githubAccount}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {repository
                    ? `${repository.ownerId}/${repository.name}`
                    : messages.connect.selectRepository}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <GitBranch className="h-3.5 w-3.5" />
                  {branch?.name ?? messages.connect.noBranch}
                </p>
              </>
            )}
          </div>
          {isTemplate || (repository && branch) ? (
            <CheckCircle className="h-5 w-5 shrink-0 text-emerald-500" />
          ) : null}
        </div>
      </section>

      <div className="rounded-lg border border-border bg-background p-4 text-xs text-muted-foreground">
        {isTemplate
          ? messages.connect.templateNotice
          : messages.connect.repositoryNotice}
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {messages.connect.back}
        </Button>
        <Button type="button" onClick={onNext} disabled={!canProceed}>
          {messages.connect.continue}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
