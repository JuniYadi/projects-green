import { describe, expect, it } from "bun:test"
import type { DeploymentPlanDTO } from "@/modules/deploy/deployment-plan.dto"
import {
  planToStackUpsertInput,
  PlanAdapterError,
} from "./ai-deployment-plan-to-stack.adapter"

const gitPlanFixture: DeploymentPlanDTO = {
  version: 1,
  source: {
    kind: "git",
    url: "https://github.com/acme/example",
    host: "github.com",
    ref: "main",
    templateId: null,
  },
  access: { state: "verified", displayLabel: "GitHub repository" },
  detection: {
    runtime: "Node.js",
    framework: "Next.js",
    version: "20",
    commands: ["pnpm run build", "pnpm start"],
    port: 3000,
    confidence: 0.99,
    evidence: [
      {
        kind: "package.json",
        summary: "Detected Next.js application",
        reference: "package.json",
      },
    ],
  },
  configuration: {
    appName: null,
    branchOrRef: "main",
    environment: "production",
    envRequirements: [],
  },
  dependencies: [],
  resources: {
    package: "pro",
    server: "standard",
    region: "jakarta",
    cpu: 1000,
    memory: 2048,
    storage: 20,
  },
  domain: { mode: "auto", hostname: null, tls: true },
  billing: {
    quoteReference: "quote-1",
    currency: "USD",
    estimate: 0.12,
    interval: "hour",
  },
  execution: {
    ready: true,
    steps: [
      {
        key: "build",
        label: "Build application",
        status: "ready",
        evidenceReference: "package.json",
      },
    ],
  },
  unresolved: [],
  provenance: {
    analyzer: "ai",
    sourceReference: "https://github.com/acme/example",
    analyzedAt: "2026-08-16T00:00:00.000Z",
  },
}

const publicPlanFixture: DeploymentPlanDTO = {
  ...gitPlanFixture,
  source: {
    ...gitPlanFixture.source,
    url: "https://github.com/acme/public-example",
  },
  access: { state: "public", displayLabel: "Public repository" },
  configuration: { ...gitPlanFixture.configuration, appName: "public-app" },
}

describe("planToStackUpsertInput", () => {
  it("maps a validated git-source plan to StackUpsertInput", () => {
    const input = planToStackUpsertInput(gitPlanFixture, {
      organizationId: "org-1",
      repositoryConnectionId: "connection-1",
    })

    expect(input).toEqual({
      organizationId: "org-1",
      name: expect.any(String),
      slug: expect.any(String),
      sourceType: "GITHUB",
      repositoryConnectionId: "connection-1",
      publicSourceUrl: null,
      publicSourceRef: null,
      branchName: "main",
      rootDirectory: "/",
      framework: "Next.js",
      frameworkVersion: "20",
      buildCommand: "pnpm run build",
      dockerfileDetected: false,
      primaryEngine: "Node.js",
      primaryEngineVersion: "20",
      defaultPort: 3000,
      resourcePlanId: "pro",
      billingMode: "PACKAGE",
      hourlyCost: gitPlanFixture.billing.estimate,
      cpu: gitPlanFixture.resources.cpu,
      memory: gitPlanFixture.resources.memory,
      customDomain: null,
      subdomain: expect.any(String),
      envVars: [],
    })
  })

  it("maps a public-source plan with sourceType PUBLIC and no repositoryConnectionId", () => {
    const input = planToStackUpsertInput(publicPlanFixture, {
      organizationId: "org-1",
      repositoryConnectionId: null,
    })

    expect(input.sourceType).toBe("PUBLIC")
    expect(input.publicSourceUrl).toBe(publicPlanFixture.source.url)
  })

  it("throws PlanAdapterError when a required build command is missing", () => {
    const brokenPlan = {
      ...gitPlanFixture,
      detection: { ...gitPlanFixture.detection, commands: [] },
    }

    expect(() =>
      planToStackUpsertInput(brokenPlan, {
        organizationId: "org-1",
        repositoryConnectionId: "connection-1",
      })
    ).toThrow(PlanAdapterError)
  })
})
