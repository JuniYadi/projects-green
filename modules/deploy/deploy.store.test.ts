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

it("preserves public source state through hydration", () => {
  const state = createInitialDeployWizardState()
  state.step = "source"
  state.source.sourceType = "public"
  state.source.publicSourceUrl = "https://github.com/org/repo"
  state.source.publicSourceRef = "main"
  state.source.appName = "my-public-app"
  state.source.rootDirectory = "/src"

  const hydrated = hydrateDeployWizardState(serializeDeployWizardState(state))

  expect(hydrated).not.toBeNull()
  expect(hydrated?.source.sourceType).toBe("public")
  expect(hydrated?.source.publicSourceUrl).toBe("https://github.com/org/repo")
  expect(hydrated?.source.publicSourceRef).toBe("main")
  expect(hydrated?.source.appName).toBe("my-public-app")
  expect(hydrated?.source.rootDirectory).toBe("/src")
})

it("sanitizes invalid sourceType to default while preserving public fields", () => {
  const state = createInitialDeployWizardState()
  const raw = JSON.stringify({
    version: 1,
    state: {
      ...state,
      source: {
        ...state.source,
        sourceType: "invalid" as never,
        publicSourceUrl: "https://github.com/org/repo",
      },
    },
  })

  const hydrated = hydrateDeployWizardState(raw)
  expect(hydrated).not.toBeNull()
  expect(hydrated?.source.sourceType).toBe("template")
})
