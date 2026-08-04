import type { ComponentProps } from "react"
import { enMessages } from "@/lib/i18n/messages/en"
import type { DeployWizardMessages } from "@/lib/i18n/messages/types"
import { CheckCircle } from "@/components/ui/phosphor-icons"
import { recommendPlan } from "@/modules/deploy/deploy-recommendation"
import {
  isHighConfidence,
  isMediumConfidence,
} from "@/modules/deploy/deploy.schema"
import type { DetectionResult } from "@/modules/deploy/deploy.types"
import { StepEnvironmentV2 } from "@/modules/deploy/ui/step-environment-v2"
type StepReviewProps = ComponentProps<typeof StepEnvironmentV2> & {
  messages?: DeployWizardMessages
  appName?: string
  branchName?: string
  detectionResult?: DetectionResult | null
}

const resourcePlanLabels = {
  starter: "Starter",
  pro: "Pro",
  payg: "Pay As You Go",
} as const

function factVersion(value?: string | null) {
  return value && value !== "unknown" ? `v${value}` : "Not detected"
}
export function StepReviewV2({
  appName,
  branchName,
  buildState,
  detectionResult,
  resourcePlanId,
  cpu,
  memory,
  messages: providedMessages,
  ...environmentProps
}: StepReviewProps) {
  const messages = providedMessages ?? enMessages.console.app.deployWizard
  const recommendation = recommendPlan(detectionResult ?? null)
  const framework =
    buildState?.framework || detectionResult?.framework || "Not detected"
  const runtime =
    buildState?.primaryEngine ||
    detectionResult?.primaryEngine ||
    "Not detected"
  const runtimeVersion =
    buildState?.primaryEngineVersion || detectionResult?.primaryEngineVersion
  const build = buildState?.useDockerfile
    ? "Dockerfile"
    : buildState?.buildCommand ||
      detectionResult?.buildCommand ||
      "Not detected"
  const port = detectionResult?.defaultPort ?? buildState?.defaultPort
  const confidence = detectionResult?.confidence
  const requiresManualSetup =
    !detectionResult ||
    detectionResult.status === "blocked" ||
    detectionResult.status === "unsupported" ||
    detectionResult.status === "failed" ||
    detectionResult.status === "low_confidence"
  const confidenceCopy = requiresManualSetup
    ? messages.review.manualSetupRequired
    : isHighConfidence(detectionResult)
      ? messages.review.checkedFact
      : isMediumConfidence(detectionResult)
        ? messages.review.editableRecommendation
        : messages.review.manualSetupRequired

  return (
    <div className="space-y-4">
      <section className="space-y-4 p-6" aria-labelledby="deploy-plan-heading">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            {messages.review.eyebrow}
          </p>
          <h2 id="deploy-plan-heading" className="text-xl font-bold">
            {messages.review.heading}
          </h2>
          <p className="text-sm text-muted-foreground">
            {messages.review.description}
          </p>
        </div>

        <dl className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">
              {messages.review.appName}
            </dt>
            <dd className="font-medium">
              {appName || messages.review.unnamedApp}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {messages.review.branch}
            </dt>
            <dd className="font-medium">
              {branchName || messages.review.defaultBranch}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {messages.review.framework}
            </dt>
            <dd className="font-medium">
              {framework}{" "}
              {factVersion(
                buildState?.frameworkVersion ||
                  detectionResult?.frameworkVersion
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {messages.review.runtime}
            </dt>
            <dd className="font-medium">
              {runtime} {factVersion(runtimeVersion)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {messages.review.build}
            </dt>
            <dd className="font-medium break-words">{build}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {messages.review.port}
            </dt>
            <dd className="font-medium">{port || "Not detected"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {messages.review.resourcePlan}
            </dt>
            <dd className="font-medium">
              {resourcePlanLabels[resourcePlanId]} (
              {cpu ?? recommendation.cpu ?? 0} CPU /{" "}
              {memory ?? recommendation.memory ?? 0} MiB)
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {messages.review.confidence}
            </dt>
            <dd className="flex items-center gap-1.5 font-medium">
              {!requiresManualSetup &&
              isHighConfidence(detectionResult ?? null) ? (
                <CheckCircle
                  className="h-4 w-4 text-emerald-600"
                  aria-hidden="true"
                />
              ) : null}
              {confidence == null ? "—" : `${confidence}% — ${confidenceCopy}`}
            </dd>
          </div>
        </dl>

        <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {messages.review.noDatabase}
        </p>
      </section>

      <StepEnvironmentV2
        messages={messages}
        {...environmentProps}
        resourcePlanId={resourcePlanId}
        cpu={cpu}
        memory={memory}
      />
    </div>
  )
}
