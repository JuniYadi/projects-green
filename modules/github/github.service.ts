import {
  FEATURE_FLAG_KEYS,
  isFeatureEnabled,
  type FeatureFlagName,
} from "@/lib/feature-flags"

export class GithubIntegrationDisabledError extends Error {
  constructor() {
    super("GitHub App integration is disabled.")
    this.name = "GithubIntegrationDisabledError"
  }
}

export type GithubFeatureStatus = {
  feature: FeatureFlagName
  envKey: string
  enabled: boolean
}

export type GithubService = {
  getFeatureStatus: () => GithubFeatureStatus
  assertEnabled: () => void
}

export const createGithubService = (): GithubService => {
  const feature: FeatureFlagName = "github_app_integration"

  return {
    getFeatureStatus() {
      return {
        feature,
        envKey: FEATURE_FLAG_KEYS[feature],
        enabled: isFeatureEnabled(feature),
      }
    },
    assertEnabled() {
      if (!isFeatureEnabled(feature)) {
        throw new GithubIntegrationDisabledError()
      }
    },
  }
}

export const githubService = createGithubService()
