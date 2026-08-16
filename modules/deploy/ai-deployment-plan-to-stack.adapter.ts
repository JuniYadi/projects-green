import type { StackUpsertInput } from "@/modules/deploy/deploy-pipeline.service"
import type { DeploymentPlanDTO } from "@/modules/deploy/deployment-plan.dto"
import {
  generateAppName,
  toGeneratedSubdomain,
} from "@/modules/deploy/deploy-wizard.logic"

export class PlanAdapterError extends Error {
  constructor(readonly field: string) {
    super(`Deployment plan is missing a required mapping for "${field}"`)
  }
}

export function planToStackUpsertInput(
  plan: DeploymentPlanDTO,
  context: { organizationId: string; repositoryConnectionId: string | null }
): StackUpsertInput {
  const [buildCommand] = plan.detection.commands
  if (!buildCommand) {
    throw new PlanAdapterError("detection.commands[0] (build command)")
  }
  if (!plan.detection.runtime) {
    throw new PlanAdapterError("detection.runtime")
  }
  if (!plan.configuration.branchOrRef) {
    throw new PlanAdapterError("configuration.branchOrRef")
  }

  const name =
    plan.configuration.appName ??
    generateAppName(plan.source.url ?? plan.source.templateId ?? "app")
  const subdomain = plan.domain.hostname ?? toGeneratedSubdomain(name)

  const sourceType: StackUpsertInput["sourceType"] =
    plan.source.kind === "template"
      ? "TEMPLATE"
      : context.repositoryConnectionId
        ? "GITHUB"
        : "PUBLIC"

  return {
    organizationId: context.organizationId,
    name,
    slug: name,
    sourceType,
    repositoryConnectionId:
      sourceType === "GITHUB" ? context.repositoryConnectionId : null,
    publicSourceUrl: sourceType === "PUBLIC" ? plan.source.url : null,
    publicSourceRef: sourceType === "PUBLIC" ? plan.source.ref : null,
    branchName: plan.configuration.branchOrRef,
    rootDirectory: "/",
    framework: plan.detection.framework,
    frameworkVersion: plan.detection.version,
    buildCommand,
    dockerfileDetected: false,
    primaryEngine: plan.detection.runtime,
    primaryEngineVersion: plan.detection.version,
    defaultPort: plan.detection.port,
    resourcePlanId: plan.resources.package,
    billingMode: plan.resources.package === "payg" ? "PAYG" : "PACKAGE",
    hourlyCost: plan.billing.estimate,
    cpu: plan.resources.cpu,
    memory: plan.resources.memory,
    customDomain: plan.domain.mode === "custom" ? plan.domain.hostname : null,
    subdomain,
    envVars: [],
  }
}
