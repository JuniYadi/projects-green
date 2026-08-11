import { describe, expect, it } from "bun:test"
import { recommendPlan } from "@/modules/deploy/deploy-recommendation"
import type { DetectionResult } from "@/modules/framework-detection/framework-detection.types"

function detection(overrides: Partial<DetectionResult> = {}): DetectionResult {
  return {
    primaryFramework: null,
    requiredDependencies: [],
    alternatives: [],
    confidence: 0,
    decision: {
      status: "unsupported",
      message: "No framework detected.",
      isLaunchable: false,
    },
    evidence: [],
    warnings: [],
    source: { repoUrl: "https://github.com/acme/storefront" },
    ...overrides,
  }
}

const framework = (id: string, ecosystem: "node" | "php") => ({
  id,
  name: id,
  ecosystem,
  confidence: 0.9,
  reasons: ["test fixture"],
})

const dependency = (
  id: "node" | "php",
  kind: "runtime" | "toolchain",
  requiredFor: "app_runtime" | "asset_build"
) => ({
  id,
  kind,
  requiredFor,
  confidence: 0.9,
  reason: "test fixture",
})

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
    expect(recommendPlan(detection({ primaryFramework: null }))).toEqual({
      resourcePlanId: "pro",
      cpu: 500,
      memory: 1024,
      label: "Recommended for general use",
    })
  })

  it("recommends PAYG 500/1024 without a toolchain dependency", () => {
    expect(
      recommendPlan(
        detection({
          primaryFramework: framework("laravel", "php"),
          requiredDependencies: [dependency("php", "runtime", "app_runtime")],
        })
      )
    ).toEqual({
      resourcePlanId: "payg",
      cpu: 500,
      memory: 1024,
      label: "AI recommended — heavy framework detected",
    })
  })

  it("recommends PAYG 1000/2048 with a toolchain dependency", () => {
    expect(
      recommendPlan(
        detection({
          primaryFramework: framework("laravel", "php"),
          requiredDependencies: [
            dependency("php", "runtime", "app_runtime"),
            dependency("node", "toolchain", "asset_build"),
          ],
        })
      )
    ).toEqual({
      resourcePlanId: "payg",
      cpu: 1000,
      memory: 2048,
      label: "AI recommended — heavy framework detected",
    })
  })

  it("recommends pro for PRO frameworks", () => {
    expect(
      recommendPlan(
        detection({
          primaryFramework: framework("nextjs", "node"),
          requiredDependencies: [dependency("node", "runtime", "app_runtime")],
        })
      )
    ).toEqual({
      resourcePlanId: "pro",
      cpu: 500,
      memory: 1024,
      label: "AI recommended",
    })
  })

  it("recommends starter for unknown frameworks", () => {
    expect(
      recommendPlan(
        detection({ primaryFramework: framework("unknown", "node") })
      )
    ).toEqual({
      resourcePlanId: "starter",
      cpu: 100,
      memory: 256,
      label: "AI recommended — light workload",
    })
  })
})
