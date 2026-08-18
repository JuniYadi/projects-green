import { describe, expect, it } from "bun:test"

import {
  buildDeployConfig,
  isDeployConfigValid,
} from "@/modules/deploy/deploy-config"
import type {
  DeployBuildState,
  DeployEnvironmentState,
  DeploySourceState,
  DetectionResult,
} from "@/modules/deploy/deploy.types"

const validSource: DeploySourceState = {
  sourceType: "github",
  ownerId: "acme",
  repositoryId: "123",
  branchName: "main",
  rootDirectory: "/",
  appName: "",
}

const highConfidenceDetection: DetectionResult = {
  language: "Node.js",
  framework: "Next.js",
  dockerfileDetected: false,
  buildCommand: "npm run build",
  confidence: 92,
  status: "success",
}

const validBuild: DeployBuildState = {
  language: "Node.js",
  framework: "Next.js",
  buildCommand: "npm run build",
  useDockerfile: false,
}

const validEnvironment: DeployEnvironmentState = {
  useGeneratedSubdomain: true,
  customDomain: "",
  envVars: [],
  resourcePlanId: "payg",
  billingMode: "PAYG",
  paygBufferHours: 24,
  cpu: 100,
  memory: 256,
}

const baseState = () => ({
  source: { ...validSource },
  build: { ...validBuild },
  environment: { ...validEnvironment },
  detectionResult: { ...highConfidenceDetection },
})

