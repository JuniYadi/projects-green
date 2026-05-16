const ENABLED_VALUES = new Set(["1", "true", "yes", "on"])

export const FEATURE_FLAG_KEYS = {
  github_app_integration: "FEATURE_GITHUB_APP_INTEGRATION",
} as const

export type FeatureFlagName = keyof typeof FEATURE_FLAG_KEYS

const parseFeatureFlagValue = (value: string | undefined) => {
  if (!value) {
    return false
  }

  return ENABLED_VALUES.has(value.trim().toLowerCase())
}

export const isFeatureEnabled = (feature: FeatureFlagName) =>
  parseFeatureFlagValue(process.env[FEATURE_FLAG_KEYS[feature]])
