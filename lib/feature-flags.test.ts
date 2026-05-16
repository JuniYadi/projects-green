import { afterEach, describe, expect, it } from "bun:test"

import { isFeatureEnabled } from "@/lib/feature-flags"

const originalFlag = process.env.FEATURE_GITHUB_APP_INTEGRATION

afterEach(() => {
  if (originalFlag === undefined) {
    delete process.env.FEATURE_GITHUB_APP_INTEGRATION
    return
  }

  process.env.FEATURE_GITHUB_APP_INTEGRATION = originalFlag
})

describe("feature flags", () => {
  it("defaults github_app_integration to disabled", () => {
    delete process.env.FEATURE_GITHUB_APP_INTEGRATION

    expect(isFeatureEnabled("github_app_integration")).toBe(false)
  })

  it("enables github_app_integration for truthy values", () => {
    process.env.FEATURE_GITHUB_APP_INTEGRATION = "true"
    expect(isFeatureEnabled("github_app_integration")).toBe(true)

    process.env.FEATURE_GITHUB_APP_INTEGRATION = " ON "
    expect(isFeatureEnabled("github_app_integration")).toBe(true)
  })

  it("keeps github_app_integration disabled for unrecognized values", () => {
    process.env.FEATURE_GITHUB_APP_INTEGRATION = "enabled"

    expect(isFeatureEnabled("github_app_integration")).toBe(false)
  })
})
