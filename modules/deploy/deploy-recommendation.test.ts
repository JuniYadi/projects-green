import { describe, expect, it } from "bun:test"
import type { DetectionResult } from "@/modules/deploy/deploy.types"
import { recommendPlan } from "@/modules/deploy/deploy-recommendation"

function detection(overrides: Partial<DetectionResult> = {}): DetectionResult {
  return {
    language: "javascript",
    framework: null,
    dockerfileDetected: false,
    buildCommand: null,
    confidence: 100,
    status: "success",
    ...overrides,
  }
}

describe("recommendPlan", () => {
  it("returns fallback for null detection", () => {
    expect(recommendPlan(null)).toEqual({
      resourcePlanId: "pro",
      cpu: 500,
      memory: 1024,
      label: "Recommended for general use",
    })
  })

  it("returns fallback for detection without framework", () => {
    expect(recommendPlan(detection({ framework: null }))).toEqual({
      resourcePlanId: "pro",
      cpu: 500,
      memory: 1024,
      label: "Recommended for general use",
    })
  })

  it("recommends PAYG 500/1024 for PAYG framework without secondaryEngine", () => {
    expect(recommendPlan(detection({ framework: "laravel" }))).toEqual({
      resourcePlanId: "payg",
      cpu: 500,
      memory: 1024,
      label: "AI recommended — heavy framework detected",
    })
  })

  it("recommends PAYG 1000/2048 for PAYG framework with secondaryEngine", () => {
    expect(
      recommendPlan(
        detection({ framework: "laravel", secondaryEngine: "mysql" })
      )
    ).toEqual({
      resourcePlanId: "payg",
      cpu: 1000,
      memory: 2048,
      label: "AI recommended — heavy framework detected",
    })
  })

  it("recommends pro for PRO frameworks", () => {
    expect(recommendPlan(detection({ framework: "nextjs" }))).toEqual({
      resourcePlanId: "pro",
      cpu: 500,
      memory: 1024,
      label: "AI recommended",
    })
  })

  it("recommends starter for unknown frameworks", () => {
    expect(recommendPlan(detection({ framework: "unknown" }))).toEqual({
      resourcePlanId: "starter",
      cpu: 100,
      memory: 256,
      label: "AI recommended — light workload",
    })
  })
})
