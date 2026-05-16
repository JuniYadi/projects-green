import { afterEach, describe, expect, it } from "bun:test"

import {
  createGithubService,
  GithubIntegrationDisabledError,
} from "@/modules/github/github.service"

const originalFlag = process.env.FEATURE_GITHUB_APP_INTEGRATION

afterEach(() => {
  if (originalFlag === undefined) {
    delete process.env.FEATURE_GITHUB_APP_INTEGRATION
    return
  }

  process.env.FEATURE_GITHUB_APP_INTEGRATION = originalFlag
})

describe("githubService", () => {
  it("reports feature metadata and enabled state", () => {
    process.env.FEATURE_GITHUB_APP_INTEGRATION = "true"

    const service = createGithubService()
    const status = service.getFeatureStatus()

    expect(status.feature).toBe("github_app_integration")
    expect(status.envKey).toBe("FEATURE_GITHUB_APP_INTEGRATION")
    expect(status.enabled).toBe(true)
  })

  it("throws when assertEnabled is called while disabled", () => {
    process.env.FEATURE_GITHUB_APP_INTEGRATION = "false"

    const service = createGithubService()

    expect(() => service.assertEnabled()).toThrowError(
      GithubIntegrationDisabledError
    )
  })
})
