import { describe, expect, it } from "bun:test"

import {
  clampStepToUnlocked,
  getAvailableStepsList,
  getMaxUnlockedStep,
  getNextStep,
  getPreviousStep,
  getStepIndex,
  isStepValid,
  resolveMonitorStatus,
} from "@/modules/deploy/deploy.logic"
import { createInitialDeployWizardState } from "@/modules/deploy/deploy.store"

describe("getAvailableStepsList", () => {
  it("includes build step for github source type", () => {
    expect(getAvailableStepsList("github")).toEqual([
      "source",
      "build",
      "environment",
      "monitor",
    ])
  })

  it("excludes build step for template source type", () => {
    expect(getAvailableStepsList("template")).toEqual([
      "source",
      "environment",
      "monitor",
    ])
  })
})

describe("getStepIndex", () => {
  it("returns correct index for a valid step", () => {
    expect(getStepIndex("build", "github")).toBe(1)
    expect(getStepIndex("environment", "template")).toBe(1)
  })

  it("returns -1 for steps not in source type's list", () => {
    expect(getStepIndex("build", "template")).toBe(-1)
  })
})

describe("getNextStep", () => {
  it("navigates template flow: source -> environment -> monitor -> null", () => {
    const state = {
      source: { sourceType: "template" as const },
      detectionResult: null,
    }
    expect(getNextStep("source", state)).toBe("environment")
    expect(getNextStep("environment", state)).toBe("monitor")
    expect(getNextStep("monitor", state)).toBeNull()
  })

  it("skips build for high-confidence github detection", () => {
    const state = {
      source: { sourceType: "github" as const },
      detectionResult: {
        language: "Node.js",
        framework: "Next.js",
        dockerfileDetected: false,
        buildCommand: "npm run build",
        confidence: 90,
        status: "success" as const,
      },
    }
    expect(getNextStep("source", state)).toBe("environment")
  })

  it("goes through build for low-confidence github detection", () => {
    const state = {
      source: { sourceType: "github" as const },
      detectionResult: {
        language: "Node.js",
        framework: null,
        dockerfileDetected: false,
        buildCommand: null,
        confidence: 30,
        status: "partial" as const,
      },
    }
    expect(getNextStep("source", state)).toBe("build")
    expect(getNextStep("build", state)).toBe("environment")
    expect(getNextStep("environment", state)).toBe("monitor")
    expect(getNextStep("monitor", state)).toBeNull()
  })
})

describe("getPreviousStep", () => {
  it("navigates template flow backwards", () => {
    const state = { source: { sourceType: "template" as const } }
    expect(getPreviousStep("monitor", state)).toBe("environment")
    expect(getPreviousStep("environment", state)).toBe("source")
    expect(getPreviousStep("source", state)).toBeNull()
  })

  it("navigates github flow backwards through build step", () => {
    const state = { source: { sourceType: "github" as const } }
    expect(getPreviousStep("monitor", state)).toBe("environment")
    expect(getPreviousStep("environment", state)).toBe("build")
    expect(getPreviousStep("build", state)).toBe("source")
    expect(getPreviousStep("source", state)).toBeNull()
  })
})

describe("isStepValid", () => {
  it("returns false for empty source step", () => {
    const state = createInitialDeployWizardState()
    expect(isStepValid("source", state)).toBe(false)
  })

  it("returns false for default build step", () => {
    const state = createInitialDeployWizardState()
    expect(isStepValid("build", state)).toBe(false)
  })

  it("returns false for environment step when domain is empty and subdomain is off", () => {
    const state = createInitialDeployWizardState()
    state.environment.useGeneratedSubdomain = false
    state.environment.customDomain = ""
    expect(isStepValid("environment", state)).toBe(false)
  })
})

describe("wizard step gating", () => {
  it("locks forward navigation until each step is valid", () => {
    const state = createInitialDeployWizardState()
    state.environment.useGeneratedSubdomain = false
    state.environment.customDomain = ""

    expect(getMaxUnlockedStep(state)).toBe("source")
    expect(clampStepToUnlocked("monitor", state)).toBe("source")

    state.source.ownerId = "owner"
    state.source.repositoryId = "repo"
    state.source.branchName = "main"
    state.detectionResult = {
      language: "Node.js",
      framework: "Next.js",
      dockerfileDetected: false,
      buildCommand: "npm run build",
      confidence: 90,
      status: "success",
    }

    expect(getMaxUnlockedStep(state)).toBe("environment")
    expect(clampStepToUnlocked("monitor", state)).toBe("environment")

    expect(getMaxUnlockedStep(state)).toBe("environment")

    state.environment.customDomain = "app.example.com"

    expect(getMaxUnlockedStep(state)).toBe("monitor")
    expect(clampStepToUnlocked("monitor", state)).toBe("monitor")
  })

  it("handles template source type (skips build step)", () => {
    const state = createInitialDeployWizardState()
    state.environment.useGeneratedSubdomain = false
    state.environment.customDomain = ""
    state.source.sourceType = "template"
    // no templateId set yet → source invalid
    expect(getMaxUnlockedStep(state)).toBe("source")

    state.source.templateId = "wordpress"
    // source valid, environment invalid → unlocks environment
    expect(getMaxUnlockedStep(state)).toBe("environment")

    state.environment.customDomain = "app.example.com"
    // all steps valid → unlocks monitor
    expect(getMaxUnlockedStep(state)).toBe("monitor")
  })

  it("clamps requested step to max unlocked when beyond reach", () => {
    const state = createInitialDeployWizardState()
    expect(clampStepToUnlocked("build", state)).toBe("source")
    expect(clampStepToUnlocked("monitor", state)).toBe("source")
  })
})

describe("resolveMonitorStatus", () => {
  it("resolves success timeline progression", () => {
    expect(resolveMonitorStatus(0, false)).toBe("queued")
    expect(resolveMonitorStatus(1, false)).toBe("building")
    expect(resolveMonitorStatus(2, false)).toBe("building")
    expect(resolveMonitorStatus(3, false)).toBe("deploying")
    expect(resolveMonitorStatus(4, false)).toBe("running")
  })

  it("resolves failure timeline progression", () => {
    expect(resolveMonitorStatus(4, true)).toBe("failed")
  })

  it("returns queued for negative tick", () => {
    expect(resolveMonitorStatus(-1, false)).toBe("queued")
  })
})
