import { describe, expect, it, mock } from "bun:test"
import type { PrismaClient } from "@prisma/client"

import {
  DeploymentPlanValidationError,
  DeploymentPlanValidator,
} from "./deployment-plan.validator"

const validPlan = () => ({
  version: 1,
  source: {
    kind: "git" as const,
    url: "https://github.com/acme/example",
    host: "github.com",
    ref: "main",
    templateId: null,
    repositoryConnectionId: "connection-1",
  },
  access: {
    state: "verified" as const,
    credentialRef: "credential-1",
    displayLabel: "Acme GitHub App",
  },
  detection: {
    runtime: "node",
    framework: "nextjs",
    version: "20",
    commands: ["bun run build"],
    port: 3000,
    confidence: 0.98,
    evidence: [
      {
        kind: "manifest",
        summary: "package.json declares Next.js",
        reference: "package.json",
      },
    ],
  },
  configuration: {
    appName: "example",
    branchOrRef: "main",
    environment: "production" as const,
    envRequirements: [
      {
        key: "DATABASE_URL",
        required: true,
        kind: "secret" as const,
        status: "provided" as const,
        description: "Database connection",
      },
    ],
  },
  dependencies: [
    {
      key: "database",
      kind: "database" as const,
      mode: "existing" as const,
      required: true,
      status: "ready" as const,
      requiredInputs: [],
      readinessChecks: ["connection verified"],
    },
  ],
  resources: {
    package: "pro",
    server: null,
    region: "sgp",
    cpu: 1,
    memory: 512,
    storage: 1024,
  },
  domain: { mode: "auto" as const, hostname: null, tls: true },
  billing: {
    quoteReference: "estimate:pro",
    currency: "USD",
    estimate: 12,
    interval: "month" as const,
  },
  execution: {
    ready: true,
    steps: [
      {
        key: "resolve_source",
        label: "Source verified",
        status: "ready" as const,
        evidenceReference: "source:1",
      },
      {
        key: "inspect_runtime",
        label: "Runtime inspected",
        status: "ready" as const,
        evidenceReference: "inspection:1",
      },
      {
        key: "validate_plan",
        label: "Plan validated",
        status: "ready" as const,
        evidenceReference: null,
      },
      {
        key: "await_confirmation",
        label: "Awaiting confirmation",
        status: "pending" as const,
        evidenceReference: null,
      },
    ],
  },
  unresolved: [],
  provenance: {
    analyzer: "framework-detector",
    sourceReference: "inspection-1",
    analyzedAt: "2026-08-09T00:00:00.000Z",
  },
})

const createValidator = () => {
  const db = {
    githubRepositoryConnection: {
      findFirst: mock(async () => ({ id: "connection-1" })),
    },
    appCredential: { findFirst: mock(async () => ({ id: "credential-1" })) },
  } as unknown as PrismaClient
  return { validator: new DeploymentPlanValidator(db), db }
}

describe("DeploymentPlanValidator", () => {
  it("canonicalizes a safe plan and removes server-only references", async () => {
    const { validator } = createValidator()

    const result = await validator.validate({
      organizationId: "org-1",
      plan: validPlan(),
    })

    expect(result.hash).toHaveLength(64)
    expect(result.plan.source).not.toHaveProperty("repositoryConnectionId")
    expect(result.plan.access).not.toHaveProperty("credentialRef")
    expect(result.plan.configuration.envRequirements[0]).not.toHaveProperty(
      "value"
    )
  })

  it("rejects plans with unresolved required inputs", async () => {
    const { validator } = createValidator()
    const plan = validPlan()
    plan.unresolved.push({
      key: "domain",
      required: true,
      description: "Choose a domain",
    })

    await expect(
      validator.validate({ organizationId: "org-1", plan })
    ).rejects.toMatchObject({ code: "PLAN_UNRESOLVED" })
  })

  it("rejects secret-bearing plan input", async () => {
    const { validator } = createValidator()
    const plan = validPlan() as Record<string, unknown>
    const configuration = plan.configuration as Record<string, unknown>
    configuration.apiToken = "do-not-store-me"

    await expect(
      validator.validate({ organizationId: "org-1", plan })
    ).rejects.toBeInstanceOf(DeploymentPlanValidationError)
    await expect(
      validator.validate({ organizationId: "org-1", plan })
    ).rejects.toMatchObject({ code: "PLAN_SECRET_BEARING" })
  })

  it("rejects credential references outside the active tenant", async () => {
    const { validator, db } = createValidator()
    db.appCredential.findFirst.mockResolvedValue(null as never)

    await expect(
      validator.validate({ organizationId: "org-1", plan: validPlan() })
    ).rejects.toMatchObject({ code: "PLAN_UNAUTHORIZED_REFERENCE" })
  })
})
