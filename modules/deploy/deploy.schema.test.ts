import { describe, expect, it } from "bun:test"

import {
  validateBuildStep,
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
})
