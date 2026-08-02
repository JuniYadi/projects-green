import { describe, expect, it } from "bun:test"

import {
  clampStepToUnlocked,
  getAvailableStepsList,
  getMaxUnlockedStep,
  getNextStep,
  getPreviousStep,
  getStepIndex,
} from "@/modules/deploy/deploy.logic"
import { createInitialDeployWizardState } from "@/modules/deploy/deploy.store"

describe("canonical deploy wizard stages", () => {
  it("exposes the preview's five stages", () => {
    expect(getAvailableStepsList()).toEqual([
      "source",
      "connect",
      "detect",
      "review",
      "deploy",
    ])
    expect(getStepIndex("review")).toBe(3)
  })

  it("navigates forward and backward through every stage", () => {
    expect(getNextStep("source")).toBe("connect")
    expect(getNextStep("connect")).toBe("detect")
    expect(getNextStep("detect")).toBe("review")
    expect(getNextStep("review")).toBe("deploy")
    expect(getNextStep("deploy")).toBeNull()

    expect(getPreviousStep("deploy")).toBe("review")
    expect(getPreviousStep("review")).toBe("detect")
    expect(getPreviousStep("detect")).toBe("connect")
    expect(getPreviousStep("connect")).toBe("source")
    expect(getPreviousStep("source")).toBeNull()
  })

  it("keeps incomplete state on the first valid stage", () => {
    const state = createInitialDeployWizardState()
    expect(getMaxUnlockedStep(state)).toBe("source")
    expect(clampStepToUnlocked("deploy", state)).toBe("source")
  })

  it("unlocks detection after source and detection data exist", () => {
    const state = createInitialDeployWizardState()
    state.source = {
      ...state.source,
      sourceType: "template",
      templateId: "wordpress",
    }
    state.detectionResult = {
      language: "PHP",
      framework: "WordPress",
      frameworkVersion: null,
      dockerfileDetected: false,
      buildCommand: "wp core install",
      confidence: 100,
      status: "success",
      primaryEngine: "php",
      primaryEngineVersion: "8.4",
    }
    state.build = {
      ...state.build,
      language: "PHP",
      framework: "WordPress",
      buildCommand: "wp core install",
    }

    expect(getMaxUnlockedStep(state)).toBe("review")
    expect(clampStepToUnlocked("detect", state)).toBe("detect")
  })
  it("requires a deployment id before unlocking monitor", () => {
    const state = createInitialDeployWizardState()
    state.source = {
      ...state.source,
      sourceType: "template",
      templateId: "wordpress",
    }
    state.detectionResult = {
      language: "PHP",
      framework: "WordPress",
      frameworkVersion: null,
      dockerfileDetected: false,
      buildCommand: "wp core install",
      confidence: 100,
      status: "success",
      primaryEngine: "php",
      primaryEngineVersion: "8.4",
    }
    state.build = {
      ...state.build,
      language: "PHP",
      framework: "WordPress",
      buildCommand: "wp core install",
    }
    state.monitor.status = "running"

    expect(getMaxUnlockedStep(state)).toBe("review")

    state.monitor.deployId = "deploy-1"
    expect(getMaxUnlockedStep(state)).toBe("deploy")
  })
})
