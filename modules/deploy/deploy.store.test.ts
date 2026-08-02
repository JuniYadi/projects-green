import { describe, expect, it } from "bun:test"

import {
  createInitialDeployWizardState,
  hydrateDeployWizardState,
  serializeDeployWizardState,
} from "@/modules/deploy/deploy.store"

describe("deploy store persistence helpers", () => {
  it("serializes and hydrates canonical wizard state", () => {
    const state = createInitialDeployWizardState()
    state.step = "review"
    state.source.ownerId = "owner-pfn"

    const hydrated = hydrateDeployWizardState(serializeDeployWizardState(state))

    expect(hydrated).not.toBeNull()
    expect(hydrated?.step).toBe("review")
    expect(hydrated?.source.ownerId).toBe("owner-pfn")
  })

  it("maps legacy persisted stages to canonical stages", () => {
    const state = createInitialDeployWizardState()
    const legacy = JSON.stringify({
      version: 1,
      state: { ...state, step: "build" },
    })

    expect(hydrateDeployWizardState(legacy)?.step).toBe("detect")
  })

  it("returns null for invalid payloads", () => {
    expect(hydrateDeployWizardState(null)).toBeNull()
    expect(hydrateDeployWizardState("not-json")).toBeNull()
    expect(
      hydrateDeployWizardState(
        JSON.stringify({
          version: 999,
          state: {},
        })
      )
    ).toBeNull()
  })
})
