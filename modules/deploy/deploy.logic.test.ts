import { describe, expect, it } from "bun:test"

import {
  clampStepToUnlocked,
  getMaxUnlockedStep,
  resolveMonitorStatus,
} from "@/modules/deploy/deploy.logic"
import { createInitialDeployWizardState } from "@/modules/deploy/deploy.store"

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
})

describe("resolveMonitorStatus", () => {
  it("resolves success timeline progression", () => {
    expect(resolveMonitorStatus(0, false)).toBe("queued")
    expect(resolveMonitorStatus(1, false)).toBe("building")
    expect(resolveMonitorStatus(3, false)).toBe("deploying")
    expect(resolveMonitorStatus(4, false)).toBe("running")
  })

  it("resolves failure timeline progression", () => {
    expect(resolveMonitorStatus(4, true)).toBe("failed")
  })
})
