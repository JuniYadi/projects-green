import { randomBytes } from "node:crypto"

import {
  type AppTemplateBlueprint,
  appTemplateBlueprintSchema,
} from "@/modules/deploy/blueprint/app-template-blueprint.schema"

export interface BlueprintValidationResult {
  valid: boolean
  data?: AppTemplateBlueprint
  errors?: Record<string, string>
}

export function validateBlueprint(input: unknown): BlueprintValidationResult {
  const result = appTemplateBlueprintSchema.safeParse(input)

  if (!result.success) {
    const errors: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join(".") : "_root"
      if (!errors[path]) {
        errors[path] = issue.message
      }
    }
    return {
      valid: false,
      errors,
    }
  }

  return {
    valid: true,
    data: result.data,
  }
}

export function buildInitialEnvVars(
  blueprint: AppTemplateBlueprint,
  userOverrides: Record<string, string> = {}
): Record<string, string> {
  const envVars: Record<string, string> = {}

  for (const envDef of blueprint.envSchema ?? []) {
    const { key, defaultValue, generateRandomHex } = envDef

    if (userOverrides[key] !== undefined && userOverrides[key] !== "") {
      envVars[key] = userOverrides[key]
      continue
    }

    if (generateRandomHex && generateRandomHex > 0) {
      envVars[key] = randomBytes(Math.ceil(generateRandomHex / 2))
        .toString("hex")
        .slice(0, generateRandomHex)
      continue
    }

    if (defaultValue !== undefined) {
      envVars[key] = defaultValue
      continue
    }

    if (userOverrides[key] !== undefined) {
      envVars[key] = userOverrides[key]
    }
  }

  // Include any extra user overrides that might not be in schema
  for (const [key, value] of Object.entries(userOverrides)) {
    if (envVars[key] === undefined) {
      envVars[key] = value
    }
  }

  return envVars
}