describe("buildDeployConfig — happy path", () => {
  it("assembles a validated config from a complete wizard state", () => {
    const result = buildDeployConfig(baseState())

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.config.source.ownerId).toBe("acme")
    expect(result.config.source.rootDirectory).toBe("/")
    expect(result.config.environment.domain).toEqual({ mode: "generated" })
    expect(result.config.environment.billingMode).toBe("PAYG")
    expect(result.config.environment.paygBufferHours).toBe(24)
    expect(result.config.detection).toEqual({
      confidence: 92,
      status: "success",
    })
  })

  it("normalizes a custom domain into the domain contract", () => {
    const result = buildDeployConfig({
      ...baseState(),
      environment: {
        ...validEnvironment,
        useGeneratedSubdomain: false,
        customDomain: "  App.Example.com  ",
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.environment.domain).toEqual({
      mode: "custom",
      customDomain: "App.Example.com",
    })
  })

  it("normalizes env vars with default type and scope", () => {
    const result = buildDeployConfig({
      ...baseState(),
      environment: {
        ...validEnvironment,
        envVars: [{ id: "e1", key: "API_KEY", value: "secret" }],
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.environment.envVars[0]).toEqual({
      key: "API_KEY",
      value: "secret",
      type: "plain",
      scope: "all",
      isStoredSecret: false,
    })
  })

  it("retains Vault and shared-reference metadata", () => {
    const result = buildDeployConfig({
      ...baseState(),
      environment: {
        ...validEnvironment,
        envVars: [
          {
            id: "e1",
            key: "DATABASE_URL",
            value: "",
            type: "secret_ref",
            isStoredSecret: true,
            source: "vault",
            vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
            vaultKey: "DATABASE_URL",
            version: 3,
            lastUpdatedAt: "2026-08-18T10:00:00.000Z",
          },
          {
            id: "e2",
            key: "REDIS_URL",
            value: "",
            type: "secret_shared_ref",
            source: "managed_service",
            serviceCredentialId: "credential-redis",
            vaultPath: "tenants/org-1/shared/managed-services/credential-redis",
            vaultKey: "CONNECTION_STRING",
            referenceLabel: "Managed Redis",
          },
        ],
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.environment.envVars).toEqual([
      {
        key: "DATABASE_URL",
        value: "",
        type: "secret_ref",
        scope: "all",
        isStoredSecret: true,
        source: "vault",
        vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
        vaultKey: "DATABASE_URL",
        version: 3,
        lastUpdatedAt: "2026-08-18T10:00:00.000Z",
      },
      {
        key: "REDIS_URL",
        value: "",
        type: "secret_shared_ref",
        scope: "all",
        isStoredSecret: false,
        source: "managed_service",
        serviceCredentialId: "credential-redis",
        vaultPath: "tenants/org-1/shared/managed-services/credential-redis",
        vaultKey: "CONNECTION_STRING",
        referenceLabel: "Managed Redis",
      },
    ])
  })

  it("treats build inputs as optional when detection is high confidence", () => {
    const result = buildDeployConfig({
      ...baseState(),
      build: {
        language: "",
        framework: "",
        buildCommand: "",
        useDockerfile: false,
      },
    })

    expect(result.ok).toBe(true)
  })

  it("isDeployConfigValid returns true for a complete state", () => {
    expect(isDeployConfigValid(baseState())).toBe(true)
  })
})

describe("buildDeployConfig — unhappy path", () => {
  it("blocks when source is incomplete", () => {
    const result = buildDeployConfig({
      ...baseState(),
      source: { ...validSource, repositoryId: "" },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.some((e) => e.field.startsWith("source."))).toBe(true)
  })

  it("rejects non-github source types", () => {
    const result = buildDeployConfig({
      ...baseState(),
      source: { ...validSource, sourceType: "template" } as DeploySourceState,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]?.field).toBe("source.sourceType")
  })

  it("requires build inputs when detection is failed/low-confidence", () => {
    const result = buildDeployConfig({
      ...baseState(),
      detectionResult: {
        ...highConfidenceDetection,
        confidence: 0,
        status: "failed",
      },
      build: {
        language: "",
        framework: "",
        buildCommand: "",
        useDockerfile: false,
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.some((e) => e.field.startsWith("build."))).toBe(true)
  })

  it("blocks when custom domain is required but empty", () => {
    const result = buildDeployConfig({
      ...baseState(),
      environment: {
        ...validEnvironment,
        useGeneratedSubdomain: false,
        customDomain: "",
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.some((e) => e.field.startsWith("environment."))).toBe(
      true
    )
  })

  it("blocks on duplicate env var keys", () => {
    const result = buildDeployConfig({
      ...baseState(),
      environment: {
        ...validEnvironment,
        envVars: [
          { id: "e1", key: "API_KEY", value: "a" },
          { id: "e2", key: "API_KEY", value: "b" },
        ],
      },
    })

    expect(result.ok).toBe(false)
  })
})

describe("buildDeployConfig — public source", () => {
  it("assembles config for public source with HTTPS URL", () => {
    const result = buildDeployConfig({
      ...baseState(),
      source: {
        ...validSource,
        sourceType: "public",
        ownerId: "",
        repositoryId: "",
        publicSourceUrl: "https://github.com/org/repo",
        publicSourceRef: "main",
        appName: "my-public-app",
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.source.sourceType).toBe("public")
    expect(result.config.source.publicSourceUrl).toBe(
      "https://github.com/org/repo"
    )
    expect(result.config.source.publicSourceRef).toBe("main")
    expect(result.config.source.appName).toBe("my-public-app")
  })

  it("rejects public source without URL", () => {
    const result = buildDeployConfig({
      ...baseState(),
      source: {
        ...validSource,
        sourceType: "public",
        ownerId: "",
        repositoryId: "",
        publicSourceUrl: "",
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(
      result.errors.some((e) => e.field === "source.publicSourceUrl")
    ).toBe(true)
  })

  it("rejects public source with non-HTTPS URL", () => {
    const result = buildDeployConfig({
      ...baseState(),
      source: {
        ...validSource,
        sourceType: "public",
        ownerId: "",
        repositoryId: "",
        publicSourceUrl: "http://github.com/org/repo",
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(
      result.errors.some((e) => e.field === "source.publicSourceUrl")
    ).toBe(true)
  })
})
