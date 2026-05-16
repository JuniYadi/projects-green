import { describe, expect, it } from "bun:test"

import {
  createInitialDeployWizardState,
  hydrateDeployWizardState,
  serializeDeployWizardState,
} from "@/modules/deploy/deploy.store"

describe("deploy store persistence helpers", () => {
  it("serializes and hydrates wizard state", () => {
    const state = createInitialDeployWizardState()
    state.step = "build"
    state.source.ownerId = "owner-pfn"

    const serialized = serializeDeployWizardState(state)
    const hydrated = hydrateDeployWizardState(serialized)

    expect(hydrated).not.toBeNull()
    expect(hydrated?.step).toBe("build")
    expect(hydrated?.source.ownerId).toBe("owner-pfn")
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
