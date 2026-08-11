import { createHash } from "node:crypto"

import { AppCredentialStatus, type PrismaClient } from "@prisma/client"
import { z } from "zod"

import { DEPLOY_TEMPLATES } from "@/modules/deploy/deploy.constants"
import {
  deploymentPlanSchema,
  type DeploymentPlanDTO,
} from "@/modules/deploy/deployment-plan.dto"

const ALLOWED_GIT_HOSTS = new Set(["github.com", "gitlab.com"])
const ALLOWED_EXECUTION_STEPS = new Set([
  "resolve_source",
  "inspect_runtime",
  "validate_plan",
  "await_confirmation",
])

const deploymentPlanCandidateSchema = deploymentPlanSchema.extend({
  source: deploymentPlanSchema.shape.source.extend({
    repositoryConnectionId: z.string().min(1).nullable(),
  }),
  access: deploymentPlanSchema.shape.access.extend({
    credentialRef: z.string().min(1).nullable(),
  }),
})

type DeploymentPlanCandidate = z.infer<typeof deploymentPlanCandidateSchema>

export class DeploymentPlanValidationError extends Error {
  constructor(
    readonly code:
      | "PLAN_INVALID"
      | "PLAN_SECRET_BEARING"
      | "PLAN_UNRESOLVED"
      | "PLAN_UNAUTHORIZED_REFERENCE"
  ) {
    super(code)
  }
}

export type ValidatedDeploymentPlan = {
  plan: DeploymentPlanDTO
  hash: string
}

const hasSecretBearingField = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.some(hasSecretBearingField)
  }

  if (!value || typeof value !== "object") {
    return false
  }

  return Object.entries(value).some(([key, child]) => {
    const normalized = key.toLowerCase()
    if (
      normalized === "value" ||
      normalized.includes("secret") ||
      normalized.includes("password") ||
      normalized.includes("token") ||
      normalized.includes("apikey") ||
      normalized.includes("authorization")
    ) {
      return true
    }
    return hasSecretBearingField(child)
  })
}

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }

  if (!value || typeof value !== "object") {
    return value
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)])
  )
}

export const hashDeploymentPlan = (plan: DeploymentPlanDTO): string => {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(plan)))
    .digest("hex")
}

export class DeploymentPlanValidator {
  constructor(private readonly db: PrismaClient) {}

  async validate({
    organizationId,
    plan: candidate,
  }: {
    organizationId: string
    plan: unknown
  }): Promise<ValidatedDeploymentPlan> {
    if (hasSecretBearingField(candidate)) {
      throw new DeploymentPlanValidationError("PLAN_SECRET_BEARING")
    }

    const parsed = deploymentPlanCandidateSchema.safeParse(candidate)
    if (!parsed.success) {
      throw new DeploymentPlanValidationError("PLAN_INVALID")
    }

    await this.assertReferencesAllowed(organizationId, parsed.data)
    this.assertReady(parsed.data)

    // Server-only references are authorization inputs, not durable plan data.
    const { repositoryConnectionId: _connectionId, ...source } =
      parsed.data.source
    const { credentialRef: _credentialRef, ...access } = parsed.data.access
    const plan = deploymentPlanSchema.parse({
      ...parsed.data,
      source,
      access,
    })

    return { plan, hash: hashDeploymentPlan(plan) }
  }

  private async assertReferencesAllowed(
    organizationId: string,
    plan: DeploymentPlanCandidate
  ): Promise<void> {
    if (plan.source.kind === "git") {
      const requiresRepositoryConnection = plan.access.state !== "public"
      if (requiresRepositoryConnection && !plan.source.repositoryConnectionId) {
        throw new DeploymentPlanValidationError("PLAN_UNAUTHORIZED_REFERENCE")
      }

      if (plan.source.repositoryConnectionId) {
        const connection = await this.db.githubRepositoryConnection.findFirst({
          where: {
            id: plan.source.repositoryConnectionId,
            enabled: true,
            installation: { organizationId },
          },
          select: { id: true },
        })
        if (!connection) {
          throw new DeploymentPlanValidationError("PLAN_UNAUTHORIZED_REFERENCE")
        }
      }
    }

    if (plan.access.credentialRef) {
      const credential = await this.db.appCredential.findFirst({
        where: {
          id: plan.access.credentialRef,
          organizationId,
          status: AppCredentialStatus.ACTIVE,
        },
        select: { id: true },
      })
      if (!credential) {
        throw new DeploymentPlanValidationError("PLAN_UNAUTHORIZED_REFERENCE")
      }
    }
  }

  private assertReady(plan: DeploymentPlanCandidate): void {
    if (plan.unresolved.some((input) => input.required)) {
      throw new DeploymentPlanValidationError("PLAN_UNRESOLVED")
    }
    if (
      plan.configuration.envRequirements.some(
        (requirement) =>
          requirement.required && requirement.status === "missing"
      ) ||
      plan.dependencies.some(
        (dependency) => dependency.required && dependency.status === "missing"
      )
    ) {
      throw new DeploymentPlanValidationError("PLAN_UNRESOLVED")
    }
    if (
      !plan.execution.ready ||
      (plan.access.state !== "verified" && plan.access.state !== "public")
    ) {
      throw new DeploymentPlanValidationError("PLAN_UNRESOLVED")
    }
    if (
      plan.execution.steps.some(
        (step) =>
          !ALLOWED_EXECUTION_STEPS.has(step.key) || step.status === "blocked"
      )
    ) {
      throw new DeploymentPlanValidationError("PLAN_INVALID")
    }
    if (plan.source.kind === "git") {
      if (!plan.source.url || !plan.source.host) {
        throw new DeploymentPlanValidationError("PLAN_INVALID")
      }
      const host = plan.source.host.toLowerCase()
      if (!ALLOWED_GIT_HOSTS.has(host)) {
        throw new DeploymentPlanValidationError("PLAN_UNAUTHORIZED_REFERENCE")
      }
    }
    if (
      plan.source.kind === "template" &&
      !DEPLOY_TEMPLATES.some(
        (template) => template.id === plan.source.templateId
      )
    ) {
      throw new DeploymentPlanValidationError("PLAN_UNAUTHORIZED_REFERENCE")
    }
  }
}
