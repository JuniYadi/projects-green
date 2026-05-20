import { describe, expect, it } from "bun:test"

import {
  ENV_VAR_MAX_VALUE_SIZE,
} from "@/modules/deploy/environment-vars"
import {
  getEnvironmentValidationMessages,
  isValidCustomDomain,
  isValidEnvVarKey,
  validateBuildStep,
  validateEnvironmentStep,
  validateEnvVarKeysUnique,
} from "@/modules/deploy/deploy.schema"
import type { DetectionResult } from "@/modules/deploy/deploy.types"

describe("validateBuildStep", () => {
  const successDetection: DetectionResult = {
    language: "Node.js",
    framework: "Next.js",
    dockerfileDetected: false,
    buildCommand: "npm run build",
    confidence: 90,
    status: "success",
  }

  const failedDetection: DetectionResult = {
    language: null,
    framework: null,
    dockerfileDetected: false,
    buildCommand: null,
    confidence: 0,
    status: "failed",
  }

  it("allows proceeding on high confidence detection", () => {
    expect(
      validateBuildStep(
        {
          language: "",
          framework: "",
          buildCommand: "",
          useDockerfile: false,
        },
        successDetection
      )
    ).toBe(true)
  })

  it("requires manual values or dockerfile on failed detection", () => {
    expect(
      validateBuildStep(
        {
          language: "",
          framework: "",
          buildCommand: "",
          useDockerfile: false,
        },
        failedDetection
      )
    ).toBe(false)

    expect(
      validateBuildStep(
        {
          language: "Node.js",
          framework: "Express",
          buildCommand: "npm run build",
          useDockerfile: false,
        },
        failedDetection
      )
    ).toBe(true)
  })

  it("allows dockerfile mode when manual values are missing", () => {
    expect(
      validateBuildStep(
        {
          language: "",
          framework: "",
          buildCommand: "",
          useDockerfile: true,
        },
        failedDetection
      )
    ).toBe(true)
  })
})

describe("validateEnvVarKeysUnique", () => {
  it("flags duplicate keys", () => {
    expect(
      validateEnvVarKeysUnique([
        {
          id: "1",
          key: "DATABASE_URL",
          value: "postgres://...",
        },
        {
          id: "2",
          key: "database_url",
          value: "postgres://other",
        },
      ])
    ).toBe(false)
  })

  it("allows unique keys", () => {
    expect(
      validateEnvVarKeysUnique([
        {
          id: "1",
          key: "DATABASE_URL",
          value: "postgres://...",
        },
        {
          id: "2",
          key: "API_KEY",
          value: "123",
        },
      ])
    ).toBe(true)
  })

  it("ignores empty keys while editing", () => {
    expect(
      validateEnvVarKeysUnique([
        {
          id: "1",
          key: "",
          value: "",
        },
        {
          id: "2",
          key: "",
          value: "",
        },
      ])
    ).toBe(true)
  })
})

describe("environment step validation", () => {
  const baseEnvironmentState = {
    useGeneratedSubdomain: true,
    customDomain: "",
    envVars: [],
    resourcePlanId: "starter" as const,
  }

  it("requires custom domain when domain mode is custom", () => {
    expect(
      validateEnvironmentStep({
        ...baseEnvironmentState,
        useGeneratedSubdomain: false,
      })
    ).toBe(false)
  })

  it("rejects invalid custom domain format", () => {
    expect(
      validateEnvironmentStep({
        ...baseEnvironmentState,
        useGeneratedSubdomain: false,
        customDomain: "https://app.example.com",
      })
    ).toBe(false)

    expect(
      validateEnvironmentStep({
        ...baseEnvironmentState,
        useGeneratedSubdomain: false,
        customDomain: "app.example.com",
      })
    ).toBe(true)
  })

  it("rejects non-standard env var keys", () => {
    expect(
      validateEnvironmentStep({
        ...baseEnvironmentState,
        envVars: [
          {
            id: "1",
            key: "apiKey",
            value: "secret",
          },
        ],
      })
    ).toBe(false)
  })

  it("allows stored secret values to remain undisclosed after save", () => {
    expect(
      validateEnvironmentStep({
        ...baseEnvironmentState,
        envVars: [
          {
            id: "secret-1",
            key: "APP_KEY",
            value: "",
            type: "secret",
            isStoredSecret: true,
          },
        ],
      })
    ).toBe(true)
  })

  it("rejects oversize env var values", () => {
    expect(
      validateEnvironmentStep({
        ...baseEnvironmentState,
        envVars: [
          {
            id: "1",
            key: "BIG_VALUE",
            value: "a".repeat(ENV_VAR_MAX_VALUE_SIZE + 1),
          },
        ],
      })
    ).toBe(false)
  })
})

describe("helper validators", () => {
  it("validates custom domain format", () => {
    expect(isValidCustomDomain("app.example.com")).toBe(true)
    expect(isValidCustomDomain("https://app.example.com")).toBe(false)
  })

  it("validates environment variable key format", () => {
    expect(isValidEnvVarKey("DATABASE_URL")).toBe(true)
    expect(isValidEnvVarKey("databaseUrl")).toBe(false)
  })

  it("returns deduplicated environment validation messages", () => {
    const messages = getEnvironmentValidationMessages({
      useGeneratedSubdomain: false,
      customDomain: "",
      envVars: [
        {
          id: "1",
          key: "",
          value: "",
        },
        {
          id: "2",
          key: "",
          value: "",
        },
      ],
      resourcePlanId: "starter",
    })

    expect(messages).toHaveLength(3)
    expect(messages).toContain("Environment key is required.")
    expect(messages).toContain("Environment value is required.")
    expect(messages).toContain(
      "Custom domain is required when generated subdomain is off."
    )
  })
})
